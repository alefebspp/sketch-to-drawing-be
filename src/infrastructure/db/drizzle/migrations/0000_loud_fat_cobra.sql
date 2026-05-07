CREATE TYPE "public"."drawing_status" AS ENUM('processing', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "drawings" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_id" integer,
	"sketch_id" integer NOT NULL,
	"title" text,
	"description" text,
	"status" "drawing_status"
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sketches" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_id" integer,
	"title" text NOT NULL,
	"description" text,
	"summary" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_media_id_images_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."images"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_sketch_id_sketches_id_fk" FOREIGN KEY ("sketch_id") REFERENCES "public"."sketches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sketches" ADD CONSTRAINT "sketches_media_id_images_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."images"("id") ON DELETE no action ON UPDATE no action;