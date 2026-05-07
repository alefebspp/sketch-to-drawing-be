# TODO: Transactional Outbox para geração de imagem do drawing

Tarefas derivadas de `docs/research/outbox-pattern-drawing-image-generation.md`.

## Descrição resumida

- Garantir atomicidade entre atualização de estado do `drawing` (`processing`) e o comando assíncrono de geração, via **Transactional Outbox**.
- Introduzir tabela `outbox_events` como fonte de verdade para mensagens pendentes e um **relay** que publica no BullMQ com retry e lock.
- Preservar idempotência no consumo (`jobId` estável, opcionalmente `eventId`) e definir observabilidade mínima (métricas, logs, alertas).
- Migrar do enqueue direto no `DrawingService` para o fluxo transacional + relay, com rollout gradual e remoção do caminho legado.

---

## 1. Modelo de dados e migrações

- [ ] Criar tabela `outbox_events` com campos alinhados ao research: `id`, `aggregate_type`, `aggregate_id`, `event_type`, `payload` (jsonb), `status`, `attempts`, `next_attempt_at`, `last_error`, `created_at`, `published_at`.
- [ ] Definir enum ou constraint para `status`: `pending`, `publishing`, `published`, `failed`.
- [ ] Criar índice adequado para leitura do relay por `status` + `next_attempt_at` (e demais colunas necessárias à query de polling).
- [ ] Gerar e revisar migration Drizzle (ou pipeline de migração adotado no projeto).

## 2. Fluxo transacional na API / aplicação

- [ ] Alterar o caso de uso de enfileiramento (ex.: `enqueueGenerateImageForDrawing`) para, **no mesmo commit**:
  - atualizar o drawing para `processing` (limpando `lastError` e `failedAt` conforme regra atual);
  - inserir evento `DrawingImageGenerationRequested` em `outbox_events` com `pending` e payload (`drawingId`, `prompt`, etc.).
- [ ] Garantir que não exista caminho que grave `processing` sem linha correspondente na outbox na mesma transação.
- [ ] Remover ou isolar o enqueue direto ao BullMQ deste fluxo após a transação estar consolidada (ver seção 7).

## 3. Relay (publicação assíncrona para BullMQ)

- [ ] Implementar processo ou serviço de relay com polling curto para eventos `pending` aptos (`next_attempt_at`).
- [ ] Usar lock otimista ou pessimista para evitar publicação duplicada por instâncias concorrentes do relay.
- [ ] Publicar jobs no BullMQ a partir do payload do outbox; em sucesso, marcar evento `published` e `published_at`.
- [ ] Em falha de publish: incrementar `attempts`, registrar `last_error`, reagendar com backoff; respeitar limite máximo para eventos _poison_ (`failed` para intervenção manual).
- [ ] Tratar indisponibilidade temporária do Redis/BullMQ sem perda de eventos (evento permanece retentável).

## 4. Idempotência e duplicidade

- [ ] Manter `jobId` estável baseado em `drawingId` (ou política equivalente já adotada) na publicação a partir do outbox.
- [ ] Opcional: propagar `eventId` / correlação para rastreio ponta a ponta (logs e métricas).
- [ ] Garantir que reprocessamento do relay/worker não altere o estado final do drawing de forma duplicada observável.

## 5. Worker e domínio

- [ ] Revisar `processImageGenerationJob` (ou equivalente) para consumo idempotente com o novo fluxo de origem (outbox → fila).
- [ ] Manter atualização terminal para `success` / `failed` e alinhamento com tratamento de falhas do worker existente.

## 6. Observabilidade e operação

- [ ] Expor ou coletar métricas: total de eventos `pending`, idade do pendente mais antigo, taxa de publish com sucesso/erro, tentativas por evento.
- [ ] Padronizar logs estruturados com `event_id`, `drawing_id`, `job_id` onde aplicável.
- [ ] Definir alertas quando backlog ou idade pendente ultrapassar SLO acordado.

## 7. Estratégia de migração e desligamento do legado

- [ ] Introduzir relay em processo separado ou colocalizado no worker, com rollout gradual.
- [ ] Habilitar monitoração e alertas antes ou junto ao corte amplo de tráfego.
- [ ] Remover o caminho legado de enqueue direto no service após validação em produção (ou ambiente alvo).

---

## Ordem sugerida de execução

1. Modelo de dados e migrações (seção 1).
2. Fluxo transacional na aplicação (seção 2), ainda possivelmente com feature flag se o projeto usar.
3. Relay mínimo + publicação BullMQ + retry (seção 3).
4. Idempotência e ajustes no worker (seções 4 e 5).
5. Observabilidade (seção 6).
6. Migração gradual e remoção do enqueue direto (seção 7).
7. Checklist de critérios de aceite (seção 8).
