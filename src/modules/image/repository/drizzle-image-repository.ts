import { db } from "../../../infrastructure/db/drizzle";
import { images } from "../../../infrastructure/db/drizzle/schema";
import { eq } from "drizzle-orm";
import type { Image } from "../image";
import { ImageRepository } from "./image-repository";

function mapRowToImage(row: { id: number; filename: string; url: string }): Image {
  return { id: row.id, filename: row.filename, url: row.url };
}

export class DrizzleImageRepository implements ImageRepository {
  public async findById(id: number): Promise<Image | null> {
    const rows = await db.select().from(images).where(eq(images.id, id)).limit(1);
    if (rows.length === 0) return null;
    return mapRowToImage(rows[0]);
  }

  public async findAll(): Promise<Image[]> {
    const rows = await db.select().from(images);
    return rows.map(mapRowToImage);
    }

  public async create(data: Omit<Image, "id">): Promise<Image> {
    const rows = await db
      .insert(images)
      .values({
        filename: data.filename,
        url: data.url,
      })
      .returning();
    const row = rows[0];
    return mapRowToImage(row);
  }

  public async delete(id: number): Promise<void> {
    await db.delete(images).where(eq(images.id, id));
  }
}

