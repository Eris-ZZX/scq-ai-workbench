# QE 工作台

供应链质量团队使用的 Next.js 全栈应用，包含项目与 NPQ 活动、任务、AI 资源库、Authing 登录、DWS 外部通知以及管理后台。

## 技术栈

- Next.js 16、React 19、TypeScript
- PostgreSQL 17、Drizzle ORM、版本化 migration（`drizzle/`）
- MinIO（S3 兼容私有对象存储）
- Authing OIDC（Authorization Code + PKCE）与 `qe-session` JWT Cookie
- DWS CLI 独立 Worker；本地数据库维护角色、权限和账号状态
- pnpm 11.6.0；Docker 多阶段构建（Node 22 构建 / Node 20 运行）

应用位于仓库根目录：`app/` 页面、`components/` 通用组件、`lib/` 服务端与业务模块、`db/` 数据层、`drizzle/` migration。

## 架构

生产推荐在 **Linux** 上以 Docker Compose 运行三个服务：

| 服务 | 说明 |
|------|------|
| `app` | Next.js standalone（默认宿主机 `3000`） |
| `db` | PostgreSQL 17（默认仅本机回环暴露） |
| `minio` | 对象存储（默认仅本机回环暴露） |
| `dws-worker` | 可选独立 Worker，领取数据库 outbox 并执行 dws-cli |

浏览器只访问应用端口；附件由服务端读写 MinIO，不签发浏览器直连的 presigned URL。

## 快速启动（Docker）

在 Linux 或任意已安装 Docker / Compose 的环境：

```bash
cp .env.example .env
# 编辑 .env：JWT_SECRET、ADMIN_INITIAL_PASSWORD、APP_BASE_URL、AUTHING_*、MinIO

docker compose up -d db minio
docker compose --profile app up -d --build
# 在受控 Worker 主机配置 DWS_CONFIG_DIR 后：
docker compose --profile worker up -d --build dws-worker
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

## Authing 登录与权限边界

生产环境必须同时配置 `AUTHING_ISSUER`、`AUTHING_CLIENT_ID`、`AUTHING_CLIENT_SECRET`。登录使用 OIDC Authorization Code + PKCE、`state`、`nonce`、issuer/audience 校验，并将 `issuer + sub` 写入 `user_identities`；成功后仍签发现有 `qe-session`。

Authing claims 只用于身份识别和资料同步，不直接授予平台管理员、工作台或 AI 资源权限。账号 `status`、本地角色、项目成员关系和禁用状态继续由本地数据库决定。开发环境在未配置 Authing 时保留本地登录，生产环境不提供匿名或静默降级。

## DWS Worker 与通知

Web 服务只把组织同步、审批待办、审批结果和资源发布广播写入 `external_job_outbox`，不会读取 DWS 登录态，也不会在 HTTP 请求中启动 `dws`。独立 Worker 运行：

```bash
pnpm dws:worker
```

Worker 通过 `dws contact ...` 同步部门和成员，按工号/邮箱匹配本地用户，姓名冲突进入未匹配统计；通过 `dws todo task create/done` 和 `dws chat message send` 投递通知。任务带幂等键、重试上限、失败原因和外部 ID，目录同步失败时保留上次成功组织快照。

`DWS_CONFIG_DIR`、DWS CLI 登录态和专用账号只放在 Worker/运维机，不放入 Web 镜像或前端环境。企业若未提供可持续的专用 DWS 身份，Worker 必须停用并转人工处理，不能把任务标记为成功。

`Dockerfile.worker` 不猜测或内置公司私有 dws-cli 包；部署容器前必须使用公司 Worker 基础镜像/扩展镜像提供 `dws` 可执行文件，或直接在受控主机运行 `pnpm dws:worker`。先执行 `dws schema` 和相关命令的 `--help`，确认组织、Todo、Chat 参数与权限后再启用自动任务。

历史钉钉用户迁移默认先 dry-run：

```bash
pnpm authing:migrate-identities --manifest ./authing-users.json
pnpm authing:migrate-identities --manifest ./authing-users.json --apply
```

迁移只按唯一工号或邮箱匹配，不按昵称自动合并；角色、权限和禁用状态不会被迁移脚本覆盖。历史钉钉待办字段保留为 legacy，新任务只使用通用 `external_*` 字段。

生产启动由 `instrumentation.ts` 自动完成：等待 PostgreSQL → advisory lock → migration → 幂等 bootstrap → MinIO bucket → 解锁。每个阶段都有重试和日志；迁移、bootstrap 或 bucket 初始化在重试耗尽后会阻止应用进入 ready 状态。构建阶段不连接数据库或 MinIO，构建前会自动执行 migration 预检。

部署与运维细节见 [application-runbook.md](00-docs/deployment/application-runbook.md)。
