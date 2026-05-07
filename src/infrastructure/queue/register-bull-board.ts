import type { FastifyInstance } from "fastify";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import { getDrawingImageGenerationQueue } from "./drawing-image-generation-queue";

const DEFAULT_BASE_PATH = "/admin/queues";

export function bullBoardBasePath(): string {
  const raw = process.env.BULL_BOARD_PATH?.trim();
  if (!raw) return DEFAULT_BASE_PATH;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export async function registerBullBoard(app: FastifyInstance): Promise<void> {
  const basePath = bullBoardBasePath();
  const serverAdapter = new FastifyAdapter().setBasePath(basePath);
  createBullBoard({
    queues: [new BullMQAdapter(getDrawingImageGenerationQueue())],
    serverAdapter,
  });
  await app.register(serverAdapter.registerPlugin(), { prefix: basePath });
}
