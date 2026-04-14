import { z } from "zod";
import { HTTP_STATUS } from "../../consts/http-status";
import type { FastifyZodInstance } from "../../fastify-zod-instance";
import { ImageService } from "./image-service";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const imageEntitySchema = z.object({
  id: z.number(),
  filename: z.string(),
  url: z.string(),
});

const errorResponseSchema = z.object({ error: z.string() });

/** Multipart: objeto vazio ou com `file` (validação de arquivo obrigatório no handler). */
const imageUploadBodySchema = z
  .object({
    file: z
      .custom<unknown>(() => true)
      .describe("Arquivo de imagem (campo 'file')")
      .optional(),
  })
  .passthrough();

export class ImageController {
  private readonly service: ImageService = new ImageService();

  constructor(app: FastifyZodInstance) {
    this.registerRoutes(app);
  }

  private registerRoutes(app: FastifyZodInstance): void {
    app.get(
      "/images",
      {
        schema: {
          tags: ["Images"],
          summary: "Listar imagens",
          response: {
            200: z.object({ data: z.array(imageEntitySchema) }),
          },
        },
      },
      async (_req, reply) => {
        const data = await this.service.getAll();
        return reply.status(HTTP_STATUS.OK).send({ data });
      }
    );

    app.get(
      "/images/:id",
      {
        schema: {
          tags: ["Images"],
          summary: "Buscar imagem por id",
          params: idParamSchema,
          response: {
            200: z.object({ data: imageEntitySchema }),
            404: errorResponseSchema,
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
      "/images",
      {
        schema: {
          consumes: ["multipart/form-data"],
          tags: ["Images"],
          summary: "Upload de imagem",
          body: imageUploadBodySchema,
          response: {
            201: z.object({ data: imageEntitySchema }),
            400: errorResponseSchema,
          },
        },
      },
      async (req, reply) => {
        const anyReq: any = req as any;

        let part = anyReq.body?.file ?? (await anyReq.file?.());

        if (part && part.file && typeof part.file.toBuffer === "function") {
          part = {
            toBuffer: part.file.toBuffer.bind(part.file),
            mimetype: part.mimetype ?? part.file?.mimetype,
            filename: part.filename ?? part.file?.filename,
          };
        }

        if (!part || typeof part.toBuffer !== "function") {
          return reply
            .status(HTTP_STATUS.BAD_REQUEST)
            .send({ error: "file is required" });
        }

        const fileBuffer = await part.toBuffer();
        const mime: string = part.mimetype;
        const filename: string | undefined = part.filename;
        const image = await this.service.createFromUpload(
          fileBuffer,
          mime,
          filename
        );
        return reply.status(HTTP_STATUS.CREATED).send({ data: image });
      }
    );

    app.delete(
      "/images/:id",
      {
        schema: {
          tags: ["Images"],
          summary: "Excluir uma imagem",
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
