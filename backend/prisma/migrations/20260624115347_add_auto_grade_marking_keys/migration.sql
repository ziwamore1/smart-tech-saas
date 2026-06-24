-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "answerKeyUrl" TEXT,
ADD COLUMN     "autoGrade" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "markingKeyUrl" TEXT;
