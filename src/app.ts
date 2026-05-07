import "dotenv/config";
import fastify from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { HTTP_STATUS } from "./consts/http-status";
import { AppError } from "./errors";
import { SketchController } from "./modules/sketch/sketch-controller";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { ImageController } from "./modules/image/image-controller";
import { DrawingController } from "./modules/drawing/drawing-controller";
import { registerBullBoard, bullBoardBasePath } from "./infrastructure/queue/register-bull-board";
import { createReadStream } from "fs";
import { join, extname } from "path";

const server = fastify();
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// Swagger / OpenAPI
server.register(swagger, {
  mode: "dynamic",
  openapi: {
    info: {
      title: "Projeto Rascunho - API",
      description: "API para gerenciamento de sketches",
      version: "1.0.0",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local",
      },
    ],
    tags: [
      { name: "Sketches", description: "Operações de Sketch" },
      { name: "Images", description: "Operações de Imagem" },
      { name: "Drawings", description: "Operações de Drawing" },
    ],
  },
  transform: jsonSchemaTransform,
});
server.register(swaggerUI, {
  routePrefix: "/docs",
});

// Multipart support for file uploads (optional if plugin is available)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const multipart = require("@fastify/multipart");
  server.register(multipart, {
    // Anexa os campos do multipart em request.body para evitar erro de validação
    attachFieldsToBody: true,
  });
} catch (_e) {
  server.log.warn("Multipart plugin not installed. File uploads may not work.");
}

const app = server.withTypeProvider<ZodTypeProvider>();

app.after(() => {
  new SketchController(app);
  new ImageController(app);
  new DrawingController(app);
});

// Minimal static file serving for stored images
app.get("/storage/:filename", async (req, reply) => {
  const filename = (req.params as { filename: string }).filename;
  const filePath = join(process.env.STORAGE_DIR ?? "var/storage", filename);
  const ext = extname(filename).toLowerCase();
  const contentType =
    ext === ".png"
      ? "image/png"
      : ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
      ? "image/webp"
      : "application/octet-stream";
  reply.header("Content-Type", contentType);
  return reply.send(createReadStream(filePath));
});

app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ error: error.message });
  }

  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.code(HTTP_STATUS.BAD_REQUEST).send({
      error: {
        message: "Request doesn't match the schema",
        statusCode: HTTP_STATUS.BAD_REQUEST,
      },
      details: {
        issues: error.message,
        method: request.method,
        url: request.url,
      },
    });
  }

  if (isResponseSerializationError(error)) {
    return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      error: {
        message: "Response doesn't match the schema",
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      },
      details: {
        issues: error.cause.issues,
        method: error.method,
        url: error.url,
      },
    });
  }

  console.log("ERROR:", error);

  return reply
    .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    .send({ error: "Internal Server Error" });
});

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

async function start() {
  try {
    if (process.env.BULL_BOARD_ENABLED === "true") {
      await registerBullBoard(server);
      app.log.info(`Bull Board em ${bullBoardBasePath()}`);
    }
    // ensure swagger routes are ready before listen logs endpoints
    await app.ready();
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

export { app };
