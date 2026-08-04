ALTER TABLE "ai_resources" ADD COLUMN "owner_id" text;
--> statement-breakpoint
UPDATE "ai_resources" AS resource
SET "owner_id" = COALESCE(
  (
    SELECT "id"
    FROM "users"
    WHERE "username" = resource."owner_name"
      AND "status" = 'active'
    LIMIT 1
  ),
  resource."created_by_id"
)
WHERE "owner_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "ai_resources" ALTER COLUMN "owner_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_resources"
  ADD CONSTRAINT "ai_resource_owner_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
--> statement-breakpoint
CREATE INDEX "ai_resources_owner_id_idx"
  ON "ai_resources" USING btree ("owner_id");
