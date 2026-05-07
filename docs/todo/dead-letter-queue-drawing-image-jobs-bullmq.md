# TODO: Dead Letter / retenção de jobs falhos (BullMQ) + diagnóstico no domínio

Tarefas derivadas de `docs/research/dead-letter-queue-drawing-image-jobs-bullmq.md`.

## Descrição resumida

- Substituir `removeOnFail: true` por **retenção controlada** de jobs `failed` no BullMQ 5 (contagem/idade), para permitir retry operacional e inspeção sem crescimento ilimitado no Redis.
- Na falha **terminal** (mesma regra de hoje: `UnrecoverableError` ou tentativas esgotadas), além de `status: failed`, persistir **`last_error`** e, se útil, **`failed_at`** em `drawings` (fonte de verdade para API/suporte).
- Manter uma **única** estratégia (broker + PostgreSQL), sem fila DLQ paralela; alinhar com [docs/research/async-drawing-image-generation-bullmq.md](docs/research/async-drawing-image-generation-bullmq.md).

---

## 1. BullMQ — política de retenção de jobs falhos

- [ ] Em [src/infrastructure/queue/drawing-image-generation-queue.ts](src/infrastructure/queue/drawing-image-generation-queue.ts), substituir `removeOnFail: true` por um objeto conforme [documentação BullMQ 5](https://docs.bullmq.io) (limite por contagem e/ou idade), evitando `removeOnFail: false` sem teto.
- [ ] Documentar (comentário ou env) os valores escolhidos (ex.: N jobs falhos retidos, TTL) e impacto em memória Redis.
- [ ] Confirmar interação com `removeOnComplete: true` e `defaultJobOptions` existentes (`attempts`, `backoff`).

## 2. PostgreSQL — colunas de diagnóstico

- [ ] Adicionar colunas `last_error` (text, nullable) e, se adotado, `failed_at` (timestamp, nullable) em [src/infrastructure/db/drizzle/schema.ts](src/infrastructure/db/drizzle/schema.ts) na tabela `drawings`.
- [ ] Gerar e aplicar migration Drizzle para essas colunas.
- [ ] Definir truncamento seguro de mensagem (tamanho máximo) e evitar vazar PII desnecessária no texto persistido (conforme research).

## 3. Domínio e repositório

- [ ] Estender o modelo [src/modules/drawing/drawing.ts](src/modules/drawing/drawing.ts) (e inputs de update) com `lastError` / `failedAt` alinhados ao schema.
- [ ] Atualizar [src/modules/drawing/repository/drizzle-drawing-repository.ts](src/modules/drawing/repository/drizzle-drawing-repository.ts) e mapeamento linha → entidade para ler/gravar os novos campos.
- [ ] Garantir que updates parciais não apaguem `last_error` em fluxos que não sejam falha terminal (se aplicável).

## 4. Worker — falha terminal

- [ ] Em [src/infrastructure/queue/drawing-image-generation-worker.ts](src/infrastructure/queue/drawing-image-generation-worker.ts), no ramo terminal do handler `failed`, além de `status: "failed"`, persistir `last_error` (e `failed_at` se existir a coluna), com mensagem/stack resumida conforme política de truncamento.
- [ ] Manter a condição de terminalidade atual: `UnrecoverableError` ou `attemptsMade >= max`.

## 5. API / contrato HTTP

- [ ] Incluir `lastError` e, se exposto, `failedAt` em [src/modules/drawing/drawing-controller.ts](src/modules/drawing/drawing-controller.ts) (`drawingEntitySchema` e respostas GET/POST/PATCH/202 de generate conforme fizer sentido).
- [ ] Garantir que listagem e detalhe de drawing retornem os campos para suporte e UI.

## 6. Operações e documentação

- [ ] Documentar para ops: limites de retenção de jobs `failed` no Redis, truncamento de erros no PG, e opcionalmente apontar **Bull Board** (ou similar) para a fila de geração.
- [ ] Referenciar cruzadamente o research [docs/research/dead-letter-queue-drawing-image-jobs-bullmq.md](docs/research/dead-letter-queue-drawing-image-jobs-bullmq.md) e, se útil, uma linha no [docs/research/async-drawing-image-generation-bullmq.md](docs/research/async-drawing-image-generation-bullmq.md) após implementação.
