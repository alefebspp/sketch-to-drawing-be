import type { Drawing } from "../drawing";

export interface DrawingRepository {
  findById(id: number): Promise<Drawing | null>;
  findAll(): Promise<Drawing[]>;
  create(data: Omit<Drawing, "id">): Promise<Drawing>;
  update(id: number, data: Partial<Omit<Drawing, "id">>): Promise<Drawing>;
  delete(id: number): Promise<void>;
}

