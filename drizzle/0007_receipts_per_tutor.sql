DROP INDEX "payment_receipt_no";--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_tutor_receipt_no" ON "payment" USING btree ("tutor_id","receipt_no");