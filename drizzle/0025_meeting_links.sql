CREATE TABLE "meeting_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"tutor_id" text NOT NULL,
	"student_id" text,
	"lesson_id" integer,
	"provider" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_subscription" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" text NOT NULL,
	"status" text DEFAULT 'free' NOT NULL,
	"paid_until" timestamp with time zone,
	"period_months" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_child" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutora_invoice" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" text NOT NULL,
	"subscription_id" integer,
	"children" jsonb NOT NULL,
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
CREATE TABLE "tutora_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"ecocash_number" text,
	"ecocash_name" text,
	"innbucks_number" text,
	"innbucks_name" text,
	"bank_name" text,
	"bank_account_name" text,
	"bank_account_number" text,
	"bank_branch" text,
	"notes" text,
	"discount_3m_pct" integer DEFAULT 0 NOT NULL,
	"discount_6m_pct" integer DEFAULT 0 NOT NULL,
	"pilot_free_trial" boolean DEFAULT true NOT NULL,
	"trial_days" integer DEFAULT 30 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_link" ADD CONSTRAINT "meeting_link_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_link" ADD CONSTRAINT "meeting_link_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_link" ADD CONSTRAINT "meeting_link_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_subscription" ADD CONSTRAINT "family_subscription_parent_id_user_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_child" ADD CONSTRAINT "subscription_child_subscription_id_family_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."family_subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_child" ADD CONSTRAINT "subscription_child_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutora_invoice" ADD CONSTRAINT "tutora_invoice_parent_id_user_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutora_invoice" ADD CONSTRAINT "tutora_invoice_subscription_id_family_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."family_subscription"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutora_invoice" ADD CONSTRAINT "tutora_invoice_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_link_student_uq" ON "meeting_link" USING btree ("tutor_id","student_id") WHERE "meeting_link"."student_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_link_lesson_uq" ON "meeting_link" USING btree ("lesson_id") WHERE "meeting_link"."lesson_id" is not null;--> statement-breakpoint
CREATE INDEX "meeting_link_url_idx" ON "meeting_link" USING btree ("tutor_id","url");--> statement-breakpoint
CREATE UNIQUE INDEX "family_subscription_parent_uq" ON "family_subscription" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_child_sub_student_uq" ON "subscription_child" USING btree ("subscription_id","student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_child_active_student_uq" ON "subscription_child" USING btree ("student_id") WHERE "subscription_child"."active";--> statement-breakpoint
CREATE INDEX "tutora_invoice_parent_idx" ON "tutora_invoice" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "tutora_invoice_status_idx" ON "tutora_invoice" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "tutora_invoice_receipt_uq" ON "tutora_invoice" USING btree ("receipt_no");