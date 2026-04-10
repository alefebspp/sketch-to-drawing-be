import { AppError } from "../../errors";
import { ImageGenerator, OpenAIImageGenerator } from "./openai-image-generator";
import { StabilityImageGenerator } from "./stability-image-generator";

export function createImageGenerator(): ImageGenerator {
  const provider = (process.env.IMAGE_PROVIDER ?? "openai").trim().toLowerCase();
  if (provider === "openai") {
    return new OpenAIImageGenerator();
  }
  if (provider === "stability") {
    return new StabilityImageGenerator();
  }
  throw new AppError(
    503,
    "Image generation is misconfigured (invalid IMAGE_PROVIDER)"
  );
}
