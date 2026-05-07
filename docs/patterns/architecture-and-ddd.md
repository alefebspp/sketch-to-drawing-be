# Padrões de Arquitetura e DDD

## Camadas
- Domínio (entities como contratos): `Image`, `Drawing`, `Sketch` definidos como interfaces simples.
- Aplicação (serviços orquestradores): `ImageService`, `DrawingService`, `SketchService`.
- Infraestrutura: 
  - Persistência (Drizzle): repositórios `Drizzle*Repository` e `schema`.
  - Integrações: `StorageGateway` (local), `OpenAIImageGenerator` (IA).
- Interface: Controllers Fastify por módulo.

## Repositórios
- Contratos por módulo (e.g., `ImageRepository`, `DrawingRepository`).
- Implementações Drizzle mapeando 1–1 para tabelas (`images`, `drawings`, `sketches`).
- Conversão de linhas → entidades via métodos `mapRowTo*`.

## Serviços de Aplicação
- CRUD simples delegando ao repositório.
- Regras de orquestração:
  - `ImageService.createFromUpload`: valida MIME, salva via storage, persiste metadados.
  - `DrawingService.generateFromSketch`: resolve `Sketch` → `Image` base, gera via IA, salva imagem, cria `Drawing`.

## Controllers
- Responsáveis por:
  - Validar formato (Zod).
  - Chamar serviços.
  - Retornar objetos simples (interfaces) diretamente.
- Rotas:
  - `Images`: upload multipart, GET/DELETE.
  - `Drawings`: CRUD + `POST /drawings/generate`.
  - `Sketches`: CRUD existente.

## Storage
- `StorageGateway.save(file, mime, originalName?) → { url, filename, mime, size }`.
- Implementação local salva em `var/storage` (ou `STORAGE_DIR`) com URL pública em `/storage/:filename`.

## IA
- `OpenAIImageGenerator.generateFromImage(url, prompt?) → Buffer`.
- Implementação atual é minimalista (placeholder); pronta para troca por chamada real.

## Convenções
- `mediaId` nos aggregates referencia `Image.id` como string.
- Entidades de domínio representadas por interfaces: sem métodos; validações e normalizações ocorrem nas bordas (controllers/serviços) e na persistência quando necessário.
- Sem dependências de framework no domínio; apenas tipos/contratos.

## Racional para interfaces no Domínio
- Simplicidade e ubiquidade: contratos claros e leves, iguais a `Sketch`.
- Evita métodos stateful (`toPrimitives`, `change*`) e reduz acoplamento entre camadas.
- Facilita (de/serialização) e testabilidade, mantendo regras de negócio concentradas em serviços de aplicação ou políticas específicas quando necessário.

