import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { SketchService } from "./sketch-service";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createBodySchema = z.object({
  mediaId: z.string().trim().min(1),
  title: z.string().trim().max(200),
  description: z.string().trim().max(2000).optional(),
  summary: z.string().trim().max(500),
});

const updateBodySchema = z.object({
  mediaId: z.string().trim().min(1).optional(),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  summary: z.string().trim().max(500).optional(),
});

export class SketchController {
  private readonly service: SketchService = new SketchService();

  constructor(app: FastifyInstance) {
    this.service = new SketchService();
    this.registerRoutes(app);
  }

  private registerRoutes(app: FastifyInstance): void {
    app.get("/sketches", async (_req, reply) => {
      const data = await this.service.getAll();

      return reply.status(200).send({ data });
    });

    app.get(
      "/sketches/:id",
      async (req: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse((req.params ?? {}) as unknown);

          const data = await this.service.getByIdOrThrow(id);

          return reply.status(200).send({ data });
      }
    );

    app.post("/sketches", async (req: FastifyRequest, reply: FastifyReply) => {
      const body = createBodySchema.parse((req.body ?? {}) as unknown);

        const data = await this.service.create(body);

        return reply.status(201).send({ data });
    });

    app.put(
      "/sketches/:id",
      async (req: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse((req.params ?? {}) as unknown);

        const body = updateBodySchema.parse((req.body ?? {}) as unknown);

        const data = await this.service.update(id, body);

        return reply.status(200).send({ data });
      }
    );

    app.delete(
      "/sketches/:id",
      async (req: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse((req.params ?? {}) as unknown);
          await this.service.delete(id);
          return reply.status(204).send();
      }
    );
  }

}
