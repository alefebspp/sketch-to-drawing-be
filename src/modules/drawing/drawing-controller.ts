import { z } from "zod";
import { HTTP_STATUS } from "../../consts/http-status";
import type { FastifyZodInstance } from "../../fastify-zod-instance";
import { DrawingService } from "./drawing-service";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createBodySchema = z.object({
  sketchId: z.number().min(1),
  title: z.string().trim().max(200),
  description: z.string().trim().max(2000).optional(),
});

const updateBodySchema = z.object({
  mediaId: z.number().min(1).optional(),
  sketchId: z.number().min(1).optional(),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
});

const generatePromptBodySchema = z.object({
  prompt: z.string().trim().max(500).optional(),
});

const drawingStatusSchema = z.enum(["processing", "success", "failed"]);

const drawingEntitySchema = z.object({
  id: z.number(),
  mediaId: z.number().optional(),
  sketchId: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  status: drawingStatusSchema.nullable(),
});

export class DrawingController {
  private readonly service: DrawingService = new DrawingService();

  constructor(app: FastifyZodInstance) {
    this.registerRoutes(app);
  }

  private registerRoutes(app: FastifyZodInstance): void {
    app.get(
      "/drawings",
      {
        schema: {
          tags: ["Drawings"],
          summary: "Listar drawings",
          response: {
            200: z.object({ data: z.array(drawingEntitySchema) }),
          },
        },
      },
      async (_req, reply) => {
        const data = await this.service.getAll();
        return reply.status(HTTP_STATUS.OK).send({ data });
      }
    );

    app.get(
      "/drawings/:id",
      {
        schema: {
          tags: ["Drawings"],
          summary: "Buscar drawing por id",
          params: idParamSchema,
          response: {
            200: z.object({ data: drawingEntitySchema }),
          },
        },
      },
      async (req, reply) => {
        const { id } = req.params;
        const data = await this.service.getByIdOrThrow(id);
        return reply.status(HTTP_STATUS.OK).send({ data });
      }
    );

    app.post(
      "/drawings",
      {
        schema: {
          tags: ["Drawings"],
          summary: "Criar drawing",
          body: createBodySchema,
          response: {
            201: z.object({ data: drawingEntitySchema }),
          },
        },
      },
      async (req, reply) => {
        const body = createBodySchema.parse(req.body);

        const created = await this.service.create(body);
        return reply.status(HTTP_STATUS.CREATED).send({ data: created });
      }
    );

    app.put(
      "/drawings/:id",
      {
        schema: {
          tags: ["Drawings"],
          summary: "Atualizar drawing",
          params: idParamSchema,
          body: updateBodySchema,
          response: {
            200: z.object({ data: drawingEntitySchema }),
          },
        },
      },
      async (req, reply) => {
        const { id } = req.params;

        const body = updateBodySchema.parse(req.body);

        const updated = await this.service.update(id, body);

        return reply.status(HTTP_STATUS.OK).send({ data: updated });
      }
    );

    app.post(
      "/drawings/:id/generate",
      {
        schema: {
          tags: ["Drawings"],
          summary: "Enfileirar geração de mídia para drawing existente (assíncrono)",
          params: idParamSchema,
          body: generatePromptBodySchema,
          response: {
            202: z.object({ data: drawingEntitySchema }),
            409: z.object({ error: z.string() }),
          },
        },
      },
      async (req, reply) => {
        const { id } = req.params;
        const drawing = await this.service.enqueueGenerateImageForDrawing(
          id,
          req.body.prompt
        );
        return reply.status(HTTP_STATUS.ACCEPTED).send({ data: drawing });
      }
    );

    app.delete(
      "/drawings/:id",
      {
        schema: {
          tags: ["Drawings"],
          summary: "Excluir drawing",
          params: idParamSchema,
        },
      },
      async (req, reply) => {
        const { id } = req.params;
        await this.service.delete(id);
        return reply.status(HTTP_STATUS.NO_CONTENT).send();
      }
    );
  }
}
