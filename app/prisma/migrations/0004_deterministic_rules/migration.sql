-- CreateTable
CREATE TABLE "deterministic_rules" (
    "id" SERIAL NOT NULL,
    "rule_type" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'any',
    "number_value" INTEGER,
    "text_value" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "auto_fix" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deterministic_rules_pkey" PRIMARY KEY ("id")
);
