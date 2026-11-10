-- Create the single settings row with defaults (WhatsApp +263 77 423 1904, USD).
INSERT INTO "site_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;
