CREATE SEQUENCE "public"."receipt_no_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"two_factor_enabled" boolean DEFAULT false,
	"role" text DEFAULT 'student',
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendee" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"booking_id" integer,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"student_package_id" integer,
	"status" text DEFAULT 'booked' NOT NULL,
	"private_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	CONSTRAINT "availability_day" CHECK ("availability"."weekday" between 0 and 6),
	CONSTRAINT "availability_range" CHECK ("availability"."start_minute" >= 0 and "availability"."end_minute" <= 1440 and "availability"."start_minute" < "availability"."end_minute")
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text DEFAULT 'lesson' NOT NULL,
	"subject_id" integer,
	"mode" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"note" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"proposed_starts_at" timestamp with time zone,
	"tutor_message" text,
	"lesson_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "calendar_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_time" CHECK ("calendar_event"."starts_at" < "calendar_event"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "charge" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"attendee_id" integer,
	"student_package_id" integer,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"voided" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charge_amount" CHECK ("charge"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "homework" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"file_key" text,
	"file_name" text,
	"due_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homework_answer" (
	"id" serial PRIMARY KEY NOT NULL,
	"homework_id" integer NOT NULL,
	"note" text,
	"file_key" text,
	"file_name" text,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'lesson' NOT NULL,
	"subject_id" integer,
	"mode" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"reminded_24" boolean DEFAULT false NOT NULL,
	"reminded_1" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_time" CHECK ("lesson"."starts_at" < "lesson"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "lesson_package" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"lesson_count" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "package_count" CHECK ("lesson_package"."lesson_count" between 1 and 100),
	CONSTRAINT "package_price" CHECK ("lesson_package"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"paid_on" date NOT NULL,
	"proof_key" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reject_reason" text,
	"recorded_by" text NOT NULL,
	"receipt_no" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "payment_amount" CHECK ("payment"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_allocation" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"charge_id" integer NOT NULL,
	"amount_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"phone" text,
	"is_under_18" boolean DEFAULT false NOT NULL,
	"parent_name" text,
	"parent_phone" text,
	"parent_email" text,
	"child_name" text,
	"level" text,
	"consent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_minor_needs_parent" CHECK (not "profile"."is_under_18" or ("profile"."parent_name" is not null and "profile"."parent_phone" is not null))
);
--> statement-breakpoint
CREATE TABLE "result_highlight" (
	"id" serial PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"rating" integer NOT NULL,
	"text" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_rating" CHECK ("review"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "room_file" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_participant" (
	"lesson_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_signal" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"from_user" text NOT NULL,
	"to_user" text NOT NULL,
	"kind" text NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"tutor_name" text,
	"headline" text,
	"bio" text,
	"qualifications" text,
	"years_teaching" integer,
	"teaching_style" text,
	"town" text,
	"photo_key" text,
	"photo_version" integer DEFAULT 0 NOT NULL,
	"lesson_modes" text DEFAULT 'online' NOT NULL,
	"group_mode" text DEFAULT 'one_to_one' NOT NULL,
	"max_group_size" integer DEFAULT 4 NOT NULL,
	"lesson_minutes" integer DEFAULT 60 NOT NULL,
	"cancel_hours" integer DEFAULT 24 NOT NULL,
	"default_price_cents" integer,
	"show_prices" boolean DEFAULT false NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"whatsapp_number" text,
	"phone" text,
	"contact_email" text,
	"bank_name" text,
	"bank_account_name" text,
	"bank_account_number" text,
	"bank_branch" text,
	"ecocash_number" text,
	"ecocash_name" text,
	"innbucks_number" text,
	"innbucks_name" text,
	"payment_note" text,
	"results_consent" boolean DEFAULT false NOT NULL,
	"setup_step" integer DEFAULT 0 NOT NULL,
	"setup_done_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_settings_singleton" CHECK ("site_settings"."id" = 1),
	CONSTRAINT "site_settings_group" CHECK ("site_settings"."max_group_size" between 2 and 20),
	CONSTRAINT "site_settings_len" CHECK ("site_settings"."lesson_minutes" between 15 and 240)
);
--> statement-breakpoint
CREATE TABLE "student_package" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"package_id" integer,
	"name" text NOT NULL,
	"lessons_total" integer NOT NULL,
	"lessons_used" integer DEFAULT 0 NOT NULL,
	"price_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_package_used" CHECK ("student_package"."lessons_used" between 0 and "student_package"."lessons_total")
);
--> statement-breakpoint
CREATE TABLE "subject" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"levels" text DEFAULT '' NOT NULL,
	"price_cents" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendee" ADD CONSTRAINT "attendee_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendee" ADD CONSTRAINT "attendee_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendee" ADD CONSTRAINT "attendee_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendee" ADD CONSTRAINT "attendee_student_package_id_student_package_id_fk" FOREIGN KEY ("student_package_id") REFERENCES "public"."student_package"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge" ADD CONSTRAINT "charge_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge" ADD CONSTRAINT "charge_attendee_id_attendee_id_fk" FOREIGN KEY ("attendee_id") REFERENCES "public"."attendee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge" ADD CONSTRAINT "charge_student_package_id_student_package_id_fk" FOREIGN KEY ("student_package_id") REFERENCES "public"."student_package"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework" ADD CONSTRAINT "homework_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_answer" ADD CONSTRAINT "homework_answer_homework_id_homework_id_fk" FOREIGN KEY ("homework_id") REFERENCES "public"."homework"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_charge_id_charge_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_file" ADD CONSTRAINT "room_file_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_file" ADD CONSTRAINT "room_file_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_participant" ADD CONSTRAINT "room_participant_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_participant" ADD CONSTRAINT "room_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_signal" ADD CONSTRAINT "room_signal_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_package" ADD CONSTRAINT "student_package_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_package" ADD CONSTRAINT "student_package_package_id_lesson_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."lesson_package"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "attendee_once" ON "attendee" USING btree ("lesson_id","user_id");--> statement-breakpoint
CREATE INDEX "attendee_user_idx" ON "attendee" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "booking_user_idx" ON "booking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "booking_status_idx" ON "booking" USING btree ("status");--> statement-breakpoint
CREATE INDEX "charge_user_idx" ON "charge" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lesson_starts_idx" ON "lesson" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_receipt_no" ON "payment" USING btree ("receipt_no");--> statement-breakpoint
CREATE INDEX "payment_user_idx" ON "payment" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_one_per_user" ON "review" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_participant_pk" ON "room_participant" USING btree ("lesson_id","user_id");--> statement-breakpoint
CREATE INDEX "room_signal_to_idx" ON "room_signal" USING btree ("lesson_id","to_user","id");