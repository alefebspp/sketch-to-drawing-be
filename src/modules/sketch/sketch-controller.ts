import { z } from "zod";
import { HTTP_STATUS } from "../../consts/http-status";
import type { FastifyZodInstance } from "../../fastify-zod-instance";
import { SketchService } from "./sketch-service";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createBodySchema = z.object({
  mediaId: z.number().min(1).optional(),
  title: z.string().trim().max(200),
  description: z.string().trim().max(2000).optional(),
  summary: z.string().trim().max(500),
});

const updateBodySchema = z.object({
  mediaId: z.number().min(1).optional(),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  summary: z.string().trim().max(500).optional(),
});

const sketchEntitySchema = z.object({
  id: z.number(),
  mediaId: z.number().optional(),
  title: z.string(),
  description: z.string().optional(),
  summary: z.string(),
});

export class SketchController {
  private readonly service: SketchService = new SketchService();

  constructor(app: FastifyZodInstance) {
    this.registerRoutes(app);
  }

  private registerRoutes(app: FastifyZodInstance): void {
    app.get(
      "/sketches",
      {
        schema: {
          tags: ["Sketches"],
          summary: "Listar todos os sketches",
          response: {
            200: z.object({ data: z.array(sketchEntitySchema) }),
          },
        },
      },
      async (_req, reply) => {
        const data = await this.service.getAll();
        return reply.status(HTTP_STATUS.OK).send({ data });
      }
    );

    app.get(
      "/sketches/:id",
      {
        schema: {
          tags: ["Sketches"],
          summary: "Buscar sketch por id",
          params: idParamSchema,
          response: {
            200: z.object({ data: sketchEntitySchema }),
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
      "/sketches",
      {
        schema: {
          tags: ["Sketches"],
          summary: "Criar um novo sketch",
          body: createBodySchema,
          response: {
            201: z.object({ data: sketchEntitySchema }),
          },
        },
      },
      async (req, reply) => {
        const body = createBodySchema.parse(req.body);
        const data = await this.service.create(body);
        return reply.status(HTTP_STATUS.CREATED).send({ data });
      }
    );

    app.put(
      "/sketches/:id",
      {
        schema: {
          tags: ["Sketches"],
          summary: "Atualizar um sketch",
          params: idParamSchema,
          body: updateBodySchema,
          response: {
            200: z.object({ data: sketchEntitySchema }),
          },
        },
      },
      async (req, reply) => {
        const { id } = req.params;

        const body = updateBodySchema.parse(req.body);

        const data = await this.service.update(id, body);

        return reply.status(HTTP_STATUS.OK).send({ data });
      }
    );

    app.delete(
      "/sketches/:id",
      {
        schema: {
          tags: ["Sketches"],
          summary: "Excluir um sketch",
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
