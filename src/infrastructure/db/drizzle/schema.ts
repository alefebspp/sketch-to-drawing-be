import { pgTable, serial, text } from "drizzle-orm/pg-core";

// NOTE: This is an infrastructure schema (Drizzle) mapped from the domain entities.
// Domain rules live in `src/domain/entities/*`.

export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  url: text("url").notNull(),
});

export const sketches = pgTable("sketches", {
  id: serial("id").primaryKey(),
  mediaId: text("media_id").notNull(),
  title: text("title"),
  description: text("description"),
  summary: text("summary"),
});

export const drawings = pgTable("drawings", {
  id: serial("id").primaryKey(),
  mediaId: text("media_id").notNull(),
  // Domain entity stores the sketch reference as a string (`sketchId`).
  // So we model it as a plain text column (no FK).
  sketchId: text("sketch_id").notNull(),
  title: text("title"),
  description: text("description"),
});

