import { UnrecoverableError, Worker } from "bullmq";
import { formatDrawingImageJobErrorForPersistence } from "./drawing-image-job-error-text";
import { createRedisConnection } from "./redis-connection";
import {
  DRAWING_IMAGE_GENERATION_QUEUE_NAME,
  type DrawingImageGenerationJobData,
} from "./drawing-image-generation-queue";
import { DrawingService } from "../../modules/drawing/drawing-service";
import { DrizzleDrawingRepository } from "../../modules/drawing/repository/drizzle-drawing-repository";

export function createDrawingImageGenerationWorker(): Worker<DrawingImageGenerationJobData> {
  const service = new DrawingService();
  const repo = new DrizzleDrawingRepository();

  const worker = new Worker<DrawingImageGenerationJobData>(
    DRAWING_IMAGE_GENERATION_QUEUE_NAME,
    async (job) => {
      console.log(
        JSON.stringify({
          component: "drawing_image_worker",
          ts: new Date().toISOString(),
          action: "job_started",
          job_id: job.id,
          drawing_id: job.data.drawingId,
          event_id: job.data.eventId ?? null,
        }),
      );
      await service.processImageGenerationJob(job.data.drawingId, job.data.prompt);
    },
    { connection: createRedisConnection() }
  );

  worker.on("failed", async (job, err) => {
    console.error(
      JSON.stringify({
        component: "drawing_image_worker",
        ts: new Date().toISOString(),
        action: "job_failed",
        job_id: job?.id ?? null,
        drawing_id: job?.data?.drawingId ?? null,
        event_id: job?.data?.eventId ?? null,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    if (!job?.data?.drawingId) return;
    const error = err instanceof Error ? err : new Error(String(err));
    const max = job.opts.attempts ?? 1;
    const terminal =
      error instanceof UnrecoverableError || job.attemptsMade >= max;
    if (terminal) {
      await repo.update(job.data.drawingId, {
        status: "failed",
        lastError: formatDrawingImageJobErrorForPersistence(error),
        failedAt: new Date(),
      });
    }
  });

  return worker;
}
