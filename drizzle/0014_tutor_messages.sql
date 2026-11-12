CREATE TABLE "tutor_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"tutor_id" text NOT NULL,
	"student_id" text NOT NULL,
	"from_id" text NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tutor_message" ADD CONSTRAINT "tutor_message_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_message" ADD CONSTRAINT "tutor_message_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_message" ADD CONSTRAINT "tutor_message_from_id_user_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tutor_message_pair" ON "tutor_message" USING btree ("student_id","tutor_id","created_at");