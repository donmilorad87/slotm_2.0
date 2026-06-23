-- AlterTable: add render kind (original | annotated | corrected)
ALTER TABLE "slide_renders" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'annotated';

-- Replace the per-slide unique with a per-slide-per-kind unique
DROP INDEX IF EXISTS "slide_renders_analysis_set_id_slide_index_key";
CREATE UNIQUE INDEX "slide_renders_analysis_set_id_slide_index_kind_key" ON "slide_renders"("analysis_set_id", "slide_index", "kind");
