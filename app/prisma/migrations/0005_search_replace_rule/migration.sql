-- Add replacement text for search_replace deterministic rules.
ALTER TABLE "deterministic_rules" ADD COLUMN "replace_value" TEXT;
