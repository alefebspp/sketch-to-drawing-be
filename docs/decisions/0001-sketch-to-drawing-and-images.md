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
  - Serviço CRUD e `generateFromSketch(sketchId, prompt?)`.
  - Controller REST incluindo `POST /drawings/generate`.
- Armazenamento de arquivos:
  - Interface `StorageGateway` e implementação local `LocalStorageGateway` (diretório `var/storage` ou `STORAGE_DIR`).
  - Rota de leitura estática `GET /storage/:filename` com Content-Type derivado da extensão.
- IA (geração a partir do esboço):
  - Adaptador `OpenAIImageGenerator` com método `generateFromImage(inputUrl, prompt?)`.
  - Implementação mínima atual: baixa a imagem base e retorna o buffer (pronto para troca por chamada real à API).
- App:
  - Registro de `ImageController` e `DrawingController` em `src/app.ts`.
  - Tags OpenAPI: Images, Drawings, além de Sketches.
  - Registro dinâmico de `@fastify/multipart` se disponível.

## Consequências
- Fluxo completo de upload → persistência → link por `mediaId` → geração de `drawing` via IA → armazenamento e CRUD.
- Facilita substituição futura de storage local por S3 e do adaptador de IA pela API oficial.
- Mantém separação DDD: domínio sem dependências de framework; aplicação orquestra via serviços; infraestrutura concentra persistência/integrações.

## Arquivos Principais
- Imagens: `src/modules/image/**`, `src/infrastructure/storage/**`
- Drawing: `src/modules/drawing/**`, `src/infrastructure/ai/openai-image-generator.ts`
- App: `src/app.ts`

