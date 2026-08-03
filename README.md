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
pnpm db:generate   # 生成 migration（提交产物；生产禁止 drizzle-kit push）
pnpm db:migrate
pnpm db:bootstrap
```

生产启动由 `instrumentation.ts` 自动完成：等待 PostgreSQL → advisory lock → migration → 幂等 bootstrap → MinIO bucket → 解锁。构建阶段不连接数据库或 MinIO。

部署与运维细节见 [application-runbook.md](00-docs/deployment/application-runbook.md)。
