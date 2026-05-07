import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "../db/drizzle";
import { outboxEvents } from "../db/drizzle/schema";
import type { DrawingImageGenerationOutboxPayload } from "../db/drizzle/schema";
import {
  enqueueDrawingImageGeneration,
  drawingImageGenerationJobId,
} from "../queue/drawing-image-generation-queue";
import { DRAWING_IMAGE_GENERATION_REQUESTED_EVENT } from "./schedule-drawing-image-generation";

const MAX_LAST_ERROR_LEN = 8000;

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function relayLog(event: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      component: "outbox_relay",
      ts: new Date().toISOString(),
      ...event,
    }),
  );
}

function truncateError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.length <= MAX_LAST_ERROR_LEN) return msg;
  return `${msg.slice(0, MAX_LAST_ERROR_LEN)}…`;
}

type ClaimedOutboxRowPg = {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: DrawingImageGenerationOutboxPayload;
  status: string;
  attempts: number;
  next_attempt_at: Date;
  last_error: string | null;
  created_at: Date;
  published_at: Date | null;
  locked_at: Date | null;
};

async function resetStalePublishingLocks(staleSeconds: number): Promise<void> {
  if (staleSeconds <= 0) return;
  const cutoff = new Date(Date.now() - staleSeconds * 1000);
  const reset = await db
    .update(outboxEvents)
    .set({ status: "pending", lockedAt: null })
    .where(
      and(
        eq(outboxEvents.status, "publishing"),
        isNotNull(outboxEvents.lockedAt),
        lt(outboxEvents.lockedAt, cutoff),
      ),
    )
    .returning({ id: outboxEvents.id });
  for (const r of reset) {
    relayLog({
      action: "stale_publishing_reset",
      event_id: r.id,
    });
  }
}

async function claimPendingBatch(batchSize: number): Promise<ClaimedOutboxRowPg[]> {
  const result = await db.execute(sql`
    WITH picked AS (
      SELECT id FROM outbox_events
      WHERE status = 'pending'
        AND next_attempt_at <= NOW()
        AND event_type = ${DRAWING_IMAGE_GENERATION_REQUESTED_EVENT}
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    )
    UPDATE outbox_events AS o
    SET status = 'publishing', locked_at = NOW()
    FROM picked
    WHERE o.id = picked.id
    RETURNING
      o.id,
      o.aggregate_type,
      o.aggregate_id,
      o.event_type,
      o.payload,
      o.status,
      o.attempts,
      o.next_attempt_at,
      o.last_error,
      o.created_at,
      o.published_at,
      o.locked_at;
  `);
  const rows = (result as unknown as { rows: ClaimedOutboxRowPg[] }).rows;
  return rows ?? [];
}

async function markPublished(eventId: string): Promise<void> {
  await db
    .update(outboxEvents)
    .set({
      status: "published",
      publishedAt: new Date(),
      lockedAt: null,
    })
    .where(eq(outboxEvents.id, eventId));
}

async function markPublishFailure(
  eventId: string,
  attemptsSoFar: number,
  err: unknown,
  maxAttempts: number,
  backoffBaseMs: number,
): Promise<void> {
  const nextAttempts = attemptsSoFar + 1;
  const msg = truncateError(err);
  if (nextAttempts >= maxAttempts) {
    await db
      .update(outboxEvents)
      .set({
        status: "failed",
        attempts: nextAttempts,
        lastError: msg,
        lockedAt: null,
      })
      .where(eq(outboxEvents.id, eventId));
    relayLog({
      action: "poison",
      event_id: eventId,
      attempts: nextAttempts,
      last_error: msg,
    });
    return;
  }
  const delayMs = backoffBaseMs * 2 ** (nextAttempts - 1);
  const nextAt = new Date(Date.now() + delayMs);
  await db
    .update(outboxEvents)
    .set({
      status: "pending",
      attempts: nextAttempts,
      lastError: msg,
      nextAttemptAt: nextAt,
      lockedAt: null,
    })
    .where(eq(outboxEvents.id, eventId));
  relayLog({
    action: "publish_error",
    event_id: eventId,
    attempts: nextAttempts,
    next_attempt_at: nextAt.toISOString(),
    last_error: msg,
  });
}

async function emitPendingAggregate(): Promise<void> {
  const [countRow] = await db
    .select({
      pendingCount: sql<number>`cast(count(*) as int)`,
    })
    .from(outboxEvents)
    .where(eq(outboxEvents.status, "pending"));

  const [oldestRow] = await db
    .select({
      oldestPending: sql<Date | null>`min(${outboxEvents.createdAt})`,
    })
    .from(outboxEvents)
    .where(eq(outboxEvents.status, "pending"));

  const pendingCount = countRow?.pendingCount ?? 0;
  const oldest = oldestRow?.oldestPending;
  const oldestPendingAgeSeconds =
    oldest === null || oldest === undefined
      ? null
      : Math.max(0, (Date.now() - new Date(oldest).getTime()) / 1000);

  relayLog({
    action: "aggregate",
    pending_count: pendingCount,
    oldest_pending_age_seconds: oldestPendingAgeSeconds,
  });
}

async function publishOne(row: ClaimedOutboxRowPg): Promise<void> {
  const payload = row.payload;
  const drawingId = payload.drawingId;
  const eventId = payload.eventId ?? row.id;
  const jobId = drawingImageGenerationJobId(drawingId);
  const attemptsSoFar = Number(row.attempts);

  relayLog({
    action: "claimed",
    event_id: eventId,
    drawing_id: drawingId,
    job_id: jobId,
    attempts: attemptsSoFar,
  });

  try {
    await enqueueDrawingImageGeneration({
      drawingId,
      prompt: payload.prompt,
      eventId,
    });
    await markPublished(row.id);
    relayLog({
      action: "published",
      event_id: eventId,
      drawing_id: drawingId,
      job_id: jobId,
    });
  } catch (e) {
    await markPublishFailure(
      row.id,
      attemptsSoFar,
      e,
      intFromEnv("OUTBOX_PUBLISH_MAX_ATTEMPTS", 25),
      intFromEnv("OUTBOX_PUBLISH_BACKOFF_MS_BASE", 2000),
    );
  }
}

export async function runOutboxRelayTick(): Promise<void> {
  const batchSize = intFromEnv("OUTBOX_RELAY_BATCH_SIZE", 25);
  const staleSeconds = intFromEnv("OUTBOX_PUBLISHING_STALE_SECONDS", 300);

  await resetStalePublishingLocks(staleSeconds);
  const batch = await claimPendingBatch(batchSize);
  await Promise.all(batch.map((row) => publishOne(row)));
}

export function startOutboxRelayInBackground(): {
  stop: () => void;
} {
  const pollMs = intFromEnv("OUTBOX_RELAY_POLL_MS", 500);
  const metricsMs = intFromEnv("OUTBOX_RELAY_METRICS_INTERVAL_MS", 30_000);

  const pollTimer = setInterval(() => {
    void runOutboxRelayTick().catch((e) => {
      relayLog({
        action: "tick_fatal",
        error: truncateError(e),
      });
    });
  }, pollMs);

  const metricsTimer = setInterval(() => {
    void emitPendingAggregate().catch((e) => {
      relayLog({
        action: "aggregate_error",
        error: truncateError(e),
      });
    });
  }, metricsMs);

  void runOutboxRelayTick().catch((e) => {
    relayLog({ action: "initial_tick_error", error: truncateError(e) });
  });
  void emitPendingAggregate().catch(() => {});

  return {
    stop: () => {
      clearInterval(pollTimer);
      clearInterval(metricsTimer);
    },
  };
}
