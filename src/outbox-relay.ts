/**
 * Relay do transactional outbox: publica eventos `DrawingImageGenerationRequested` no BullMQ.
 *
 * **Deploy**
 * 1. Aplicar migrações (`npm run db:migrate`).
 * 2. Subir API (grava drawing + outbox na mesma transação).
 * 3. Subir este processo ou `worker` com `OUTBOX_RELAY_ENABLED=true`.
 * 4. Manter Redis/BullMQ e worker de geração ativos.
 *
 * **Variáveis de ambiente**
 * - `DATABASE_URL` — Postgres (obrigatório).
 * - `OUTBOX_RELAY_POLL_MS` — intervalo do poll (default 500).
 * - `OUTBOX_RELAY_BATCH_SIZE` — eventos por tick (default 25).
 * - `OUTBOX_RELAY_METRICS_INTERVAL_MS` — log agregado pending/idade (default 30000).
 * - `OUTBOX_PUBLISH_MAX_ATTEMPTS` — tentativas antes de marcar `failed` (default 25).
 * - `OUTBOX_PUBLISH_BACKOFF_MS_BASE` — base backoff exponencial em ms (default 2000).
 * - `OUTBOX_PUBLISHING_STALE_SECONDS` — repõe `publishing` preso há N s para `pending` (default 300).
 * - Redis: mesmas vars usadas pelo `redis-connection` (filas BullMQ).
 */
import "dotenv/config";
import { startOutboxRelayInBackground } from "./infrastructure/outbox/outbox-relay";

const relay = startOutboxRelayInBackground();

console.log(
  JSON.stringify({
    component: "outbox_relay",
    ts: new Date().toISOString(),
    action: "started",
  })
);

async function shutdown(): Promise<void> {
  relay.stop();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
