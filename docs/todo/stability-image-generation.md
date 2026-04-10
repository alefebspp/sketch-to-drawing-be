# TODO: Migração de geração de imagem para Stability

Tarefas derivadas de `docs/research/stability-image-generation.md`.

## Descrição resumida

- Preservar o contrato atual consumido pelo `DrawingService` (`generateFromImage(inputUrl, prompt?) => Promise<Buffer>`).
- Implementar `StabilityImageGenerator` com compatibilidade de MIME (`png`, `jpeg`, `webp`) e semântica de erros equivalente ao provider atual.
- Introduzir seleção de provider por env var para rollout progressivo com rollback rápido.
- Validar fluxo fim a fim (drawing -> sketch -> image -> generator -> upload) sem regressão funcional.

---

## 1. Contrato e compatibilidade com o fluxo atual

- [x] Confirmar no código que o contrato de `ImageGenerator` permanece inalterado para consumo em `DrawingService`.
- [x] Garantir que o retorno do novo provider seja `Buffer` e continue compatível com `ImageService.createFromUpload`.
- [x] Reutilizar `sniffImageMime` (ou util compartilhado equivalente) para validar saída apenas em `image/png`, `image/jpeg` ou `image/webp`.
- [x] Preservar composição de prompt com baseline `DEFAULT_EDIT_PROMPT` + contexto de `summary` + prompt adicional opcional.

## 2. Implementação do `StabilityImageGenerator`

- [x] Criar `src/infrastructure/ai/stability-image-generator.ts` implementando a mesma interface `ImageGenerator`.
- [x] Implementar `generateFromImage(inputUrl: string, prompt?: string): Promise<Buffer>`.
- [x] Baixar `inputUrl` para `Buffer` respeitando timeout e limite máximo configurado.
- [x] Enviar requisição `multipart/form-data` para endpoint de sketch control da Stability com autenticação Bearer.
- [x] Configurar `Accept: image/*` e processar bytes de imagem diretamente na resposta.
- [x] Restringir `output_format` para `png|jpeg|webp` visando compatibilidade com detecção de MIME.
- [x] Confirmar parâmetros finais do endpoint na documentação oficial da Stability durante a implementação (API beta pode mudar).

## 3. Configuração por ambiente

- [x] Adicionar e documentar `STABILITY_API_KEY` como obrigatória para provider Stability.
- [x] Adicionar `STABILITY_HTTP_TIMEOUT_MS` com default sugerido `120000`.
- [x] Adicionar `STABILITY_MAX_INPUT_IMAGE_BYTES` com default sugerido `4194304`.
- [x] Adicionar `STABILITY_OUTPUT_FORMAT` com default `png` e whitelist `png|jpeg|webp`.
- [x] Adicionar `STABILITY_CONTROL_STRENGTH` como opcional, com default conservador quando suportado.

## 4. Mapeamento de erros (equivalência funcional)

- [x] Mapear `401/403` para `AppError(502, "Image generation service authentication failed")`.
- [x] Mapear `429` para `AppError(502, "Image generation rate limited; try again later")`.
- [x] Mapear `5xx` para `AppError(502, "Image generation service temporarily unavailable")`.
- [x] Mapear `400/413/422` para `BadRequestError("Image generation request was rejected")`.
- [x] Tratar resposta sem bytes válidos de imagem como `AppError(502, "Image generation returned no image data")`.
- [x] Garantir logs curtos com status HTTP e payload truncado sem dados sensíveis.

## 5. Factory e estratégia de rollout

- [x] Introduzir factory simples por env var (ex.: `IMAGE_PROVIDER=openai|stability`) sem alterar `DrawingService`.
- [x] Manter OpenAI como provider default inicial.
- [x] Habilitar Stability primeiro em homologação via configuração.
- [x] Garantir rollback rápido para OpenAI apenas trocando env var.

## 6. Documentação e alinhamento

- [x] Atualizar documentação técnica relevante (research/ADR) com decisão de provider por factory.
- [x] Registrar defaults e exemplos de configuração de ambiente para desenvolvimento e homologação.
- [x] Documentar procedimento de rollout e rollback operacional.

---

## Ordem sugerida de execução

1. Implementação de `StabilityImageGenerator` + configurações (itens 2 e 3).
2. Mapeamento de erros e logs (item 4).
3. Factory por env var e integração no fluxo atual (item 5).
4. Documentação final e alinhamento operacional (item 7).
