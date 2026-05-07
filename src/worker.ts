import "dotenv/config";
import { startOutboxRelayInBackground } from "./infrastructure/outbox/outbox-relay";
import { createDrawingImageGenerationWorker } from "./infrastructure/queue/drawing-image-generation-worker";

const worker = createDrawingImageGenerationWorker();

let stopOutboxRelay: (() => void) | undefined;
if (process.env.OUTBOX_RELAY_ENABLED === "true") {
  stopOutboxRelay = startOutboxRelayInBackground().stop;
  console.log(
    JSON.stringify({
      component: "worker_entry",
      ts: new Date().toISOString(),
      outbox_relay: "embedded",
    })
  );
}

worker.on("completed", (job) => {
  console.log(
    JSON.stringify({
      component: "drawing_image_worker",
      ts: new Date().toISOString(),
      action: "job_completed",
      job_id: job.id,
      drawing_id: job.data.drawingId,
      event_id: job.data.eventId ?? null,
    })
  );
});

console.log("Drawing image generation worker listening");

async function shutdown(): Promise<void> {
  stopOutboxRelay?.();
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
