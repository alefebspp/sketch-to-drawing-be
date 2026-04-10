# Objetivo

Permitir que usuários desenhem rascunhos que servirão de base para IA gerar imagens

# Entidades

## Sketch

Rascunho feito por usuário. Pode conter detalhes para ajudar a IA a gerar imagens

id: int (incremental)
media_id: string;
title?: string;
description?: string;
summary?: string;

## Drawing

Imagem gerada a partir de um Sketch

id: int (incremental)
media_id: string;
title?: string;
description?: string;
sketch_id: string;

## Media

Guarda informações de acesso a imagens gerados de Sketch ou Drawing

id: int (incremental)
filename: string
url: string

# Funcionalidades

## Gerar um Drawing a partir de um Skecth

Para isso, precisa que seja gerada uma imagem do rascunho para servir de referência para a geração do Drawing. Enviar imagem do Sketch para a IA gerar um Drawing.

# Abordagens técnicas

## Multi-tenancy

Será usada a estratégia de shared database - shared schema, uma vez que o projeto está em início. Caso realmente vire um mvp, cada tabela terá uma coluna nova chamada tenant_id.
# sketch-to-drawing-be

## Environment Variables

Image generation provider is selected with `IMAGE_PROVIDER`:

- `IMAGE_PROVIDER=openai` (default)
- `IMAGE_PROVIDER=stability`

### OpenAI provider

- `OPENAI_API_KEY` (required when `IMAGE_PROVIDER=openai`)
- `OPENAI_HTTP_TIMEOUT_MS` (default: `120000`)
- `OPENAI_MAX_INPUT_IMAGE_BYTES` (default: `4194304`)
- `OPENAI_IMAGE_MODEL` (default: `dall-e-2`)

### Stability provider

- `STABILITY_API_KEY` (required when `IMAGE_PROVIDER=stability`)
- `STABILITY_HTTP_TIMEOUT_MS` (default: `120000`)
- `STABILITY_MAX_INPUT_IMAGE_BYTES` (default: `4194304`)
- `STABILITY_OUTPUT_FORMAT` (default: `png`, allowed: `png|jpeg|webp`)
- `STABILITY_CONTROL_STRENGTH` (optional, positive number)

## Rollout and rollback

- Start with `IMAGE_PROVIDER=openai` in production.
- Enable `IMAGE_PROVIDER=stability` in homologation and validate drawing generation flow.
- Rollback is immediate by switching `IMAGE_PROVIDER` back to `openai` and restarting the service.
