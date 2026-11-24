ALTER TABLE "tutora_invoice" ADD COLUMN "period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tutora_settings" ADD COLUMN "term_dates" jsonb;
