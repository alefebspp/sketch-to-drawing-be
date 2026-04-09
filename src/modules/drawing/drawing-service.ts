import type { Drawing } from "./drawing";
import { DrizzleDrawingRepository } from "./repository/drizzle-drawing-repository";
import { NotFoundError } from "../../errors";
import { SketchService } from "../sketch/sketch-service";
import { ImageService } from "../image/image-service";
import { OpenAIImageGenerator } from "../../infrastructure/ai/openai-image-generator";

export class DrawingService {
  private readonly repo: DrizzleDrawingRepository = new DrizzleDrawingRepository();
  private readonly sketchService: SketchService = new SketchService();
  private readonly imageService: ImageService = new ImageService();
  private readonly generator = new OpenAIImageGenerator();

  private async assertSketchExists(sketchId: string): Promise<void> {
    const parsedId = Number(sketchId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      throw new NotFoundError("Sketch not found");
    }
    await this.sketchService.getByIdOrThrow(parsedId);
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

  public async update(id: number, input: Partial<Omit<Drawing, "id">>): Promise<Drawing> {
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

  public async generateImageForDrawing(drawingId: number, prompt?: string): Promise<Drawing> {
    const drawing = await this.getByIdOrThrow(drawingId);
    const sketchId = Number(drawing.sketchId);
    if (!Number.isInteger(sketchId) || sketchId <= 0) {
      throw new NotFoundError("Sketch not found");
    }
    const sketch = await this.sketchService.getByIdOrThrow(sketchId);
    const imageId = Number(sketch.mediaId);
    if (!Number.isInteger(imageId) || imageId <= 0) {
      throw new NotFoundError("Sketch mediaId is not a valid Image id");
    }
    const baseImage = await this.imageService.getByIdOrThrow(imageId);
    const baseUrl = baseImage.url;
    const generatedBuffer = await this.generator.generateFromImage(baseUrl, prompt);
    const generatedImage = await this.imageService.createFromUpload(
      generatedBuffer,
      "image/png",
      "drawing.png"
    );
    return this.repo.update(drawingId, { mediaId: String(generatedImage.id) });
  }
}

