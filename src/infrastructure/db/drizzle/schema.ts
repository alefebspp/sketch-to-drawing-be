import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  serial,
  pgEnum,
  timestamp,
  jsonb,
  uuid,
  index,
} from "drizzle-orm/pg-core";

/** Payload gravado no outbox para geração de imagem (relay → BullMQ). */
export type DrawingImageGenerationOutboxPayload = {
  drawingId: number;
  prompt?: string;
  eventId: string;
};

export const outboxEventStatusEnum = pgEnum("outbox_event_status", [
  "pending",
  "publishing",
  "published",
  "failed",
]);

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

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload")
      .notNull()
      .$type<DrawingImageGenerationOutboxPayload>(),
    status: outboxEventStatusEnum("status").notNull(),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    }),
    lockedAt: timestamp("locked_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (t) => [
    index("outbox_events_status_next_attempt_idx").on(
      t.status,
      t.nextAttemptAt,
    ),
    index("outbox_events_created_at_idx").on(t.createdAt),
  ],
);
