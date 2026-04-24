import type { Drawing, DrawingCreateInput } from "./drawing";
import { DrizzleDrawingRepository } from "./repository/drizzle-drawing-repository";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors";
import { enqueueDrawingImageGeneration } from "../../infrastructure/queue/drawing-image-generation-queue";
import { SketchService } from "../sketch/sketch-service";
import { ImageService } from "../image/image-service";
import {
  DEFAULT_EDIT_PROMPT,
  sniffImageMime,
} from "../../infrastructure/ai/openai-image-generator";
import { createImageGenerator } from "../../infrastructure/ai/image-generator-factory";
import { UnrecoverableError } from "bullmq";

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

  public async create(input: DrawingCreateInput): Promise<Drawing> {
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
   * Valida o drawing, define `status = processing`, enfileira geração assíncrona (BullMQ).
   */
  public async enqueueGenerateImageForDrawing(
    drawingId: number,
    prompt?: string
  ): Promise<Drawing> {
    const drawing = await this.getByIdOrThrow(drawingId);
    if (drawing.status === "processing") {
      throw new ConflictError(
        "Drawing image generation is already in progress"
      );
    }

    const sketchId = Number(drawing.sketchId);
    if (!Number.isInteger(sketchId) || sketchId <= 0) {
      throw new BadRequestError("Drawing has no valid sketch for generation");
    }

    const sketch = await this.sketchService.getByIdOrThrow(sketchId);
    const imageId = Number(sketch.mediaId);
    if (!Number.isInteger(imageId) || imageId <= 0) {
      throw new BadRequestError("Sketch has no base image for generation");
    }

    await this.imageService.getByIdOrThrow(imageId);

    const previousStatus = drawing.status;
    await this.repo.update(drawingId, { status: "processing" });
    try {
      await enqueueDrawingImageGeneration({ drawingId, prompt });
    } catch (e) {
      await this.repo.update(drawingId, { status: previousStatus });
      throw e;
    }
    return this.getByIdOrThrow(drawingId);
  }

  /**
   * Executado pelo worker BullMQ: gera imagem, atualiza `mediaId` e `status = success`.
   * Erros recuperáveis são repetidos pela fila; falhas permanentes usam `UnrecoverableError`.
   */
  public async processImageGenerationJob(
    drawingId: number,
    prompt?: string
  ): Promise<void> {
    const drawing = await this.repo.findById(drawingId);

    if (!drawing) {
      throw new UnrecoverableError("Drawing not found");
    }

    const sketchId = Number(drawing.sketchId);
    if (!Number.isInteger(sketchId) || sketchId <= 0) {
      throw new UnrecoverableError(
        "Drawing has no valid sketch for generation"
      );
    }

    let sketch;
    try {
      sketch = await this.sketchService.getByIdOrThrow(sketchId);
    } catch (e) {
      if (e instanceof NotFoundError) {
        throw new UnrecoverableError("Sketch not found");
      }
      throw e;
    }
    const imageId = Number(sketch.mediaId);
    if (!Number.isInteger(imageId) || imageId <= 0) {
      throw new UnrecoverableError("Sketch has no base image for generation");
    }

    let baseImage;
    try {
      baseImage = await this.imageService.getByIdOrThrow(imageId);
    } catch (e) {
      if (e instanceof NotFoundError) {
        throw new UnrecoverableError("Base image not found");
      }
      throw e;
    }
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
    await this.repo.update(drawingId, {
      mediaId: generatedImage.id,
      status: "success",
    });
  }
}
