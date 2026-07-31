-- CreateTable (was in schema but never shipped in earlier migrations)
CREATE TABLE IF NOT EXISTS "AiResourceLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiResourceLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AiResourceLike_userId_resourceId_key" ON "AiResourceLike"("userId", "resourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiResourceLike_userId_idx" ON "AiResourceLike"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiResourceLike_resourceId_idx" ON "AiResourceLike"("resourceId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AiResourceLike" ADD CONSTRAINT "AiResourceLike_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AiResourceLike" ADD CONSTRAINT "AiResourceLike_resourceId_fkey"
    FOREIGN KEY ("resourceId") REFERENCES "AiResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
