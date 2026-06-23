-- CreateTable
CREATE TABLE "guidelines" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guidelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_sets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "phase" TEXT NOT NULL DEFAULT 'uploaded',
    "slide_count" INTEGER NOT NULL DEFAULT 0,
    "guideline_id" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_files" (
    "id" SERIAL NOT NULL,
    "analysis_set_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "public_path" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slide_renders" (
    "id" SERIAL NOT NULL,
    "analysis_set_id" INTEGER NOT NULL,
    "slide_index" INTEGER NOT NULL,
    "image_filename" TEXT NOT NULL,
    "public_path" TEXT NOT NULL,
    "width_emu" INTEGER NOT NULL DEFAULT 0,
    "height_emu" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slide_renders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flags" (
    "id" SERIAL NOT NULL,
    "analysis_set_id" INTEGER NOT NULL,
    "slide_index" INTEGER NOT NULL,
    "rule_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT NOT NULL,
    "location_json" TEXT,
    "suggested_fix" TEXT,
    "fix_op_json" TEXT,
    "auto_fixable" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "dedupe_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guidelines_slug_key" ON "guidelines"("slug");

-- CreateIndex
CREATE INDEX "idx_analysis_sets_user_id" ON "analysis_sets"("user_id");

-- CreateIndex
CREATE INDEX "idx_analysis_files_analysis_set_id" ON "analysis_files"("analysis_set_id");

-- CreateIndex
CREATE UNIQUE INDEX "slide_renders_analysis_set_id_slide_index_key" ON "slide_renders"("analysis_set_id", "slide_index");

-- CreateIndex
CREATE INDEX "idx_flags_analysis_set_id_slide_index" ON "flags"("analysis_set_id", "slide_index");

-- CreateIndex
CREATE UNIQUE INDEX "flags_analysis_set_id_dedupe_key_key" ON "flags"("analysis_set_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "analysis_sets" ADD CONSTRAINT "analysis_sets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_files" ADD CONSTRAINT "analysis_files_analysis_set_id_fkey" FOREIGN KEY ("analysis_set_id") REFERENCES "analysis_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slide_renders" ADD CONSTRAINT "slide_renders_analysis_set_id_fkey" FOREIGN KEY ("analysis_set_id") REFERENCES "analysis_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_analysis_set_id_fkey" FOREIGN KEY ("analysis_set_id") REFERENCES "analysis_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
