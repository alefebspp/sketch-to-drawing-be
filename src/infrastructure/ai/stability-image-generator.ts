import { AppError, BadRequestError } from "../../errors";
import { DEFAULT_EDIT_PROMPT, ImageGenerator, sniffImageMime } from "./openai-image-generator";

const STABILITY_CONTROL_SKETCH_ENDPOINT =
  "https://api.stability.ai/v2beta/stable-image/control/sketch";

type StabilityOutputFormat = "png" | "jpeg" | "webp";

function parsePositiveNumber(
  envName: string,
  fallback: string,
  providerName: string
): number {
  const value = Number(process.env[envName] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError(
      503,
      `Image generation is misconfigured (invalid ${envName} for ${providerName})`
    );
  }
  return value;
}

function getOutputFormat(): StabilityOutputFormat {
  const outputFormat = (process.env.STABILITY_OUTPUT_FORMAT ?? "png")
    .trim()
    .toLowerCase();
  if (outputFormat === "png" || outputFormat === "jpeg" || outputFormat === "webp") {
    return outputFormat;
  }
  throw new AppError(
    503,
    "Image generation is misconfigured (invalid STABILITY_OUTPUT_FORMAT)"
  );
}

async function handleStabilityError(res: Response): Promise<never> {
  const status = res.status;
  let bodyText = "";
  try {
    bodyText = await res.text();
  } catch {
    /* ignore */
  }
  console.error("Stability control/sketch error:", status, bodyText.slice(0, 2000));

  if (status === 401 || status === 403) {
    throw new AppError(502, "Image generation service authentication failed");
  }
  if (status === 429) {
    throw new AppError(502, "Image generation rate limited; try again later");
  }
  if (status >= 500) {
    throw new AppError(502, "Image generation service temporarily unavailable");
  }
  if (status === 400 || status === 413 || status === 422) {
    throw new BadRequestError("Image generation request was rejected");
  }

  throw new BadRequestError("Image generation request was rejected");
}

export class StabilityImageGenerator implements ImageGenerator {
  public async generateFromImage(
    inputUrl: string,
    prompt?: string
  ): Promise<Buffer> {
    const apiKey = process.env.STABILITY_API_KEY?.trim();
    if (!apiKey) {
      throw new AppError(503, "Image generation is not configured");
    }

    const timeoutMs = parsePositiveNumber(
      "STABILITY_HTTP_TIMEOUT_MS",
      "120000",
      "Stability"
    );
    const maxInputBytes = parsePositiveNumber(
      "STABILITY_MAX_INPUT_IMAGE_BYTES",
      String(4 * 1024 * 1024),
      "Stability"
    );
    const outputFormat = getOutputFormat();
    const effectivePrompt = prompt?.trim() || DEFAULT_EDIT_PROMPT;

    const imageRes = await fetch(inputUrl, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!imageRes.ok) {
      throw new BadRequestError("Failed to download sketch image for generation");
    }

    const inputBuffer = Buffer.from(await imageRes.arrayBuffer());
    if (inputBuffer.length > maxInputBytes) {
      throw new BadRequestError(
        `Sketch image exceeds maximum size (${maxInputBytes} bytes)`
      );
    }

    const form = new FormData();
    form.append("image", new Blob([new Uint8Array(inputBuffer)]), "sketch-input");
    form.append("prompt", effectivePrompt);
    form.append("output_format", outputFormat);

    const controlStrengthRaw = process.env.STABILITY_CONTROL_STRENGTH?.trim();
    if (controlStrengthRaw) {
      const controlStrength = Number(controlStrengthRaw);
      if (!Number.isFinite(controlStrength) || controlStrength <= 0) {
        throw new AppError(
          503,
          "Image generation is misconfigured (invalid STABILITY_CONTROL_STRENGTH)"
        );
      }
      form.append("control_strength", String(controlStrength));
    }

    const generateRes = await fetch(STABILITY_CONTROL_SKETCH_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "image/*",
      },
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!generateRes.ok) {
      await handleStabilityError(generateRes);
    }

    const outputBuffer = Buffer.from(await generateRes.arrayBuffer());
    if (outputBuffer.length === 0) {
      throw new AppError(502, "Image generation returned no image data");
    }
    // Enforce compatibility with current upload flow and mime detector.
    sniffImageMime(outputBuffer);
    return outputBuffer;
  }
}
