import { Image } from "./image";
import { DrizzleImageRepository } from "./repository/drizzle-image-repository";
import { LocalStorageGateway } from "../../infrastructure/storage/local-storage-gateway";
import { NotFoundError } from "../../errors";

export class ImageService {
  private readonly repo: DrizzleImageRepository = new DrizzleImageRepository();
  private readonly storage = new LocalStorageGateway();

  public async getAll(): Promise<Image[]> {
    return this.repo.findAll();
  }

  public async getByIdOrThrow(id: number): Promise<Image> {
    const image = await this.repo.findById(id);
    if (!image) {
      throw new NotFoundError("Image not found");
    }
    return image;
  }

  public async createFromUpload(file: Buffer, mime: string, originalName?: string): Promise<Image> {
    this.assertAllowedMime(mime);
    const saved = await this.storage.save(file, mime, originalName);
    return this.repo.create({
      filename: saved.filename,
      url: saved.url,
    });
  }

  public async delete(id: number): Promise<void> {
    const img = await this.repo.findById(id);
    if (!img) {
      throw new NotFoundError("Image not found");
    }
    await this.repo.delete(id);
  }

  private assertAllowedMime(mime: string): void {
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(mime)) {
      throw new NotFoundError("Unsupported media type");
    }
  }
}

