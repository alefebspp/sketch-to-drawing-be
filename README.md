# Projeto Rascunho para Desenho — Backend

API em **Fastify** para gerenciar **sketches** (rascunhos), **imagens** e **drawings** (desenhos gerados a partir de um sketch). A geração de imagem para um drawing é **assíncrona** (**BullMQ** + **Redis**), com **transactional outbox** no PostgreSQL para alinhar mudança de estado e publicação na fila, provedor de IA configurável (**OpenAI** ou **Stability**), documentação OpenAPI em `/docs` e painel opcional de filas (**Bull Board**).

Documentação mais detalhada das decisões e do que foi implementado está em [`docs/research/`](docs/research/).

## Stack principal

| Camada                    | Tecnologia                                                            |
| ------------------------- | --------------------------------------------------------------------- |
| HTTP / validação          | Fastify 5, Zod (`fastify-type-provider-zod`)                          |
| Documentação API          | Swagger / OpenAPI em `http://localhost:3000/docs`                     |
| Banco                     | PostgreSQL, Drizzle ORM + migrações                                   |
| Filas                     | BullMQ 5, Redis (`ioredis`)                                           |
| Outbox                    | Tabela `outbox_events`, processo relay dedicado ou embutido no worker |
| Armazenamento de arquivos | Diretório local (`STORAGE_DIR`), servidos em `GET /storage/:filename` |

## O que o projeto implementa

Consulte os arquivos em [`docs/research/`](docs/research/) para o raciocínio completo:

- **[Geração assíncrona (BullMQ)](docs/research/async-drawing-image-generation-bullmq.md)** — `POST /drawings/:id/generate` responde **202** com `status: processing`; um processo **worker** consome a fila `drawing-image-generation`, gera a imagem e atualiza o drawing (`success` / `failed`). `jobId` estável por drawing reduz duplicidade; chamadas enquanto `processing` podem retornar **409**.
- **[Transactional outbox](docs/research/outbox-pattern-drawing-image-generation.md)** — Na mesma transação: atualização do drawing para `processing` e inserção do evento `DrawingImageGenerationRequested` em `outbox_events`. Um **relay** lê eventos pendentes e publica no BullMQ (evita perder o comando se o Redis falhar logo após o commit).
- **[DLQ / retenção de falhas](docs/research/dead-letter-queue-drawing-image-jobs-bullmq.md)** — Jobs falhos retidos no Redis com política `removeOnFail` (quantidade e idade configuráveis). No domínio: `last_error`, `failed_at` e truncamento da mensagem; API expõe `lastError` e `failedAt`.
- **[Validações e rota de geração + OpenAI](docs/research/drawing-validations-generate-openai.md)** — Geração amarrada a um **drawing já existente**; contexto do prompt combina baseline com **`sketch.summary`** (e instrução adicional opcional no body).
- **[Provedor Stability](docs/research/stability-image-generation.md)** — Alternativa ao OpenAI via `IMAGE_PROVIDER=stability`, mesma interface de geração e formatos de saída compatíveis.

## Modelo de domínio (alto nível)

### Sketch

Rascunho do usuário, com imagem associada (`mediaId`) e metadados (`title`, `description`, **`summary`** — usado na composição do prompt de geração).

### Drawing

Desenho ligado a um `sketchId`. Campos relevantes para o fluxo assíncrono:

- `status`: `processing` | `success` | `failed` (ou ausente antes da primeira geração, conforme regra da API).
- `mediaId`: imagem gerada, quando concluída com sucesso.
- `lastError`, `failedAt`: diagnóstico após falha terminal no worker.

### Image / Media

Registro de arquivo no banco (`images`) com nome e URL pública derivada da configuração de storage.

## Pré-requisitos

- **Node.js** 20+ (alinhado ao `@types/node` do projeto)
- **PostgreSQL** acessível via `DATABASE_URL`
- **Redis** (URL ou host/porta/senha) para BullMQ
- Chave do provedor de imagem conforme `IMAGE_PROVIDER` (veja variáveis abaixo)

## Como executar o projeto

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Defina pelo menos:

- `DATABASE_URL` — connection string PostgreSQL
- Redis: `REDIS_URL` **ou** `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` (opcional)
- Provedor de imagem (`IMAGE_PROVIDER`): chaves conforme seção **Variáveis de ambiente**

Opcional útil para URLs de imagem: `PUBLIC_BASE_URL` (default `http://localhost:3000`) e `STORAGE_DIR` (default `var/storage`).

### 3. Migrações do banco

```bash
npm run db:migrate
```

(Alternativas: `npm run db:generate` para gerar migrações após mudar o schema; `npm run db:studio` para inspecionar dados.)

### 4. Subir Redis e PostgreSQL

Garanta que ambos estejam aceitando conexões antes da API e do worker.

### 5. API HTTP

Desenvolvimento (recarrega ao mudar código):

```bash
npm run dev
```

Produção / execução simples:

```bash
npm start
```

Por padrão escuta em `HOST` (default `0.0.0.0`) e `PORT` (default **3000**).

