import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ImageService } from "./image-service";
import { z } from "zod";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export class ImageController {
  private readonly service: ImageService = new ImageService();

  constructor(app: FastifyInstance) {
    this.registerRoutes(app);
  }

  private registerRoutes(app: FastifyInstance): void {
    app.get(
      "/images",
      {
        schema: {
          tags: ["Images"],
          summary: "Listar imagens",
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
                      filename: { type: "string" },
                      url: { type: "string" },
                    },
                    required: ["id", "filename", "url"],
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
      "/images/:id",
      {
        schema: {
          tags: ["Images"],
          summary: "Buscar imagem por id",
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
                    filename: { type: "string" },
                    url: { type: "string" },
                  },
                  required: ["id", "filename", "url"],
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
      "/images",
      {
        schema: {
          consumes: ["multipart/form-data"],
          tags: ["Images"],
          summary: "Upload de imagem",
          response: {
            201: {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    filename: { type: "string" },
                    url: { type: "string" },
                  },
                  required: ["id", "filename", "url"],
                },
              },
              required: ["data"],
            },
            400: {
              type: "object",
              properties: { error: { type: "string" } },
              required: ["error"],
            },
          },
        },
      },
      async (req: FastifyRequest, reply: FastifyReply) => {
        // Requires @fastify/multipart registered at app level
        // Expect single file field named "file"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mp: any = await (req as any).file();
        if (!mp) {
          return reply.status(400).send({ error: "file is required" });
        }
        const fileBuffer = await mp.toBuffer();
        const mime: string = mp.mimetype;
        const filename: string | undefined = mp.filename;
        const image = await this.service.createFromUpload(fileBuffer, mime, filename);
        return reply.status(201).send({ data: image });
      }
    );

    app.delete(
      "/images/:id",
      {
        schema: {
          tags: ["Images"],
          summary: "Excluir uma imagem",
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

