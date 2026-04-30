import { Queue } from "bullmq";
import { createRedisConnection } from "./redis-connection";

export const DRAWING_IMAGE_GENERATION_QUEUE_NAME = "drawing-image-generation";

/** Máx. de jobs `failed` retidos no Redis (BullMQ `removeOnFail.count`). Cada registo pesa o payload; default evita crescimento ilimitado. */
const DEFAULT_BULLMQ_FAILED_JOBS_MAX_COUNT = 100;
/** Idade máx. em segundos dos jobs `failed` retidos (`removeOnFail.age`). A limpeza é lazy; ver docs BullMQ. */
const DEFAULT_BULLMQ_FAILED_JOBS_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function intFromEnv(
  name: string,
  fallback: number
): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Política de retenção de jobs falhos no broker (BullMQ KeepJobs).
 * Override: `BULLMQ_FAILED_JOBS_MAX_COUNT`, `BULLMQ_FAILED_JOBS_MAX_AGE_SECONDS`.
 */
function failedJobsKeepPolicy() {
  return {
    count: intFromEnv(
      "BULLMQ_FAILED_JOBS_MAX_COUNT",
      DEFAULT_BULLMQ_FAILED_JOBS_MAX_COUNT
    ),
    age: intFromEnv(
      "BULLMQ_FAILED_JOBS_MAX_AGE_SECONDS",
      DEFAULT_BULLMQ_FAILED_JOBS_MAX_AGE_SECONDS
    ),
  };
}

export type DrawingImageGenerationJobData = {
  drawingId: number;
  prompt?: string;
};

const JOB_NAME = "generateDrawingImage";

let queueSingleton: Queue<DrawingImageGenerationJobData> | null = null;

export function getDrawingImageGenerationQueue(): Queue<DrawingImageGenerationJobData> {
  if (!queueSingleton) {
    queueSingleton = new Queue<DrawingImageGenerationJobData>(
      DRAWING_IMAGE_GENERATION_QUEUE_NAME,
      {
        connection: createRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: true,
          removeOnFail: failedJobsKeepPolicy(),
        },
      }
    );
  }
  return queueSingleton;
}

export function drawingImageGenerationJobId(drawingId: number): string {
  return `drawing-image-gen-${drawingId}`;
}

export async function enqueueDrawingImageGeneration(
  data: DrawingImageGenerationJobData
): Promise<void> {
  const queue = getDrawingImageGenerationQueue();
  await queue.add(JOB_NAME, data, {
    jobId: drawingImageGenerationJobId(data.drawingId),
  });
}
