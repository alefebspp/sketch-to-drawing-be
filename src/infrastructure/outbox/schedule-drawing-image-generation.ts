import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/drizzle";
import { drawings, outboxEvents } from "../db/drizzle/schema";

export const DRAWING_AGGREGATE_TYPE = "drawing";

export const DRAWING_IMAGE_GENERATION_REQUESTED_EVENT =
  "DrawingImageGenerationRequested";

/**
 * Mesma transação: drawing em `processing` + linha de outbox pendente (relay publica na fila).
 */
export async function transactionalScheduleDrawingImageGeneration(input: {
  drawingId: number;
  prompt?: string;
}): Promise<{ eventId: string }> {
  const eventId = randomUUID();
  await db.transaction(async (tx) => {
    await tx
      .update(drawings)
      .set({
        status: "processing",
        lastError: null,
        failedAt: null,
      })
      .where(eq(drawings.id, input.drawingId));

    await tx.insert(outboxEvents).values({
      id: eventId,
      aggregateType: DRAWING_AGGREGATE_TYPE,
      aggregateId: String(input.drawingId),
      eventType: DRAWING_IMAGE_GENERATION_REQUESTED_EVENT,
      payload: {
        drawingId: input.drawingId,
        prompt: input.prompt,
        eventId,
      },
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date(),
    });
  });

  return { eventId };
}
