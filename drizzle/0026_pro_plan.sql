CREATE TABLE "plan_gift" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan" text NOT NULL,
	"until" timestamp with time zone,
	"note" text,
	"given_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pro_invoice" (
	"id" serial PRIMARY KEY NOT NULL,
	"tutor_id" text NOT NULL,
	"subscription_id" integer,
	"period_months" integer DEFAULT 1 NOT NULL,
	"amount_cents" integer NOT NULL,
	"discount_pct" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'due' NOT NULL,
	"due_on" timestamp with time zone NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"proof_key" text,
	"reference" text,
	"method" text,
	"reject_reason" text,
	"receipt_no" integer,
	"confirmed_by" text,
	"confirmed_at" timestamp with time zone,
	"reminded_before" timestamp with time zone,
	"reminded_due" timestamp with time zone,
	"reminded_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pro_subscription" (
	"id" serial PRIMARY KEY NOT NULL,
	"tutor_id" text NOT NULL,
	"status" text DEFAULT 'free' NOT NULL,
	"paid_until" timestamp with time zone,
	"period_months" integer DEFAULT 1 NOT NULL,
	"auto_reminders" boolean DEFAULT false NOT NULL,
	"brand_colour" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_pay_reminder" (
	"tutor_id" text NOT NULL,
	"user_id" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tutor_pay_reminder_tutor_id_user_id_pk" PRIMARY KEY("tutor_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "tutora_settings" ADD COLUMN "pro_pilot_free_trial" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tutora_settings" ADD COLUMN "pro_trial_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_gift" ADD CONSTRAINT "plan_gift_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_gift" ADD CONSTRAINT "plan_gift_given_by_user_id_fk" FOREIGN KEY ("given_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pro_invoice" ADD CONSTRAINT "pro_invoice_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pro_invoice" ADD CONSTRAINT "pro_invoice_subscription_id_pro_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."pro_subscription"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pro_invoice" ADD CONSTRAINT "pro_invoice_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pro_subscription" ADD CONSTRAINT "pro_subscription_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_pay_reminder" ADD CONSTRAINT "tutor_pay_reminder_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_pay_reminder" ADD CONSTRAINT "tutor_pay_reminder_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_gift_user_plan_uq" ON "plan_gift" USING btree ("user_id","plan");--> statement-breakpoint
CREATE INDEX "pro_invoice_tutor_idx" ON "pro_invoice" USING btree ("tutor_id");--> statement-breakpoint
CREATE INDEX "pro_invoice_status_idx" ON "pro_invoice" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "pro_invoice_receipt_uq" ON "pro_invoice" USING btree ("receipt_no");--> statement-breakpoint
CREATE UNIQUE INDEX "pro_subscription_tutor_uq" ON "pro_subscription" USING btree ("tutor_id");