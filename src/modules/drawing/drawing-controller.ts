import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { DrawingService } from "./drawing-service";
import type { Drawing } from "./drawing";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createBodySchema = z.object({
  mediaId: z.string().trim().min(1),
  sketchId: z.string().trim().min(1),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
});

const updateBodySchema = z.object({
  mediaId: z.string().trim().min(1).optional(),
  sketchId: z.string().trim().min(1).optional(),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
});

const generateBodySchema = z.object({
  sketchId: z.coerce.number().int().positive(),
  prompt: z.string().trim().max(500).optional(),
});

export class DrawingController {
  private readonly service: DrawingService = new DrawingService();

  constructor(app: FastifyInstance) {
    this.registerRoutes(app);
  }

  private registerRoutes(app: FastifyInstance): void {
    app.get(
      "/drawings",
      {
        schema: {
          tags: ["Drawings"],
          summary: "Listar drawings",
          response: {
            200: {
              type: "object",
              properties: {
                data: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "number" },
                      mediaId: { type: "string" },
                      sketchId: { type: "string" },
                      title: { type: "string" },
                      description: { type: "string" },
                    },
                    required: ["id", "mediaId", "sketchId"],
                  },
                },
              },
              required: ["data"],
            },
          },
        },
      },
      async (_req, reply) => {
        const data = await this.service.getAll();
        return reply.status(200).send({ data });
      }
    );

    app.get(
      "/drawings/:id",
      {
        schema: {
          tags: ["Drawings"],
          summary: "Buscar drawing por id",
          params: {
            type: "object",
            properties: { id: { type: "number" } },
            required: ["id"],
          },
          response: {
            200: {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    mediaId: { type: "string" },
                    sketchId: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["id", "mediaId", "sketchId"],
                },
              },
              required: ["data"],
            },
            404: {
              type: "object",
              properties: { error: { type: "string" } },
              required: ["error"],
            },
          },
        },
      },
      async (req: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse((req.params ?? {}) as unknown);
        const data = await this.service.getByIdOrThrow(id);
        return reply.status(200).send({ data });
      }
    );

    app.post(
      "/drawings",
      {
        schema: {
          tags: ["Drawings"],
          summary: "Criar drawing",
          body: {
            type: "object",
            properties: {
              mediaId: { type: "string" },
              sketchId: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
            },
            required: ["mediaId", "sketchId"],
          },
          response: {
            201: {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    mediaId: { type: "string" },
                    sketchId: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["id", "mediaId", "sketchId"],
                },
              },
              required: ["data"],
            },
          },
        },
      },
      async (req: FastifyRequest, reply: FastifyReply) => {
        const body = createBodySchema.parse((req.body ?? {}) as unknown);
        const created = await this.service.create({
          mediaId: body.mediaId,
          sketchId: body.sketchId,
          title: body.title,
          description: body.description,
        });
        return reply.status(201).send({ data: created });
      }
    );

    app.put(
      "/drawings/:id",
      {
        schema: {
          tags: ["Drawings"],
          summary: "Atualizar drawing",
          params: {
            type: "object",
            properties: { id: { type: "number" } },
            required: ["id"],
          },
          body: {
            type: "object",
            properties: {
              mediaId: { type: "string" },
              sketchId: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
            },
          },
          response: {
            200: {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    mediaId: { type: "string" },
                    sketchId: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["id", "mediaId", "sketchId"],
                },
              },
              required: ["data"],
            },
            404: {
              type: "object",
              properties: { error: { type: "string" } },
              required: ["error"],
            },
          },
        },
      },
      async (req: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse((req.params ?? {}) as unknown);
        const body = updateBodySchema.parse((req.body ?? {}) as unknown);
        const updated = await this.service.update(id, {
          mediaId: body.mediaId,
          sketchId: body.sketchId,
          title: body.title,
          description: body.description,
        });
        return reply.status(200).send({ data: updated });
      }
    );

    app.post(
      "/drawings/generate",
      {
        schema: {
          tags: ["Drawings"],
          summary: "Gerar drawing a partir de sketch",
          body: {
            type: "object",
            properties: {
              sketchId: { type: "number" },
              prompt: { type: "string" },
            },
            required: ["sketchId"],
          },
          response: {
            201: {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    mediaId: { type: "string" },
                    sketchId: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["id", "mediaId", "sketchId"],
                },
              },
              required: ["data"],
            },
          },
        },
      },
      async (req: FastifyRequest, reply: FastifyReply) => {
        const body = generateBodySchema.parse((req.body ?? {}) as unknown);
        const drawing = await this.service.generateFromSketch(body.sketchId, body.prompt);
        return reply.status(201).send({ data: drawing });
      }
    );

    app.delete(
      "/drawings/:id",
      {
        schema: {
          tags: ["Drawings"],
          summary: "Excluir drawing",
          params: {
            type: "object",
            properties: { id: { type: "number" } },
            required: ["id"],
          },
        },
      },
      async (req: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse((req.params ?? {}) as unknown);
        await this.service.delete(id);
        return reply.status(204).send();
      }
    );
  }
}

