import { UnrecoverableError, Worker } from "bullmq";
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
      await service.processImageGenerationJob(job.data.drawingId, job.data.prompt);
    },
    { connection: createRedisConnection() }
  );

  worker.on("failed", async (job, err) => {
    if (!job?.data?.drawingId) return;
    const max = job.opts.attempts ?? 1;
    const terminal =
      err instanceof UnrecoverableError || job.attemptsMade >= max;
    if (terminal) {
      await repo.update(job.data.drawingId, { status: "failed" });
    }
  });

  return worker;
}
