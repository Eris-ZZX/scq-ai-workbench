-- AlterTable
ALTER TABLE "AiResourceFavorite" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "AiResourceFavorite_userId_sortOrder_idx" ON "AiResourceFavorite"("userId", "sortOrder");
