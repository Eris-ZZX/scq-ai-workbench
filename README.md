# QE 工作台

QE 工作台是供应链质量团队使用的 Next.js 全栈应用，包含项目与 NPQ 活动、任务、AI 资源库、本地账号、钉钉扫码登录/通知以及管理后台。

## 技术栈

- Next.js 16、React 19、TypeScript
- PostgreSQL 17、Drizzle ORM 与版本化 migration
- MinIO 私有对象存储
- JWT Cookie、本地账号与钉钉认证
- pnpm 11.6.0、Node.js 20

应用位于仓库根目录。页面在 `app/`，通用组件在 `components/`，服务端及业务模块在 `lib/`，数据库定义在 `db/`，版本化 migration 在 `drizzle/`。

## 本地运行

```bash
corepack enable
corepack prepare pnpm@11.6.0 --activate
pnpm install --frozen-lockfile
docker compose up -d db minio
pnpm dev
```

无 Docker 时，可用本机便携 PostgreSQL（与 DevLauncher 相同）：

```bat
D:\AI\postgresql17\pgsql\bin\pg_ctl.exe start -D D:\AI\pgdata -l D:\AI\pgdata\server.log
```

并自行提供 MinIO（或沿用已有本地 MinIO 进程）。先将 `.env.example` 复制为 `.env` 并填写变量。空数据库首次启动必须配置 `ADMIN_INITIAL_PASSWORD`；创建 `admin` 后，后续启动不会重置密码。

## 数据库

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:bootstrap
```

生产启动会自动等待 PostgreSQL、获取 advisory lock、执行 migration、幂等初始化基础字典和内置 NPQ 模板、创建/复用 MinIO bucket。生产环境禁止使用 `drizzle-kit push`。

## 构建和启动

```bash
pnpm build
pnpm start
```

构建阶段不会连接 PostgreSQL 或 MinIO。运行期缺少数据库、首次管理员密码或 MinIO 必填变量时，服务启动失败。

## 质量门禁

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

部署说明见 [application-runbook.md](00-docs/deployment/application-runbook.md)。
