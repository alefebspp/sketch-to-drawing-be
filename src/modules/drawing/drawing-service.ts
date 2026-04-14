import type { Drawing } from "./drawing";
import { DrizzleDrawingRepository } from "./repository/drizzle-drawing-repository";
import { BadRequestError, NotFoundError } from "../../errors";
import { SketchService } from "../sketch/sketch-service";
import { ImageService } from "../image/image-service";
import {
  DEFAULT_EDIT_PROMPT,
  sniffImageMime,
} from "../../infrastructure/ai/openai-image-generator";
import { createImageGenerator } from "../../infrastructure/ai/image-generator-factory";

export class DrawingService {
  private readonly repo: DrizzleDrawingRepository =
    new DrizzleDrawingRepository();
  private readonly sketchService: SketchService = new SketchService();
  private readonly imageService: ImageService = new ImageService();
  private readonly generator = createImageGenerator();

  private async assertSketchExists(sketchId: number): Promise<void> {
    const parsedId = Number(sketchId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      throw new NotFoundError("Sketch not found");
    }
    await this.sketchService.getByIdOrThrow(parsedId);
  }

  private composeGenerationPrompt(
    summary?: string | null,
    prompt?: string
  ): string {
    const summaryText = summary?.trim();
    const promptText = prompt?.trim();

    if (!summaryText && !promptText) {
      return DEFAULT_EDIT_PROMPT;
    }

    const promptParts = [DEFAULT_EDIT_PROMPT];
    if (summaryText) {
      promptParts.push(`Sketch context: ${summaryText}`);
    }
    if (promptText) {
      promptParts.push(`Additional instruction: ${promptText}`);
    }

    return promptParts.join("\n\n");
  }

  public async getAll(): Promise<Drawing[]> {
    return this.repo.findAll();
  }

  public async getByIdOrThrow(id: number): Promise<Drawing> {
    const drawing = await this.repo.findById(id);
    if (!drawing) {
      throw new NotFoundError("Drawing not found");
    }
    return drawing;
  }

  public async create(input: Omit<Drawing, "id">): Promise<Drawing> {
    await this.assertSketchExists(input.sketchId);
    return this.repo.create(input);
  }

  public async update(
    id: number,
    input: Partial<Omit<Drawing, "id">>
  ): Promise<Drawing> {
    const exists = await this.repo.findById(id);
    if (!exists) {
      throw new NotFoundError("Drawing not found");
    }
    if (input.sketchId !== undefined) {
      await this.assertSketchExists(input.sketchId);
    }
    return this.repo.update(id, input);
  }

  public async delete(id: number): Promise<void> {
    const exists = await this.repo.findById(id);
    if (!exists) {
      throw new NotFoundError("Drawing not found");
    }
    await this.repo.delete(id);
  }

  /**
   * Generates a new image from the sketch linked to this drawing and replaces `mediaId`.
   * The previous image file (if any) remains in storage until a cleanup policy exists.
   */
  public async generateImageForDrawing(
    drawingId: number,
    prompt?: string
  ): Promise<Drawing> {
    const drawing = await this.getByIdOrThrow(drawingId);
    const sketchId = Number(drawing.sketchId);
    if (!Number.isInteger(sketchId) || sketchId <= 0) {
      throw new BadRequestError("Drawing has no valid sketch for generation");
    }
    const sketch = await this.sketchService.getByIdOrThrow(sketchId);
    const imageId = Number(sketch.mediaId);
    if (!Number.isInteger(imageId) || imageId <= 0) {
      throw new BadRequestError("Sketch has no base image for generation");
    }
    const baseImage = await this.imageService.getByIdOrThrow(imageId);

    const baseUrl = baseImage.url;
    const effectivePrompt = this.composeGenerationPrompt(
      sketch.summary,
      prompt
    );
    const generatedBuffer = await this.generator.generateFromImage(
      baseUrl,
      effectivePrompt
    );
    const mime = sniffImageMime(generatedBuffer);
    const extension =
      mime === "image/jpeg" ? ".jpg" : mime === "image/webp" ? ".webp" : ".png";
    const generatedImage = await this.imageService.createFromUpload(
      generatedBuffer,
      mime,
      `drawing${extension}`
    );
    return this.repo.update(drawingId, { mediaId: generatedImage.id });
  }
}
