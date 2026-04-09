import fastify from "fastify";
import { AppError } from "./errors";
import { SketchController } from "./modules/sketch/sketch-controller";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { ImageController } from "./modules/image/image-controller";
import { DrawingController } from "./modules/drawing/drawing-controller";
import { createReadStream } from "fs";
import { join, extname } from "path";

const app = fastify();

// Swagger / OpenAPI
app.register(swagger, {
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
});
app.register(swaggerUI, {
  routePrefix: "/docs",
});

// Multipart support for file uploads (optional if plugin is available)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const multipart = require("@fastify/multipart");
  app.register(multipart);
} catch (_e) {
  app.log.warn("Multipart plugin not installed. File uploads may not work.");
}

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

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ error: error.message });
  }

  return reply.status(500).send({ error: "Internal Server Error" });
});

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

async function start() {
  try {
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
