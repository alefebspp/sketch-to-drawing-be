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

- [ ] Remover ou depreciar `POST /drawings/generate` com `sketchId` obrigatório no body.
- [ ] Registrar **`POST /drawings/:id/generate`** com atenção à ordem das rotas no Fastify (evitar conflito com `GET /drawings/:id`; segmento `generate` costuma ser suficiente).
- [ ] Schema de params: `id` positivo / formato alinhado ao restante da API.
- [ ] Body: apenas `{ prompt?: string }` (Zod).
- [ ] Resposta: **200** com o drawing atualizado (preferência do research; alinhar com o time se quiserem 201 por “sub-recurso criado”).
- [ ] Atualizar especificação OpenAPI para a nova rota, parâmetros e corpo.

## 3. Caso de uso de geração — atualizar drawing em vez de criar

- [ ] Renomear ou substituir `generateFromSketch` por nome que deixe claro o comportamento (ex.: `generateImageForDrawing`), recebendo **`drawingId`**.
- [ ] Fluxo: `DrawingService.getByIdOrThrow(drawingId)` → obter `sketchId` do drawing → `SketchService.getByIdOrThrow(sketchId)` → resolver URL da imagem base (`ImageService.getByIdOrThrow` conforme implementação atual) → `ImageGenerator.generateFromImage` → `ImageService.createFromUpload` → **`repo.update(drawingId, { mediaId: String(newImage.id) })`** → retornar drawing atualizado.
- [ ] Documentar (comentário breve ou doc interna) que `mediaId` antigo pode permanecer no storage até existir política de limpeza.
- [ ] Tratar casos limite com mensagens coerentes: drawing sem `sketchId` válido; sketch sem mídia válida; falhas da API OpenAI (ver seção 5).

## 4. OpenAIImageGenerator — implementação real

- [ ] Substituir placeholder por chamada à API escolhida (ex.: **`POST /v1/images/edits`** com imagem + prompt, ou fluxo alinhado ao produto “rascunho → desenho”).
- [ ] Usar autenticação com `OPENAI_API_KEY` (ou variáveis já usadas no projeto).
- [ ] Configurar timeout HTTP adequado para edições, se a documentação OpenAI recomendar tempos maiores.
- [ ] Tratar erros HTTP da OpenAI e mapear para erros de aplicação legíveis (evitar stack cru na resposta HTTP).
- [ ] Respeitar limites de tamanho/formato da imagem de entrada (ex.: PNG com transparência em alguns endpoints).
- [ ] Obter **`Buffer`** final em MIME aceito por `ImageService.createFromUpload` (`image/png`, `image/jpeg`, `image/webp`); se a API retornar URL temporária ou base64, decodificar/converter antes do upload.

## 5. Testes e validação manual

- [ ] Cenário: drawing **sem** `sketchId` (ou inválido) ao chamar geração.
- [ ] Cenário: sketch **sem** `mediaId` / imagem inexistente.
- [ ] Cenário: falha da API OpenAI (timeout, validação, créditos) — resposta e log tratáveis.
- [ ] Cenário feliz: geração atualiza `mediaId` e retorno reflete o drawing atualizado.
- [ ] (Opcional) Adicionar ou estender testes automatizados onde o projeto já cobre serviços/controllers (se existir infraestrutura de teste).

## 6. Documentação de decisão

- [ ] Atualizar `docs/decisions/0001-sketch-to-drawing-and-images.md` **ou** criar ADR curto descrevendo: geração amarra a um drawing pré-criado e atualiza `mediaId` (em vez de criar novo drawing via `sketchId` no body).

---

## Ordem sugerida de execução

1. Validação de `sketchId` no `DrawingService` (item 1) — base estável para CRUD.
2. Novo fluxo de geração no serviço (item 3) e rota/controller (item 2).
3. Implementação OpenAI (item 4).
4. OpenAPI + testes manuais (itens 2, 5).
5. ADR (item 6).
