/*
  Warnings:

  - A unique constraint covering the columns `[convertedCustomerId]` on the table `Lead` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "convertedCustomerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_convertedCustomerId_key" ON "Lead"("convertedCustomerId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
