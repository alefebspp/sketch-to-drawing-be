import { Queue } from "bullmq";
import { createRedisConnection } from "./redis-connection";

export const DRAWING_IMAGE_GENERATION_QUEUE_NAME = "drawing-image-generation";

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
          removeOnFail: true,
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
