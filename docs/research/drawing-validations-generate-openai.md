# Research: Validações de Drawing, rota de geração e OpenAIImageGenerator

## Questions

- Como está implementado hoje o CRUD de drawings, a geração a partir de sketch e o adaptador de IA?
- Quais padrões o projeto já usa para validar relacionamentos (ex.: sketch ↔ image)?
- Onde estão os pontos de integração (repositórios, `ImageService`, OpenAPI/Fastify)?
- Como alinhar o fluxo de geração a um drawing **já existente** (id na URL) em vez de criar um novo registro via `sketchId` no body?
- Qual API/modelo da OpenAI faz sentido para “rascunho → desenho” a partir de URL da imagem do sketch, e como devolver um `Buffer` compatível com `ImageService.createFromUpload`?

## Findings

### Implementação atual

- **`DrawingService`**: `create` valida a existência de `sketchId` via `assertSketchExists`; `update` garante que o **drawing** exista e, quando `sketchId` é informado, valida o sketch antes de persistir. `generateImageForDrawing(drawingId, prompt?)` carrega o drawing e o sketch associado, resolve `mediaId` do sketch para id numérico de `Image`, obtém a URL com `ImageService.getByIdOrThrow`, chama `OpenAIImageGenerator.generateFromImage`, grava a saída com `ImageService.createFromUpload` e por fim faz **`repo.update`** no drawing existente, preenchendo `mediaId` com o id da imagem gerada.
- **`DrawingController`**: `POST /drawings/generate` usa `generateBodySchema` com **`sketchId` obrigatório** no body e `prompt` opcional; resposta **201** com o drawing criado.
- **`SketchService`**: já estabelece precedente de validação de relacionamento: em `create`/`update`, se `mediaId` vier definido, garante que existe registro em `images` via `DrizzleImageRepository` (`assertMediaExistsIfProvided`).
- **`OpenAIImageGenerator`**: usa `POST /v1/images/edits` com `OPENAI_API_KEY`, timeout configurável, limite de tamanho de input e validação de PNG para edição. O prompt efetivo é calculado por fallback (`prompt?.trim() || DEFAULT_EDIT_PROMPT`) e enviado como prompt único para a API; a interface `ImageGenerator` segue com `generateFromImage(inputUrl, prompt?)`.
- **ADR 0001** (`docs/decisions/0001-sketch-to-drawing-and-images.md`): descreve o fluxo legado com `POST /drawings/generate` e criação de drawing após geração; a evolução pedida (id do drawing na URL + atualização de `mediaId`) implica revisar esse trecho da documentação de decisão quando a implementação for feita.

### Padrões do projeto

- Erros de “não encontrado”: `NotFoundError` em serviços; controllers confiam na validação Zod + serviço.
- IDs de imagem no domínio costumam trafegar como **string** em `Sketch`/`Drawing` (`mediaId`, `sketchId`), com parsing numérico onde necessário (vide `SketchService.assertMediaExistsIfProvided` e `generateImageForDrawing` para `mediaId` do sketch).
- Persistência de arquivo gerado: **`ImageService.createFromUpload`** → `LocalStorageGateway` + linha em `images`; é o caminho natural após a IA retornar bytes.

### Pontos de integração para as mudanças pedidas

