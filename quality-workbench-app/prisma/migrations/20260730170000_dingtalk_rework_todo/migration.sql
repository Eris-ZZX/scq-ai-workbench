-- AlterTable
ALTER TABLE "AiResourceReviewRequest" ADD COLUMN IF NOT EXISTS "dingtalkReworkTodoId" TEXT;
ALTER TABLE "AiResourceReviewRequest" ADD COLUMN IF NOT EXISTS "dingtalkReworkTodoUnionId" TEXT;
