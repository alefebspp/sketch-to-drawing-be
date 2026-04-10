# TODO: Validações de Drawing, rota de geração e OpenAIImageGenerator

Tarefas derivadas de `docs/research/drawing-validations-generate-openai.md`.

## Descrição resumida

- Garantir que `sketchId` em drawing aponte para sketch existente (criação e atualização).
- Trocar geração de “novo drawing a partir de `sketchId` no body” por “gerar mídia para drawing existente” (`POST /drawings/:id/generate`).
- Implementar geração real no `OpenAIImageGenerator` e manter compatibilidade com `ImageService.createFromUpload`.
- Atualizar contratos (OpenAPI), testes manuais/cenários de erro e documentação de decisão (ADR 0001 ou novo ADR).

---

## 1. DrawingService — validação de relacionamento sketch

- [x] Extrair helper no serviço (ex.: `assertSketchExists(sketchId: string)`: validar formato numérico quando aplicável + `SketchService.getByIdOrThrow`), espelhando o padrão de `assertMediaExistsIfProvided` do `SketchService`.
- [x] Em `create`, quando `sketchId` estiver presente, chamar a validação antes de persistir.
- [x] Em `update`, quando `input.sketchId !== undefined`, chamar a validação antes de persistir.
- [x] Garantir que controllers não duplicam essa regra (apenas formato/params via Zod).

## 2. Rota e controller — geração amarrada ao drawing existente

- [x] Remover ou depreciar `POST /drawings/generate` com `sketchId` obrigatório no body.
- [x] Registrar **`POST /drawings/:id/generate`** com atenção à ordem das rotas no Fastify (evitar conflito com `GET /drawings/:id`; segmento `generate` costuma ser suficiente).
- [x] Schema de params: `id` positivo / formato alinhado ao restante da API.
- [x] Body: apenas `{ prompt?: string }` (Zod).
- [x] Resposta: **200** com o drawing atualizado (preferência do research; alinhar com o time se quiserem 201 por “sub-recurso criado”).
- [x] Atualizar especificação OpenAPI para a nova rota, parâmetros e corpo.

## 3. Caso de uso de geração — atualizar drawing em vez de criar

- [x] Renomear ou substituir `generateFromSketch` por nome que deixe claro o comportamento (ex.: `generateImageForDrawing`), recebendo **`drawingId`**.
- [x] Fluxo: `DrawingService.getByIdOrThrow(drawingId)` → obter `sketchId` do drawing → `SketchService.getByIdOrThrow(sketchId)` → resolver URL da imagem base (`ImageService.getByIdOrThrow` conforme implementação atual) → `ImageGenerator.generateFromImage` → `ImageService.createFromUpload` → **`repo.update(drawingId, { mediaId: String(newImage.id) })`** → retornar drawing atualizado.
- [x] Documentar (comentário breve ou doc interna) que `mediaId` antigo pode permanecer no storage até existir política de limpeza.
- [x] Tratar casos limite com mensagens coerentes: drawing sem `sketchId` válido; sketch sem mídia válida; falhas da API OpenAI (ver seção 5).

## 4. OpenAIImageGenerator — implementação real

- [x] Substituir placeholder por chamada à API escolhida (ex.: **`POST /v1/images/edits`** com imagem + prompt, ou fluxo alinhado ao produto “rascunho → desenho”).
- [x] Usar autenticação com `OPENAI_API_KEY` (ou variáveis já usadas no projeto).
- [x] Configurar timeout HTTP adequado para edições, se a documentação OpenAI recomendar tempos maiores.
- [x] Tratar erros HTTP da OpenAI e mapear para erros de aplicação legíveis (evitar stack cru na resposta HTTP).
- [x] Respeitar limites de tamanho/formato da imagem de entrada (ex.: PNG com transparência em alguns endpoints).
- [x] Obter **`Buffer`** final em MIME aceito por `ImageService.createFromUpload` (`image/png`, `image/jpeg`, `image/webp`); se a API retornar URL temporária ou base64, decodificar/converter antes do upload.

## 5. Contexto por `summary` + prompt composto

- [x] No fluxo de geração do drawing, usar `sketch.summary` como contexto principal para a IA (sem depender de prompt obrigatório do chamador).
- [x] Montar o prompt efetivo como composição de `DEFAULT_EDIT_PROMPT` + contexto de `sketch.summary`, preservando baseline visual e adicionando semântica do rascunho.
- [x] Garantir fallback seguro quando `summary` vier vazio/ausente (manter `DEFAULT_EDIT_PROMPT` como base mínima).
- [x] Cobrir o comportamento com validação manual/teste: geração com `summary` preenchido e sem `summary`, confirmando que o prompt final continua estável.

## 6. Documentação de decisão

- [x] Atualizar `docs/decisions/0001-sketch-to-drawing-and-images.md` **ou** criar ADR curto descrevendo: geração amarra a um drawing pré-criado e atualiza `mediaId` (em vez de criar novo drawing via `sketchId` no body).

---

## Ordem sugerida de execução

1. Validação de `sketchId` no `DrawingService` (item 1) — base estável para CRUD.
2. Novo fluxo de geração no serviço (item 3) e rota/controller (item 2).
3. Implementação OpenAI (item 4).
4. OpenAPI + testes manuais (itens 2, 5).
5. ADR (item 6).
