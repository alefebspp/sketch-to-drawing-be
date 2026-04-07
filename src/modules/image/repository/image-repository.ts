import type { Image } from "../image";

export interface ImageRepository {
  findById(id: number): Promise<Image | null>;
  findAll(): Promise<Image[]>;
  create(data: Omit<Image, "id">): Promise<Image>;
  delete(id: number): Promise<void>;
}

