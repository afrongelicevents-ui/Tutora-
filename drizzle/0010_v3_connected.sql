CREATE TABLE "assessment_result" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"tutor_id" text,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"topic" text NOT NULL,
	"score" integer NOT NULL,
	"max_score" integer NOT NULL,
	"feedback" text,
	"taken_on" date NOT NULL,
	"set_id" integer,
	"homework_answer_id" integer,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "result_score" CHECK ("assessment_result"."max_score" > 0 and "assessment_result"."score" between 0 and "assessment_result"."max_score")
);
--> statement-breakpoint
CREATE TABLE "checkin" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"mood" text NOT NULL,
	"subject" text,
	"note" text,
	"shared_with_family" boolean DEFAULT false NOT NULL,
	"shared_with_tutor" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connected_account" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"account_email" text,
	"scopes" text NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"subject" text NOT NULL,
	"title" text NOT NULL,
	"exam_on" date,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_invite" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"hint" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_link" (
	"parent_id" text NOT NULL,
	"student_id" text NOT NULL,
	"guardian" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"label" text,
	"share_progress" boolean DEFAULT true NOT NULL,
	"share_lessons" boolean DEFAULT true NOT NULL,
	"share_homework" boolean DEFAULT true NOT NULL,
	"share_study" boolean DEFAULT true NOT NULL,
	"invite_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_link_parent_id_student_id_pk" PRIMARY KEY("parent_id","student_id"),
	CONSTRAINT "family_link_not_self" CHECK ("family_link"."parent_id" <> "family_link"."student_id")
);
--> statement-breakpoint
CREATE TABLE "guardian_permission" (
	"student_id" text PRIMARY KEY NOT NULL,
	"tools_allowed" boolean DEFAULT false NOT NULL,
	"approve_new_family" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homework_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"homework_id" integer,
	"answer_id" integer,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"drive_file_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_feedback" (
	"attendee_id" integer PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_material" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"tutor_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"drive_file_id" text,
	"file_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_meeting" (
	"lesson_id" integer PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"join_url" text NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partnership" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"parent_id" text NOT NULL,
	"tutor_id" text NOT NULL,
	"subject" text NOT NULL,
	"school_name" text NOT NULL,
	"teacher_name" text NOT NULL,
	"teacher_email" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"consent_text" text NOT NULL,
	"consent_name" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"school_token_hash" text,
	"school_responded_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"stopped_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partnership_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"partnership_id" integer NOT NULL,
	"kind" text NOT NULL,
	"from_role" text NOT NULL,
	"from_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question" (
	"id" serial PRIMARY KEY NOT NULL,
	"set_id" integer NOT NULL,
	"prompt" text NOT NULL,
	"choices" jsonb NOT NULL,
	"answer" integer NOT NULL,
	"explanation" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "question_answer" CHECK ("question"."answer" >= 0)
);
--> statement-breakpoint
CREATE TABLE "question_set" (
	"id" serial PRIMARY KEY NOT NULL,
	"tutor_id" text NOT NULL,
	"kind" text DEFAULT 'quiz' NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"topic" text NOT NULL,
	"level" text,
	"daily_checks" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_assignment" (
	"id" serial PRIMARY KEY NOT NULL,
	"set_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"due_on" date,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource" (
	"id" serial PRIMARY KEY NOT NULL,
	"tutor_id" text NOT NULL,
	"student_id" text,
	"subject" text NOT NULL,
	"level" text,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"drive_file_id" text,
	"file_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_info" (
	"student_id" text PRIMARY KEY NOT NULL,
	"school" text,
	"year" text,
	"entered_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_subject" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"subject" text NOT NULL,
	"syllabus" text,
	"textbook" text,
	"current_topic" text,
	"entered_by" text,
	"checked_by" text,
	"checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_alert_sent" (
	"plan_item_id" integer NOT NULL,
	"on_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_alert_sent_plan_item_id_on_date_pk" PRIMARY KEY("plan_item_id","on_date")
);
--> statement-breakpoint
CREATE TABLE "study_plan_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"minutes" integer NOT NULL,
	"subject" text NOT NULL,
	"topic" text,
	"created_by" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_plan_day" CHECK ("study_plan_item"."weekday" between 0 and 6),
	CONSTRAINT "study_plan_start" CHECK ("study_plan_item"."start_minute" between 0 and 1439),
	CONSTRAINT "study_plan_len" CHECK ("study_plan_item"."minutes" between 5 and 240)
);
--> statement-breakpoint
CREATE TABLE "study_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"plan_item_id" integer,
	"subject" text NOT NULL,
	"topic" text,
	"planned_minutes" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_pref" (
	"user_id" text PRIMARY KEY NOT NULL,
	"meeting_tool" text DEFAULT 'room' NOT NULL,
	"kahoot_on" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_report_sent" (
	"parent_id" text NOT NULL,
	"student_id" text NOT NULL,
	"week_start" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_report_sent_parent_id_student_id_week_start_pk" PRIMARY KEY("parent_id","student_id","week_start")
);
--> statement-breakpoint
ALTER TABLE "child" ADD COLUMN "student_id" text;--> statement-breakpoint
ALTER TABLE "homework" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "homework" ADD COLUMN "topic" text;--> statement-breakpoint
ALTER TABLE "homework_answer" ADD COLUMN "score" integer;--> statement-breakpoint
ALTER TABLE "homework_answer" ADD COLUMN "max_score" integer;--> statement-breakpoint
ALTER TABLE "lesson" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "notification_pref" ADD COLUMN "study_off" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_pref" ADD COLUMN "weekly_off" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_pref" ADD COLUMN "lessons_off" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "managed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tutor_profile" ADD COLUMN "lesson_address" text;--> statement-breakpoint
ALTER TABLE "assessment_result" ADD CONSTRAINT "assessment_result_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_result" ADD CONSTRAINT "assessment_result_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_result" ADD CONSTRAINT "assessment_result_set_id_question_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."question_set"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_result" ADD CONSTRAINT "assessment_result_homework_answer_id_homework_answer_id_fk" FOREIGN KEY ("homework_answer_id") REFERENCES "public"."homework_answer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_result" ADD CONSTRAINT "assessment_result_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin" ADD CONSTRAINT "checkin_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_account" ADD CONSTRAINT "connected_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam" ADD CONSTRAINT "exam_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam" ADD CONSTRAINT "exam_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_invite" ADD CONSTRAINT "family_invite_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_invite" ADD CONSTRAINT "family_invite_used_by_user_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_link" ADD CONSTRAINT "family_link_parent_id_user_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_link" ADD CONSTRAINT "family_link_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_link" ADD CONSTRAINT "family_link_invite_id_family_invite_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."family_invite"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_permission" ADD CONSTRAINT "guardian_permission_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_permission" ADD CONSTRAINT "guardian_permission_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_link" ADD CONSTRAINT "homework_link_homework_id_homework_id_fk" FOREIGN KEY ("homework_id") REFERENCES "public"."homework"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_link" ADD CONSTRAINT "homework_link_answer_id_homework_answer_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."homework_answer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_feedback" ADD CONSTRAINT "lesson_feedback_attendee_id_attendee_id_fk" FOREIGN KEY ("attendee_id") REFERENCES "public"."attendee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_material" ADD CONSTRAINT "lesson_material_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_material" ADD CONSTRAINT "lesson_material_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_meeting" ADD CONSTRAINT "lesson_meeting_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership" ADD CONSTRAINT "partnership_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership" ADD CONSTRAINT "partnership_parent_id_user_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership" ADD CONSTRAINT "partnership_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership" ADD CONSTRAINT "partnership_stopped_by_user_id_fk" FOREIGN KEY ("stopped_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_log" ADD CONSTRAINT "partnership_log_partnership_id_partnership_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."partnership"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_set_id_question_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."question_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_set" ADD CONSTRAINT "question_set_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_assignment" ADD CONSTRAINT "quiz_assignment_set_id_question_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."question_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_assignment" ADD CONSTRAINT "quiz_assignment_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_info" ADD CONSTRAINT "school_info_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_info" ADD CONSTRAINT "school_info_entered_by_user_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_subject" ADD CONSTRAINT "school_subject_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_subject" ADD CONSTRAINT "school_subject_entered_by_user_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_subject" ADD CONSTRAINT "school_subject_checked_by_user_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_alert_sent" ADD CONSTRAINT "study_alert_sent_plan_item_id_study_plan_item_id_fk" FOREIGN KEY ("plan_item_id") REFERENCES "public"."study_plan_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plan_item" ADD CONSTRAINT "study_plan_item_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plan_item" ADD CONSTRAINT "study_plan_item_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_plan_item_id_study_plan_item_id_fk" FOREIGN KEY ("plan_item_id") REFERENCES "public"."study_plan_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_pref" ADD CONSTRAINT "tool_pref_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_report_sent" ADD CONSTRAINT "weekly_report_sent_parent_id_user_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_report_sent" ADD CONSTRAINT "weekly_report_sent_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "result_student" ON "assessment_result" USING btree ("student_id","taken_on");--> statement-breakpoint
CREATE INDEX "checkin_student" ON "checkin" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "connected_account_once" ON "connected_account" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "exam_student" ON "exam" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "family_invite_hash" ON "family_invite" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "family_invite_student" ON "family_invite" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "family_link_student" ON "family_link" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "lesson_material_lesson" ON "lesson_material" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "partnership_parent" ON "partnership" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "partnership_tutor" ON "partnership" USING btree ("tutor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partnership_token" ON "partnership" USING btree ("school_token_hash");--> statement-breakpoint
CREATE INDEX "partnership_log_p" ON "partnership_log" USING btree ("partnership_id","created_at");--> statement-breakpoint
CREATE INDEX "question_set_idx" ON "question" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "question_set_tutor" ON "question_set" USING btree ("tutor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_assignment_once" ON "quiz_assignment" USING btree ("set_id","student_id");--> statement-breakpoint
CREATE INDEX "resource_tutor" ON "resource" USING btree ("tutor_id");--> statement-breakpoint
CREATE INDEX "school_subject_student" ON "school_subject" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "study_plan_student" ON "study_plan_item" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "study_session_student" ON "study_session" USING btree ("student_id","started_at");--> statement-breakpoint
ALTER TABLE "child" ADD CONSTRAINT "child_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;