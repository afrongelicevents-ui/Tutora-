-- Create the single, empty settings row. Everything personal is filled in by the tutor.
INSERT INTO "site_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;
