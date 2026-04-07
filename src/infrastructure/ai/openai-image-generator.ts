export interface ImageGenerator {
  generateFromImage(inputUrl: string, prompt?: string): Promise<Buffer>;
}

export class OpenAIImageGenerator implements ImageGenerator {
  private readonly apiKey: string | undefined = process.env.OPENAI_API_KEY;

  public async generateFromImage(inputUrl: string, _prompt?: string): Promise<Buffer> {
    // Minimal placeholder: download the input image and return its buffer.
    // This keeps the flow working without introducing SDK/runtime deps.
    // Later, replace with OpenAI Images API call.
    const res = await fetch(inputUrl);
    if (!res.ok) {
      throw new Error("Failed to fetch input image for generation");
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

