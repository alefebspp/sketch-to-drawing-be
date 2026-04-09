import { Sketch } from "./sketch";
import { DrizzleSketchRepository } from "./repository/drizzle-sketch-repository";
import {  NotFoundError } from "../../errors";
import { DrizzleImageRepository } from "../image/repository/drizzle-image-repository";

export class SketchService {
  private readonly repo: DrizzleSketchRepository =
    new DrizzleSketchRepository();
  private readonly imageRepo: DrizzleImageRepository =
    new DrizzleImageRepository();

  private async assertMediaExistsIfProvided(mediaId?: string): Promise<void> {
    if (mediaId === undefined) return;
    const parsedId = Number(mediaId);
    if (!Number.isFinite(parsedId)) {
      throw new NotFoundError("Image not found");
    }
    const image = await this.imageRepo.findById(parsedId);
    if (!image) {
      throw new NotFoundError("Image not found");
    }
  }

  public async getAll(): Promise<Sketch[]> {
    return this.repo.findAll();
  }

  public async getByIdOrThrow(id: number): Promise<Sketch> {
    const sketch = await this.repo.findById(id);
    if (!sketch) {
      throw new NotFoundError("Sketch not found");
    }
    
    return sketch;
  }

  public async create(input: Omit<Sketch, "id">): Promise<Sketch> {
    await this.assertMediaExistsIfProvided(input.mediaId);
    return this.repo.create(input);
  }

  public async update(
    id: number,
    input: Partial<Omit<Sketch, "id">>
  ): Promise<Sketch> {

    const sketch = await this.repo.findById(id);

    if (!sketch) {
      throw new NotFoundError("Sketch not found");
    }

    if (input.mediaId !== undefined) {
      await this.assertMediaExistsIfProvided(input.mediaId);
    }

    return this.repo.update(id, input);
  }

  public async delete(id: number): Promise<void> {
    const sketch = await this.repo.findById(id);

    if (!sketch) {
      throw new NotFoundError("Sketch not found");
    }

    await this.repo.delete(id);
  }

 
}
