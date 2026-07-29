-- CreateTable
CREATE TABLE "AiResourceFavoriteTag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiResourceFavoriteTag_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AiResourceFavorite" ADD COLUMN "tagId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AiResourceFavoriteTag_userId_name_key" ON "AiResourceFavoriteTag"("userId", "name");

-- CreateIndex
CREATE INDEX "AiResourceFavoriteTag_userId_sortOrder_idx" ON "AiResourceFavoriteTag"("userId", "sortOrder");

-- CreateIndex
CREATE INDEX "AiResourceFavorite_tagId_idx" ON "AiResourceFavorite"("tagId");

-- AddForeignKey
ALTER TABLE "AiResourceFavoriteTag" ADD CONSTRAINT "AiResourceFavoriteTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiResourceFavorite" ADD CONSTRAINT "AiResourceFavorite_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "AiResourceFavoriteTag"("id") ON DELETE SET NULL ON UPDATE CASCADE;
