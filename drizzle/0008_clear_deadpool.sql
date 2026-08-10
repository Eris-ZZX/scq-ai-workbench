-- @confirmed-destructive: DWS worker 已彻底移除，external_job_outbox 表已无任何代码引用，删除安全
-- 用 IF EXISTS：生产库从 master 升级时可能从未存在该表（master 时代无 DWS），需幂等
DROP TABLE IF EXISTS "external_job_outbox" CASCADE;