1. **Validar sketch na criação/atualização do drawing**: espelhar a ideia de `SketchService` — ao receber `sketchId` em `create` ou em `update` (quando parcial incluir `sketchId`), resolver id (número) e chamar `SketchService.getByIdOrThrow` ou equivalente no repositório, sem duplicar regra em controller.
2. **Rota de geração**: substituir `POST /drawings/generate` com body `sketchId` por algo como **`POST /drawings/:id/generate`** (ou variante explícita no router), com `:id` = id do drawing; body apenas com `prompt` opcional. Registrar rota **depois** de rotas mais específicas se houver conflito com `GET /drawings/:id` (no Fastify, ordem de registro importa para `POST` vs `GET` — em geral `POST .../generate` como path estático pode continuar sendo um segmento dedicado; a opção **`/drawings/:id/generate`** evita colisão com lista).
3. **`generateFromSketch` (nome e assinatura)**: passar a receber **`drawingId`** (ou renomear método para refletir “gerar mídia para drawing existente”). Fluxo: `getByIdOrThrow(drawingId)` → interpretar `drawing.sketchId` como id do sketch → `getByIdOrThrow(sketchId)` → mesma cadeia de imagem base → `generateFromImage` → `createFromUpload` → **`repo.update(drawingId, { mediaId: String(newImage.id) })`** e retornar o drawing atualizado. Casos limite: drawing sem `sketchId` válido, sketch sem `mediaId` válido (já parcialmente cobertos por erros atuais ao buscar sketch/imagem).
4. **`OpenAIImageGenerator.generateFromImage`**: trocar o placeholder por chamada real — candidatos típicos: **`POST /v1/images/edits`** (imagem + prompt) ou fluxo multimodal mais novo conforme documentação oficial, conforme modelo escolhido (`gpt-image-1`, `dall-e-2` em edits, etc.). É necessário: autenticação com `OPENAI_API_KEY`, tratamento de erros HTTP da API, possível limite de tamanho/formato da imagem de entrada (PNG com transparência em alguns endpoints), timeout HTTP mais alto que o padrão se a doc recomendar para edições pesadas, e decodificação da resposta (URL temporária vs base64) para obter **`Buffer`** final em PNG/WebP/JPEG aceitos por `ImageService` (`image/png`, `image/jpeg`, `image/webp`).
5. **Contexto por `summary` + prompt composto**: no fluxo de geração do drawing, o contexto deve vir de `sketch.summary` (em vez de exigir prompt do chamador), e o prompt enviado ao gerador deve ser a junção de `DEFAULT_EDIT_PROMPT` com esse contexto para manter baseline visual consistente e, ao mesmo tempo, incorporar semântica do rascunho.

## Recommendations

- **Validação de sketch em `DrawingService`**: extrair algo como `assertSketchExists(sketchId: string)` (validar formato numérico + `SketchService.getByIdOrThrow`) e invocar em `create` sempre que `sketchId` estiver presente e em `update` quando `input.sketchId !== undefined`. Manter invariante de negócio no serviço de aplicação, alinhado ao que já existe em `SketchService` para `mediaId`.
- **API REST**: mudar para **`POST /drawings/:id/generate`**, schema de params com `id` positivo, body só `{ prompt?: string }`, OpenAPI atualizado; código HTTP sugerido **200** com drawing atualizado (ou **201** só se o time quiser manter semântica de “recurso criado” para a imagem — o mais coerente com “atualizar drawing” é **200**).
- **Serviço `generateFrom*`**: manter nome explícito (`generateImageForDrawing`) e usar `sketch.summary` como contexto principal da geração, evitando dependência de prompt obrigatório no caso de uso. Documentar que `mediaId` anterior (se houver) permanece no storage até política de limpeza existir.
- **OpenAI**: manter `generateFromImage` em **`/images/edits`**, garantindo que o prompt efetivo combine baseline (`DEFAULT_EDIT_PROMPT`) com contexto de `summary` para preservar estilo alvo e reduzir ambiguidade do resultado. Garantir que o buffer retornado corresponda a um MIME permitido por `ImageService.createFromUpload` ou converter antes do upload.
- **Testes/manuais**: após implementação, validar drawing sem sketch, sketch sem imagem, e falhas da API OpenAI (mensagem de erro amigável vs stack cru).
- **ADR**: atualizar ADR 0001 ou adicionar ADR curto descrevendo “geração amarra a um drawing pré-criado e atualiza `mediaId`”, para não divergir da documentação interna.

## Files Examined

- `docs/research/template.md` — estrutura do research.
- `src/modules/drawing/drawing-service.ts` — CRUD, `generateImageForDrawing`, integração com sketch/image/generator.
- `src/modules/drawing/drawing-controller.ts` — rotas, Zod, `POST /drawings/generate` atual.
- `src/modules/drawing/drawing.ts` — shape de `Drawing`.
- `src/modules/drawing/repository/drizzle-drawing-repository.ts` — `create`/`update` e mapeamento de colunas.
- `src/modules/sketch/sketch-service.ts` — padrão de validação `mediaId` → imagem existe.
- `src/modules/sketch/sketch.ts` — shape de `Sketch`.
- `src/modules/image/image-service.ts` — `createFromUpload`, MIMEs permitidos.
- `src/infrastructure/ai/openai-image-generator.ts` — integração com OpenAI `/images/edits`, prompt default e interface `ImageGenerator`.
- `docs/decisions/0001-sketch-to-drawing-and-images.md` — decisões arquiteturais e fluxo legado documentado.
