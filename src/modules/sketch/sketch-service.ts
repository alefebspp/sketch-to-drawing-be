import { Sketch } from "./sketch";
import { DrizzleSketchRepository } from "./repository/drizzle-sketch-repository";
import {  NotFoundError } from "../../errors";

export class SketchService {
  private readonly repo: DrizzleSketchRepository =
    new DrizzleSketchRepository();

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
