# Research: Stability Image Generation

## Questions

- Qual contrato atual o gerador precisa manter para substituir `OpenAIImageGenerator` sem quebrar o `DrawingService`?
- Quais pontos do fluxo atual (`drawing -> sketch -> image -> generator -> upload`) dependem de formato/MIME e semantica de erro?
- Como modelar um `StabilityImageGenerator` com a mesma interface (`generateFromImage`) e resultado funcional equivalente?
- Qual estrategia de rollout reduz risco de regressao (troca direta vs factory por env var)?

## Findings

### Contrato atual que precisa ser preservado

- `DrawingService` instancia `OpenAIImageGenerator` e chama `generateFromImage(baseUrl, effectivePrompt)`.
- O metodo esperado retorna `Promise<Buffer>`, e esse `Buffer` vai direto para `ImageService.createFromUpload`.
- O MIME do `Buffer` de saida e inferido por `sniffImageMime`, que aceita:
  - `image/png`
  - `image/jpeg`
  - `image/webp`
- O prompt final usado na geracao vem de `composeGenerationPrompt`:
  - base `DEFAULT_EDIT_PROMPT`
  - + `Sketch context: {summary}`
  - + `Additional instruction: {prompt}` (quando enviado)
- Erros de integracao externa sao traduzidos para erros da aplicacao:
  - 5xx/429 do provedor -> `AppError(502, ...)`
  - rejeicao de payload/entrada -> `BadRequestError(...)`
  - falta de configuracao -> `AppError(503, ...)`

### Comportamento atual relevante para compatibilidade

- Input da geracao e uma URL publica/alcancavel (`inputUrl`) que hoje e baixada no gerador.
- O fluxo atual valida tamanho maximo por env var e timeout HTTP por env var.
- O gerador atual exige PNG no input (regra especifica de `/images/edits` da OpenAI).
- Para substituicao segura, o novo provider nao pode alterar:
  - assinatura do metodo chamado pelo `DrawingService`
  - tipo de retorno (`Buffer`)
  - capacidade de produzir MIME suportado por `sniffImageMime`
  - semantica de falha em erros de rede/rate-limit/indisponibilidade.

### Proposta tecnica: `StabilityImageGenerator`

- Criar `src/infrastructure/ai/stability-image-generator.ts` implementando a mesma interface `ImageGenerator`.
- Manter assinatura:
  - `generateFromImage(inputUrl: string, prompt?: string): Promise<Buffer>`
- Endpoint candidato para caso de uso sketch-to-image:
  - `POST /v2beta/stable-image/control/sketch` (Stability Stable Image API)
- Parametros conferidos na documentacao oficial durante implementacao:
  - `image` (multipart file), `prompt`, `output_format`, `control_strength` (opcional)
  - `Authorization: Bearer <STABILITY_API_KEY>`
  - `Accept: image/*` para receber bytes diretos da imagem
- Forma de requisicao recomendada:
  - baixar `inputUrl` para `Buffer`
  - enviar `multipart/form-data` com imagem + prompt
  - header `Authorization: Bearer ${STABILITY_API_KEY}`
  - header `Accept: image/*` para receber bytes diretamente
  - `output_format` limitado a `png|jpeg|webp` (compatibilidade com `sniffImageMime`)
- Observacao importante:
  - confirmar parametros exatos no momento da implementacao com a documentacao oficial da Stability (campos podem evoluir entre releases beta).

### Configuracoes (env vars) sugeridas

- `STABILITY_API_KEY` (obrigatoria)
- `STABILITY_HTTP_TIMEOUT_MS` (default sugerido: `120000`)
- `STABILITY_MAX_INPUT_IMAGE_BYTES` (default sugerido: `4194304`)
- `STABILITY_OUTPUT_FORMAT` (default sugerido: `png`, permitido: `png|jpeg|webp`)
- `STABILITY_CONTROL_STRENGTH` (opcional, se endpoint suportar; default conservador documentado no proprio servico)

### Mapeamento de erros sugerido (equivalencia funcional)

- `401/403` do provider -> `AppError(502, "Image generation service authentication failed")`
- `429` -> `AppError(502, "Image generation rate limited; try again later")`
- `5xx` -> `AppError(502, "Image generation service temporarily unavailable")`
- `400/413/422` -> `BadRequestError("Image generation request was rejected")`
- resposta sem bytes de imagem validos -> `AppError(502, "Image generation returned no image data")`

## Recommendations

- Introduzir o novo servico sem alterar contrato consumido em `DrawingService`.
- Extrair escolha de provider para factory simples por env var (ex.: `IMAGE_PROVIDER=openai|stability`) para permitir rollout progressivo.
- Reutilizar `sniffImageMime` (ou util compartilhado equivalente) para padronizar validacao de saida entre providers.
- Preservar `DEFAULT_EDIT_PROMPT` como baseline comum entre providers para reduzir variacao do resultado.
- Garantir logs de erro curtos com status HTTP e payload truncado (sem dados sensiveis) para diagnostico de integracao.

### Checklist de validacao manual (sem regressao)

- Geracao com desenho valido retorna imagem persistida e atualiza `drawing.mediaId`.
- Prompt vazio continua gerando com fallback de prompt default.
- Prompt adicional continua influenciando saida sem quebrar fluxo.
- Input image acima do limite configurado retorna erro de cliente coerente.
- Falha 429 e 5xx do provider retorna erro 502 coerente na API.
- MIME retornado pelo provider e detectado como `png`, `jpeg` ou `webp`.

### Estrategia de rollout recomendada

1. Implementar `StabilityImageGenerator` com mesma interface.
2. Introduzir factory de provider mantendo OpenAI como default inicial.
3. Habilitar Stability em ambiente de homologacao via env var.
4. Rodar checklist de validacao funcional com prompts reais de sketch.
5. Promover para producao mantendo possibilidade de rollback por env var.

## Files Examined

- `docs/research/template.md` - estrutura base esperada para documentos de research.
- `src/infrastructure/ai/openai-image-generator.ts` - contrato atual, prompt default, validacoes e mapeamento de erros.
- `src/modules/drawing/drawing-service.ts` - ponto de integracao real do gerador e invariantes de fluxo.
- `docs/research/drawing-validations-generate-openai.md` - referencia de profundidade e estilo de research no projeto.
