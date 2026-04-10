# ADR 0001: Sketch → Drawing e Armazenamento de Imagens

## Contexto
- Já existia o módulo `sketch` com CRUD e repositório Drizzle.
- Precisávamos:
  - Salvar imagens e vinculá-las a `sketch` (upload).
  - Criar `drawing` e gerar uma imagem via IA a partir do sketch.

## Decisões
- `Image` como entidade de domínio leve (`Image.ts`) com repositório e serviço:
  - Repositório: `DrizzleImageRepository` persistindo na tabela `images`.
  - Serviço: `ImageService.createFromUpload(file, mime, originalName)` usando `StorageGateway`.
  - Controller: `ImageController` com endpoints REST e upload multipart.
- `Sketch.mediaId` referencia `Image.id` (numérico) convertido para string.
- `Drawing` como entidade de domínio (`Drawing.ts`) com repositório, serviço e controller:
  - Repositório: `DrizzleDrawingRepository` sobre `drawings`.
  - Serviço CRUD e `generateImageForDrawing(drawingId, prompt?)`.
  - Controller REST incluindo `POST /drawings/:id/generate`.
- Armazenamento de arquivos:
  - Interface `StorageGateway` e implementação local `LocalStorageGateway` (diretório `var/storage` ou `STORAGE_DIR`).
  - Rota de leitura estática `GET /storage/:filename` com Content-Type derivado da extensão.
- IA (geração a partir do esboço):
  - Adaptador `OpenAIImageGenerator` com método `generateFromImage(inputUrl, prompt?)`.
  - Implementação atual usa OpenAI `/v1/images/edits` e retorna `Buffer` para upload via `ImageService.createFromUpload`.
- A geração é amarrada a um `drawing` pré-criado:
  - O endpoint recebe `drawingId` na URL, localiza o `sketchId` vinculado ao drawing e gera uma nova mídia.
  - O `drawing` existente é atualizado com o novo `mediaId` (em vez de criar novo drawing via `sketchId` no body).
- App:
  - Registro de `ImageController` e `DrawingController` em `src/app.ts`.
  - Tags OpenAPI: Images, Drawings, além de Sketches.
  - Registro dinâmico de `@fastify/multipart` se disponível.

## Consequências
- Fluxo completo de upload → persistência → link por `mediaId` → geração de mídia para drawing existente via IA → atualização de `mediaId` no drawing e CRUD.
- Facilita substituição futura de storage local por S3 e do adaptador de IA pela API oficial.
- Mantém separação DDD: domínio sem dependências de framework; aplicação orquestra via serviços; infraestrutura concentra persistência/integrações.

## Arquivos Principais
- Imagens: `src/modules/image/**`, `src/infrastructure/storage/**`
- Drawing: `src/modules/drawing/**`, `src/infrastructure/ai/openai-image-generator.ts`
- App: `src/app.ts`

