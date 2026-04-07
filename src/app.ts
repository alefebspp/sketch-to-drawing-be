import fastify from "fastify";
import { AppError } from "./errors";
import { SketchController } from "./modules/sketch/sketch-controller";

const app = fastify({
  logger: true,
});

new SketchController(app);

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
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

export { app };

