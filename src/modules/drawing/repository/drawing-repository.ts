import type { Drawing, DrawingCreateInput } from "../drawing";

export interface DrawingRepository {
  findById(id: number): Promise<Drawing | null>;
  findAll(): Promise<Drawing[]>;
  create(data: DrawingCreateInput): Promise<Drawing>;
  update(id: number, data: Partial<Omit<Drawing, "id">>): Promise<Drawing>;
  delete(id: number): Promise<void>;
}

