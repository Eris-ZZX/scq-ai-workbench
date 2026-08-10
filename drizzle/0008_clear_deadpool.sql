-- @confirmed-destructive: DWS worker 已彻底移除，external_job_outbox 表已无任何代码引用，删除安全
DROP TABLE "external_job_outbox" CASCADE;
