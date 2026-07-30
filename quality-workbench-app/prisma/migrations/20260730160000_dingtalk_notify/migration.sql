-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dingtalkUserId" TEXT;

-- AlterTable
ALTER TABLE "AiResourceReviewRequest" ADD COLUMN IF NOT EXISTS "dingtalkTodoId" TEXT;
ALTER TABLE "AiResourceReviewRequest" ADD COLUMN IF NOT EXISTS "dingtalkTodoUnionId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_dingtalkUserId_idx" ON "User"("dingtalkUserId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
