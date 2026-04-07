import { Sketch } from "../sketch";

export interface SketchRepository {
  findById(id: number): Promise<Sketch | null>;
  findAll(): Promise<Sketch[]>;
  create(data: Omit<Sketch, "id">): Promise<Sketch>;
  update(id: number, data: Partial<Omit<Sketch, "id">>): Promise<Sketch>;
  delete(id: number): Promise<void>;
}
