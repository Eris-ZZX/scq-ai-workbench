# QE 工作台

供应链质量团队使用的 Next.js 全栈应用，包含项目与 NPQ 活动、任务、AI 资源库、本地账号、钉钉扫码登录/通知以及管理后台。

## 技术栈

- Next.js 16、React 19、TypeScript
- PostgreSQL 17、Drizzle ORM、版本化 migration（`drizzle/`）
- MinIO（S3 兼容私有对象存储）
- JWT Cookie；本地账号与钉钉认证
- pnpm 11.6.0；Docker 多阶段构建（Node 22 构建 / Node 20 运行）

应用位于仓库根目录：`app/` 页面、`components/` 通用组件、`lib/` 服务端与业务模块、`db/` 数据层、`drizzle/` migration。

## 架构

生产推荐在 **Linux** 上以 Docker Compose 运行三个服务：

| 服务 | 说明 |
|------|------|
| `app` | Next.js standalone（默认宿主机 `3000`） |
| `db` | PostgreSQL 17（默认仅本机回环暴露） |
| `minio` | 对象存储（默认仅本机回环暴露） |

浏览器只访问应用端口；附件由服务端读写 MinIO，不签发浏览器直连的 presigned URL。

## 快速启动（Docker）

在 Linux 或任意已安装 Docker / Compose 的环境：

```bash
cp .env.example .env
# 编辑 .env：JWT_SECRET、ADMIN_INITIAL_PASSWORD、APP_BASE_URL、MinIO、钉钉等

docker compose up -d db minio
docker compose --profile app up -d --build
```

空库首次启动必须配置 `ADMIN_INITIAL_PASSWORD`；`admin` 创建后后续启动不会重置密码。

## 常用命令

```bash
corepack enable
corepack prepare pnpm@11.6.0 --activate
pnpm install --frozen-lockfile

pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

`pnpm@11.6.0` 要求 Node.js **22.13+**。生产镜像在 Node 22 中构建，最终容器以 Node 20 执行 `node server.js`。

数据库相关：

```bash
pnpm db:generate   # 从 db/schema.ts 生成版本化 migration
pnpm db:check      # 预检 migration，拦截未确认的破坏性变更
pnpm db:migrate
pnpm db:bootstrap
```

数据库变更约定：

1. 修改 `db/schema.ts`，它是数据库结构的设计源。
2. 执行 `pnpm db:generate`，把生成的 `drizzle/*.sql` 和 `drizzle/meta/` 一起提交。
3. 执行 `pnpm db:check`，确认新增 migration 没有未经审查的破坏性操作。
4. 先在测试库执行 `pnpm db:migrate`，验证数据回填、索引和约束，再部署生产。

`drizzle/` 是生产发布产物，不能只改 `db/schema.ts` 而不生成 migration，也不能在生产启动时依赖 `drizzle-kit push` 自动 diff。新增字段、索引和表应使用版本化 migration；删除字段、删除表、清空数据、修改列类型等操作必须先完成数据备份和人工审查。

`pnpm db:check` 默认会拦截 `DROP TABLE`、`DROP COLUMN`、`DROP CONSTRAINT`、`TRUNCATE`、危险类型变更以及没有先回填数据的 `SET NOT NULL`。确需执行已审查的破坏性 migration 时，显式设置 `QE_ALLOW_DESTRUCTIVE_MIGRATIONS=1` 后再运行检查或构建；不要把该变量长期写入生产环境。

生产启动由 `instrumentation.ts` 自动完成：等待 PostgreSQL → advisory lock → migration → 幂等 bootstrap → MinIO bucket → 解锁。每个阶段都有重试和日志；迁移、bootstrap 或 bucket 初始化在重试耗尽后会阻止应用进入 ready 状态。构建阶段不连接数据库或 MinIO，构建前会自动执行 migration 预检。

部署与运维细节见 [application-runbook.md](00-docs/deployment/application-runbook.md)。
