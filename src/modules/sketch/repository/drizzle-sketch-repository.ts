import { eq } from "drizzle-orm";
import { sketches } from "../../../infrastructure/db/drizzle/schema";
import { Sketch } from "../sketch";
import { SketchRepository } from "./sketch-repository";
import { db } from "../../../infrastructure/db/drizzle";

function mapRowToSketch(row: {
  id: number;
  mediaId: number | null;
  title: string;
  description: string | null;
  summary: string;
}): Sketch {
  return {
    ...row,
    description: row.description ?? undefined,
    mediaId: row.mediaId ?? undefined,
  };
}

export class DrizzleSketchRepository implements SketchRepository {
  public async findById(id: number): Promise<Sketch | null> {
    const rows = await db
      .select()
      .from(sketches)
      .where(eq(sketches.id, id))
      .limit(1);

    if (rows.length === 0) return null;

    return mapRowToSketch(rows[0]);
  }

  public async findAll(): Promise<Sketch[]> {
    const rows = await db.select().from(sketches);
    return rows.map(mapRowToSketch);
  }

  public async create(data: Omit<Sketch, "id">): Promise<Sketch> {
    const insertValues = {
      mediaId: data.mediaId,
      title: data.title ?? null,
      description: data.description ?? null,
      summary: data.summary ?? null,
    };

    const rows = await db.insert(sketches).values(insertValues).returning();
    const row = rows[0];
    return mapRowToSketch(row);
  }

  public async update(
    id: number,
    data: Partial<Omit<Sketch, "id">>
  ): Promise<Sketch> {
    const updateValues: {
      mediaId?: number;
      title?: string;
      description?: string;
      summary?: string;
    } = {};

    if (data.mediaId !== undefined) updateValues.mediaId = data.mediaId;
    if (data.title !== undefined) updateValues.title = data.title ?? null;
    if (data.description !== undefined)
      updateValues.description = data.description ?? null;
    if (data.summary !== undefined) updateValues.summary = data.summary ?? null;

    const rows = await db
      .update(sketches)
      .set(updateValues)
      .where(eq(sketches.id, id))
      .returning();

    const row = rows[0];
    return mapRowToSketch(row);
  }

  public async delete(id: number): Promise<void> {
    await db.delete(sketches).where(eq(sketches.id, id));
  }
}
