-- AlterTable: Add content, config, tags to LessonPlan
ALTER TABLE "LessonPlan" ADD COLUMN "content" JSONB DEFAULT '[]';
ALTER TABLE "LessonPlan" ADD COLUMN "config" JSONB DEFAULT '{}';
ALTER TABLE "LessonPlan" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "LessonPlan" ALTER COLUMN "tags" DROP DEFAULT;
