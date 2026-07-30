CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Support Prisma `contains` / LIKE '%q%' search across library fields (including body text).
CREATE INDEX IF NOT EXISTS "AiResource_name_trgm_idx"
  ON "AiResource" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "AiResource_summary_trgm_idx"
  ON "AiResource" USING GIN ("summary" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "AiResource_tags_trgm_idx"
  ON "AiResource" USING GIN ("tags" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "AiResource_ownerName_trgm_idx"
  ON "AiResource" USING GIN ("ownerName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "AiResource_content_trgm_idx"
  ON "AiResource" USING GIN ("content" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "AiResource_extractedText_trgm_idx"
  ON "AiResource" USING GIN ("extractedText" gin_trgm_ops);
