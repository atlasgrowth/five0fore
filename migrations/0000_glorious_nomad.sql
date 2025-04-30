CREATE TABLE "bays" (
	"id" smallint PRIMARY KEY NOT NULL,
	"floor" smallint NOT NULL,
	"status" text DEFAULT 'empty' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"price_cents" integer NOT NULL,
	"station" text NOT NULL,
	"prep_seconds" integer NOT NULL,
	"description" text,
	"image_url" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"fired_at" timestamp,
	"ready_by" timestamp,
	"completed" boolean DEFAULT false NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bay_id" smallint NOT NULL,
	"status" text DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"special_instructions" text,
	"order_type" text DEFAULT 'customer' NOT NULL
);
