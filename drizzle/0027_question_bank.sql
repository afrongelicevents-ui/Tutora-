CREATE TABLE "ai_usage" (
	"day" date NOT NULL,
	"tutor_id" text NOT NULL,
	"neurons" integer DEFAULT 0 NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_day_tutor_id_pk" PRIMARY KEY("day","tutor_id")
);
--> statement-breakpoint
CREATE TABLE "test_attempt" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"items" jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"late" boolean DEFAULT false NOT NULL,
	"auto_closed" boolean DEFAULT false NOT NULL,
	"needs_marking" boolean DEFAULT false NOT NULL,
	"marked_at" timestamp with time zone,
	"score" integer,
	"max_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_report" (
	"id" serial PRIMARY KEY NOT NULL,
	"tutor_id" text NOT NULL,
	"student_id" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"note" text,
	"figures" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question" ALTER COLUMN "set_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "homework" ADD COLUMN "due_time" text;--> statement-breakpoint
ALTER TABLE "homework" ADD COLUMN "mark" text;--> statement-breakpoint
ALTER TABLE "homework" ADD COLUMN "marked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "homework" ADD COLUMN "mark_auto" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_result" ADD COLUMN "term" text;--> statement-breakpoint
ALTER TABLE "assessment_result" ADD COLUMN "attempt_id" integer;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "tutor_id" text;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "type" text DEFAULT 'mcq' NOT NULL;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "accepted" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "template" jsonb;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "marks" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "form" text;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "chapter" text;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "term" text;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "difficulty" text;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "origin" text DEFAULT 'own' NOT NULL;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "shared" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "copied_from" integer;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "question_set" ADD COLUMN "question_ids" jsonb;--> statement-breakpoint
ALTER TABLE "question_set" ADD COLUMN "chapters" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "question_set" ADD COLUMN "term" text;--> statement-breakpoint
ALTER TABLE "question_set" ADD COLUMN "timer_minutes" integer;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_attempt" ADD CONSTRAINT "test_attempt_assignment_id_quiz_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."quiz_assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_attempt" ADD CONSTRAINT "test_attempt_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_report" ADD CONSTRAINT "student_report_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_report" ADD CONSTRAINT "student_report_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_day_idx" ON "ai_usage" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "test_attempt_assignment_uq" ON "test_attempt" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "test_attempt_student_idx" ON "test_attempt" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_report_student_idx" ON "student_report" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "student_report_tutor_idx" ON "student_report" USING btree ("tutor_id");--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_tutor_idx" ON "question" USING btree ("tutor_id","subject");--> statement-breakpoint
CREATE INDEX "question_shared_idx" ON "question" USING btree ("subject","form") WHERE "question"."shared" and "question"."hidden_at" is null;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_marks" CHECK ("question"."marks" between 1 and 20);--> statement-breakpoint
-- questions already in hand-made quizzes join the tutor's question bank, tagged from the quiz
UPDATE "question" q SET "tutor_id" = s."tutor_id", "subject" = s."subject", "form" = s."level", "chapter" = s."topic" FROM "question_set" s WHERE q."set_id" = s."id" AND q."tutor_id" IS NULL;
