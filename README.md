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
