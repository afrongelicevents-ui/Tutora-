CREATE TABLE "day_tick" (
	"student_id" text NOT NULL,
	"on_date" date NOT NULL,
	"item_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_tick_student_id_on_date_item_key_pk" PRIMARY KEY("student_id","on_date","item_key")
);
--> statement-breakpoint
CREATE TABLE "goal_tick" (
	"goal_id" integer NOT NULL,
	"on_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_tick_goal_id_on_date_pk" PRIMARY KEY("goal_id","on_date")
);
--> statement-breakpoint
CREATE TABLE "personal_goal" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"title" text NOT NULL,
	"target_days" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_goal_target" CHECK ("personal_goal"."target_days" between 1 and 7)
);
--> statement-breakpoint
CREATE TABLE "personal_pref" (
	"student_id" text PRIMARY KEY NOT NULL,
	"share_report" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_task" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"title" text NOT NULL,
	"minute" integer,
	"days" jsonb,
	"on_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_task_minute" CHECK ("personal_task"."minute" is null or "personal_task"."minute" between 0 and 1439)
);
--> statement-breakpoint
CREATE TABLE "planner_reminder_sent" (
	"student_id" text NOT NULL,
	"on_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planner_reminder_sent_student_id_on_date_pk" PRIMARY KEY("student_id","on_date")
);
--> statement-breakpoint
ALTER TABLE "day_tick" ADD CONSTRAINT "day_tick_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_tick" ADD CONSTRAINT "goal_tick_goal_id_personal_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."personal_goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_goal" ADD CONSTRAINT "personal_goal_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_pref" ADD CONSTRAINT "personal_pref_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_task" ADD CONSTRAINT "personal_task_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_reminder_sent" ADD CONSTRAINT "planner_reminder_sent_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "personal_goal_student" ON "personal_goal" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "personal_task_student" ON "personal_task" USING btree ("student_id");