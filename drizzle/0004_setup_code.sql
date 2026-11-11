CREATE TABLE "setup_code" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "setup_code_singleton" CHECK ("setup_code"."id" = 1)
);
