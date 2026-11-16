CREATE TABLE "recommend_pref" (
	"tutor_id" text PRIMARY KEY NOT NULL,
	"mode" text NOT NULL,
	"set_by" text,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recommend_pref" ADD CONSTRAINT "recommend_pref_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommend_pref" ADD CONSTRAINT "recommend_pref_set_by_user_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;