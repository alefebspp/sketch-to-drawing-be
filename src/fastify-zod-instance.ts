import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

/** Fastify instance with Zod type provider (route schemas use Zod; handlers get inferred types). */
export type FastifyZodInstance = FastifyInstance<
  any,
  any,
  any,
  any,
  ZodTypeProvider
>;