- **OpenAPI UI:** [http://localhost:3000/docs](http://localhost:3000/docs)
- **Arquivos estáticos gravados:** `GET /storage/:filename`

### 6. Worker de geração de imagens (obrigatório para processar filas)

Em outro terminal:

```bash
npm run dev:worker
```

ou `npm run worker`.

### 7. Relay do transactional outbox

Sem relay, os eventos ficam em `outbox_events` e **nenhum job** será publicado no BullMQ.

**Opção A — processo dedicado:**

```bash
npm run dev:relay
```

ou `npm run relay`.

**Opção B — relay embutido no worker:** define `OUTBOX_RELAY_ENABLED=true` ao iniciar o worker (ver comentários em [`src/outbox-relay.ts`](src/outbox-relay.ts) e [`src/worker.ts`](src/worker.ts)).

### 8. Bull Board (painel de filas, opcional)

Na **API**, defina:

```bash
BULL_BOARD_ENABLED=true
```

Opcionalmente `BULL_BOARD_PATH` (default `/admin/queues`). Acesse o painel no path configurado (ex.: [http://localhost:3000/admin/queues](http://localhost:3000/admin/queues)).

## Scripts npm

| Script                                  | Descrição                            |
| --------------------------------------- | ------------------------------------ |
| `npm run dev`                           | API com `ts-node-dev`                |
| `npm start`                             | API com `ts-node`                    |
| `npm run dev:worker` / `npm run worker` | Consumidor BullMQ da fila de geração |
| `npm run dev:relay` / `npm run relay`   | Relay outbox → BullMQ                |
| `npm run db:migrate`                    | Aplica migrações Drizzle             |
| `npm run db:generate`                   | Gera migrações a partir do schema    |
| `npm run db:push`                       | Push do schema (dev)                 |
| `npm run db:studio`                     | Drizzle Studio                       |

## Variáveis de ambiente

### Core

| Variável                                                      | Descrição                                                             |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`                                                | PostgreSQL (obrigatório para API, worker e relay)                     |
| `REDIS_URL` ou `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Conexão Redis para BullMQ                                             |
| `PORT`                                                        | Porta HTTP (default `3000`)                                           |
| `HOST`                                                        | Bind da API (default `0.0.0.0`)                                       |
| `STORAGE_DIR`                                                 | Pasta de uploads (default `var/storage`)                              |
| `PUBLIC_BASE_URL`                                             | Base para URLs públicas das imagens (default `http://localhost:3000`) |

### Provedor de imagem (`IMAGE_PROVIDER`)

| Valor       | Descrição                     |
| ----------- | ----------------------------- |
| `openai`    | Default                       |
| `stability` | Stability AI (sketch control) |

**OpenAI** (`IMAGE_PROVIDER=openai`):

- `OPENAI_API_KEY` — obrigatória
- `OPENAI_HTTP_TIMEOUT_MS` — default `120000`
- `OPENAI_MAX_INPUT_IMAGE_BYTES` — default `4194304`
- `OPENAI_IMAGE_MODEL` — default `dall-e-2`

**Stability** (`IMAGE_PROVIDER=stability`):

- `STABILITY_API_KEY` — obrigatória
- `STABILITY_HTTP_TIMEOUT_MS` — default `120000`
- `STABILITY_MAX_INPUT_IMAGE_BYTES` — default `4194304`
- `STABILITY_OUTPUT_FORMAT` — `png` \| `jpeg` \| `webp` (default `png`)
- `STABILITY_CONTROL_STRENGTH` — opcional

### BullMQ (retenção de jobs falhos)

| Variável                             | Descrição                                        |
| ------------------------------------ | ------------------------------------------------ |
| `BULLMQ_FAILED_JOBS_MAX_COUNT`       | Máximo de jobs `failed` no Redis (default `100`) |
| `BULLMQ_FAILED_JOBS_MAX_AGE_SECONDS` | Idade máxima em segundos (default 7 dias)        |

### Outbox relay

| Variável                           | Descrição                                                    |
| ---------------------------------- | ------------------------------------------------------------ |
| `OUTBOX_RELAY_ENABLED`             | Se `true`, o **worker** também executa o relay em background |
| `OUTBOX_RELAY_POLL_MS`             | Intervalo de poll (default `500`)                            |
| `OUTBOX_RELAY_BATCH_SIZE`          | Eventos por ciclo (default `25`)                             |
| `OUTBOX_RELAY_METRICS_INTERVAL_MS` | Log agregado (default `30000`)                               |
| `OUTBOX_PUBLISH_MAX_ATTEMPTS`      | Tentativas antes de `failed` no outbox (default `25`)        |
| `OUTBOX_PUBLISH_BACKOFF_MS_BASE`   | Base do backoff (default `2000`)                             |
| `OUTBOX_PUBLISHING_STALE_SECONDS`  | Recupera `publishing` preso (default `300`)                  |

### Bull Board

| Variável             | Descrição                                 |
| -------------------- | ----------------------------------------- |
| `BULL_BOARD_ENABLED` | `true` para registrar o painel na API     |
| `BULL_BOARD_PATH`    | Prefixo da rota (default `/admin/queues`) |

## Multi-tenancy (planejado)

Estratégia documentada no histórico do repositório: _shared database / shared schema_; em evolução para MVP, tabelas podem ganhar `tenant_id`.

## Rollout e rollback do provedor de imagem

- Começar com `IMAGE_PROVIDER=openai` em produção.
- Habilitar `IMAGE_PROVIDER=stability` em homologação e validar o fluxo completo (API + worker + relay + Redis).
- Rollback imediato voltando `IMAGE_PROVIDER=openai` e reiniciando API e worker.

## Documentação adicional

- [`docs/research/`](docs/research/) — pesquisas e decisões de arquitetura
- [`docs/decisions/`](docs/decisions/) — ADRs (ex.: fluxo sketch → drawing)
