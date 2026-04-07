import { db } from "../../../infrastructure/db/drizzle";
import { drawings } from "../../../infrastructure/db/drizzle/schema";
import { eq } from "drizzle-orm";
import type { Drawing } from "../drawing";
import { DrawingRepository } from "./drawing-repository";

function mapRowToDrawing(row: {
  id: number;
  mediaId: string;
  sketchId: string;
  title: string | null;
  description: string | null;
}): Drawing {
  return {
    id: row.id,
    mediaId: row.mediaId,
    sketchId: row.sketchId,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
  };
}

export class DrizzleDrawingRepository implements DrawingRepository {
  public async findById(id: number): Promise<Drawing | null> {
    const rows = await db.select().from(drawings).where(eq(drawings.id, id)).limit(1);
    if (rows.length === 0) return null;
    return mapRowToDrawing(rows[0]);
  }

  public async findAll(): Promise<Drawing[]> {
    const rows = await db.select().from(drawings);
    return rows.map(mapRowToDrawing);
  }

  public async create(data: Omit<Drawing, "id">): Promise<Drawing> {
    const rows = await db
      .insert(drawings)
      .values({
        mediaId: data.mediaId,
        sketchId: data.sketchId,
        title: data.title ?? null,
        description: data.description ?? null,
      })
      .returning();
    return mapRowToDrawing(rows[0]);
  }

  public async update(id: number, data: Partial<Omit<Drawing, "id">>): Promise<Drawing> {
    const values: {
      mediaId?: string;
      sketchId?: string;
      title?: string | null;
      description?: string | null;
    } = {};
    if (data.mediaId !== undefined) values.mediaId = data.mediaId;
    if (data.sketchId !== undefined) values.sketchId = data.sketchId;
    if (data.title !== undefined) values.title = data.title ?? null;
    if (data.description !== undefined) values.description = data.description ?? null;
    const rows = await db.update(drawings).set(values).where(eq(drawings.id, id)).returning();
    return mapRowToDrawing(rows[0]);
  }

  public async delete(id: number): Promise<void> {
    await db.delete(drawings).where(eq(drawings.id, id));
  }
}

