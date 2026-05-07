import { AppError, BadRequestError } from "../../errors";

export interface ImageGenerator {
  generateFromImage(inputUrl: string, prompt?: string): Promise<Buffer>;
}

export const DEFAULT_EDIT_PROMPT =
  "Turn this sketch into a clean, refined line drawing, keeping composition and subject matter.";

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

export function sniffImageMime(buffer: Buffer): string {
  if (buffer.length >= 8 && isPng(buffer)) {
    return "image/png";
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  throw new BadRequestError("Generated image format is not supported");
}

async function handleOpenAIError(res: Response): Promise<never> {
  const status = res.status;
  let bodyText = "";
  try {
    bodyText = await res.text();
  } catch {
    /* ignore */
  }
  console.error("OpenAI images/edits error:", status, bodyText.slice(0, 2000));

  if (status >= 500) {
    throw new AppError(502, "Image generation service temporarily unavailable");
  }
  if (status === 429) {
    throw new AppError(502, "Image generation rate limited; try again later");
  }

  throw new BadRequestError("Image generation request was rejected");
}

export class OpenAIImageGenerator implements ImageGenerator {
  public async generateFromImage(
    inputUrl: string,
    prompt?: string
  ): Promise<Buffer> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new AppError(503, "Image generation is not configured");
    }

    const timeoutMs = Number(process.env.OPENAI_HTTP_TIMEOUT_MS ?? "120000");
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new AppError(
        503,
        "Image generation is misconfigured (invalid OPENAI_HTTP_TIMEOUT_MS)"
      );
    }

    const maxInputBytes = Number(
      process.env.OPENAI_MAX_INPUT_IMAGE_BYTES ?? String(4 * 1024 * 1024)
    );
    if (!Number.isFinite(maxInputBytes) || maxInputBytes <= 0) {
      throw new AppError(
        503,
        "Image generation is misconfigured (invalid OPENAI_MAX_INPUT_IMAGE_BYTES)"
      );
    }

    const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "dall-e-2";
    const effectivePrompt = prompt?.trim() || DEFAULT_EDIT_PROMPT;

    const imageRes = await fetch(inputUrl, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!imageRes.ok) {
      throw new BadRequestError(
        "Failed to download sketch image for generation"
      );
    }
    const inputBuffer = Buffer.from(await imageRes.arrayBuffer());
    if (inputBuffer.length > maxInputBytes) {
      throw new BadRequestError(
        `Sketch image exceeds maximum size (${maxInputBytes} bytes)`
      );
    }
    if (!isPng(inputBuffer)) {
      throw new BadRequestError(
        "Sketch image must be PNG for OpenAI image edits"
      );
    }

    const form = new FormData();
    form.append(
      "image",
      new Blob([new Uint8Array(inputBuffer)], { type: "image/png" }),
      "sketch.png"
    );
    form.append("prompt", effectivePrompt);
    form.append("model", model);
    form.append("response_format", "b64_json");

    const editRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!editRes.ok) {
      await handleOpenAIError(editRes);
    }

    const json = (await editRes.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };

    const first = json.data?.[0];
    if (first?.b64_json) {
      return Buffer.from(first.b64_json, "base64");
    }
    if (first?.url) {
      const out = await fetch(first.url, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!out.ok) {
        throw new AppError(502, "Failed to download generated image");
      }
      return Buffer.from(await out.arrayBuffer());
    }

    throw new AppError(502, "Image generation returned no image data");
  }
}
