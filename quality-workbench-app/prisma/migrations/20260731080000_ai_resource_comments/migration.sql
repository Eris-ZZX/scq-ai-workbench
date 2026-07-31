-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiResource_createdAt_idx" ON "AiResource"("createdAt");

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiResourceComment" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiResourceComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiResourceComment_resourceId_createdAt_idx" ON "AiResourceComment"("resourceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiResourceComment_userId_idx" ON "AiResourceComment"("userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AiResourceComment" ADD CONSTRAINT "AiResourceComment_resourceId_fkey"
    FOREIGN KEY ("resourceId") REFERENCES "AiResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AiResourceComment" ADD CONSTRAINT "AiResourceComment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
