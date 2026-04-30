import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  serial,
  pgEnum,
  timestamp,
} from "drizzle-orm/pg-core";

export const drawingStatusEnum = pgEnum("drawing_status", [
  "processing",
  "success",
  "failed",
]);

export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  url: text("url").notNull(),
});

export const sketches = pgTable("sketches", {
  id: serial("id").primaryKey(),
  mediaId: integer("media_id").references(() => images.id),
  title: text("title").notNull(),
  description: text("description"),
  summary: text("summary").notNull(),
});

export const drawings = pgTable("drawings", {
  id: serial("id").primaryKey(),
  mediaId: integer("media_id").references(() => images.id),
  sketchId: integer("sketch_id")
    .notNull()
    .references(() => sketches.id),
  title: text("title"),
  description: text("description"),
  status: drawingStatusEnum("status"),
  lastError: text("last_error"),
  failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" }),
});
export const imagesRelations = relations(images, ({ many }) => ({
  sketches: many(sketches),
  drawings: many(drawings),
}));

export const sketchesRelations = relations(sketches, ({ one, many }) => ({
  image: one(images, {
    fields: [sketches.mediaId],
    references: [images.id],
  }),
  drawings: many(drawings),
}));

export const drawingsRelations = relations(drawings, ({ one }) => ({
  sketch: one(sketches, {
    fields: [drawings.sketchId],
    references: [sketches.id],
  }),
}));
