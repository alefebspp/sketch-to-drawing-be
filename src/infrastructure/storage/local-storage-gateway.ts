import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import { join } from "path";
import { StorageGateway, StorageSaveResult } from "./storage-gateway";

export class LocalStorageGateway implements StorageGateway {
  private readonly storageDir: string;
  private readonly publicBaseUrl: string;

  constructor(options?: { storageDir?: string; publicBaseUrl?: string }) {
    this.storageDir = options?.storageDir ?? process.env.STORAGE_DIR ?? "var/storage";
    const baseUrl = options?.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
    this.publicBaseUrl = baseUrl.replace(/\/+$/, "");
  }

  public async save(file: Buffer, mime: string, originalName?: string): Promise<StorageSaveResult> {
    await fs.mkdir(this.storageDir, { recursive: true });
    const safeName = this.generateFilename(originalName, mime);
    const fullPath = join(this.storageDir, safeName);
    await fs.writeFile(fullPath, file);
    const url = `${this.publicBaseUrl}/storage/${encodeURIComponent(safeName)}`;
    return {
      url,
      filename: safeName,
      mime,
      size: file.length,
    };
  }

  private generateFilename(originalName: string | undefined, mime: string): string {
    const extFromMime = this.extFromMime(mime);
    const base =
      originalName?.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-.]/g, "").replace(/\.[^.]+$/, "") ||
      "upload";
    const id = randomUUID();
    return `${base}_${id}${extFromMime}`;
  }

  private extFromMime(mime: string): string {
    if (mime === "image/png") return ".png";
    if (mime === "image/jpeg") return ".jpg";
    if (mime === "image/webp") return ".webp";
    return "";
  }
}

