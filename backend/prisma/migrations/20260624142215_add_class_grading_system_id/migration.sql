-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "gradingSystemId" TEXT;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_gradingSystemId_fkey" FOREIGN KEY ("gradingSystemId") REFERENCES "GradingSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
