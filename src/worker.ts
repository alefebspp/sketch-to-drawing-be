import "dotenv/config";
import { createDrawingImageGenerationWorker } from "./infrastructure/queue/drawing-image-generation-worker";

const worker = createDrawingImageGenerationWorker();

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed for drawing ${job.data.drawingId}`);
});

worker.on("failed", (job, err) => {
  console.error(
    `Job ${job?.id} failed for drawing ${job?.data?.drawingId}:`,
    err
  );
});

console.log("Drawing image generation worker listening");

async function shutdown(): Promise<void> {
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
