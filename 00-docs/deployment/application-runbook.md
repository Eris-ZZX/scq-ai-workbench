# QE 工作台部署手册

目标环境：**Linux 生产服务器**，以 Docker Compose 运行 `app` + `db` + `minio`。

## 运行契约

- 宿主机：Linux（x86_64），已安装 Docker Engine 与 Docker Compose Plugin
- 构建阶段：Node.js 22.13+ / pnpm 11.6.0（Docker 多阶段 `deps`/`builder`）
- 运行阶段：Node.js 20 standalone（镜像内 `CMD ["node", "server.js"]`）
- 数据：PostgreSQL 17
- 对象存储：MinIO（S3 兼容）；浏览器不直连 MinIO
- `pnpm start` 等同于 `next start`；容器部署始终使用镜像内的 `node server.js`

`instrumentation.ts` 在服务接收请求前完成：

1. 等待 PostgreSQL；
2. 获取 PostgreSQL advisory lock；
3. 执行 `drizzle/` 中尚未应用的 migration；
4. 幂等初始化基础字典与内置 NPQ 模板；
5. 空库创建 `admin` 及对应 AI 资源管理员权限；
6. 创建或复用 MinIO bucket；
7. 释放 advisory lock。

任一步骤失败都会阻止服务就绪。多实例并发启动时由 advisory lock 串行化初始化。

## 推荐目录布局（Linux）

```text
/opt/qe-workbench-it/
  current/          # 当前发布目录（含 Dockerfile、docker-compose.yml、.env）
  releases/         # 可选：按时间戳保留历史发布包
  backup-*/         # 可选：切换前的备份目录
```

Compose 项目名建议固定，例如：

```bash
export COMPOSE_PROJECT_NAME=qe-it-workbench
```

## 环境变量

在发布目录维护 `.env`（勿提交仓库）。Compose 会注入 `app` / `db` / `minio`。

必填：

```dotenv
COMPOSE_PROJECT_NAME=qe-it-workbench

POSTGRES_USER=qe_it
POSTGRES_PASSWORD=...
POSTGRES_DB=qe_it
# 仅本机访问时可绑定回环，例如 55432
POSTGRES_HOST_PORT=55432

JWT_SECRET=long-random-secret
APP_HOST_PORT=3000
APP_BASE_URL=https://qe.example.com

MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=qe-workbench-it
MINIO_HOST_PORT=9100
MINIO_CONSOLE_HOST_PORT=9101

ADMIN_INITIAL_PASSWORD=...   # 仅空库首次创建 admin 需要

AUTHING_ISSUER=https://authing.example.com/oidc
AUTHING_CLIENT_ID=...
AUTHING_CLIENT_SECRET=...
```

`app` 容器内会使用 Compose 网络连接 `db` / `minio`（见 `docker-compose.yml`）。若不用 Compose 而直连外部库，则还需配置：

```dotenv
DATABASE_URL=postgresql://user:password@host:5432/database
MINIO_ENDPOINT=minio.example.com
MINIO_PORT=443
MINIO_USE_SSL=true
```

Authing 应用的回调地址须登记为：

```text
https://qe.example.com/api/auth/authing/callback
```

Authing 只负责身份认证；平台角色、工作台角色、AI 资源角色、项目成员关系和禁用状态仍由本地数据库维护。管理员账号存在后，不会再用 `ADMIN_INITIAL_PASSWORD` 重置密码；该值勿写入日志或文档明文。

## 公网入口与安全组

- 应用对公网暴露 **TCP `APP_HOST_PORT`（默认 3000）**。
- PostgreSQL / MinIO 端口应只绑定 `127.0.0.1`（Compose 默认如此），不要对公网开放。
- 在云厂商安全组 / 防火墙放行应用端口；宿主机 `firewalld`/`nftables` 若启用，需同步放行。
- 更新 `APP_BASE_URL` 或 `AUTHING_*` 后需重建/重启 `app`，并在 Authing 应用同步回调地址。

## 容器部署（Linux）

在发布目录（含源码或构建上下文、`Dockerfile`、`docker-compose.yml`、`.env`）：

```bash
cd /opt/qe-workbench-it/current

# 仅数据面
docker compose up -d db minio

# 构建并启动应用（profile: app）
docker compose --profile app up -d --build

# 受控 Worker 主机另行配置 DWS_CONFIG_DIR 后：
docker compose --profile worker up -d --build dws-worker
```

查看状态：

```bash
docker compose --profile app ps
docker compose --profile app logs -f --tail=200 app
```

健康检查通过后，本机验证：

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/login
```

再从办公网访问 `APP_BASE_URL`。

### 发布更新

```bash
cd /opt/qe-workbench-it/current
# 更新代码或替换发布目录后：
docker compose --profile app build app
docker compose --profile app up -d --force-recreate app
```

数据库与 MinIO 卷默认持久化（`qe_pgdata` / `qe_minio`）。除非明确要求，不要对生产卷执行 `docker compose down -v`。

### 回滚

1. 切回上一版发布目录或镜像标签；
2. `docker compose --profile app up -d`；
3. 确认 `APP_BASE_URL`、回调地址与安全组仍指向当前入口。

结构变更必须通过提交 `drizzle/` migration；**生产禁止 `drizzle-kit push`**。

## 数据与对象路径

- 初始结构：`drizzle/0000_initial.sql`（40 张业务表）
- 新增结构：本地/CI 执行 `pnpm db:generate`，提交 SQL 后由启动期自动 migrate
- MinIO 对象键：`ai-resources/uploads/<storedName>`

本次 IT 模板迁移不自动搬运旧库数据或旧主机本地磁盘附件。

## 发布门禁（构建机 / CI）

构建机需 Node.js 22.13+：

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

上线前在 Linux 预生产或生产旁路环境确认：

- 空库首次启动与 `admin` 创建；
- 两实例并发启动（advisory lock）；
- MinIO 上传、下载、托管 HTML、缺对象 404；
- Authing 登录、重复回调、禁用账号阻断；
- DWS 组织目录同步、岗位/主管匹配、通知/待办 outbox 和 Worker 失败重试。

## 常用排障

| 现象 | 排查 |
|------|------|
| 公网打不开、本机 `curl 127.0.0.1:3000` 正常 | 安全组 / 防火墙未放行应用端口 |
| 容器反复重启 | `docker compose logs app`；查 `DATABASE_URL`/MinIO/JWT/`ADMIN_INITIAL_PASSWORD` |
| Authing 回调失败 | `AUTHING_ISSUER`、OIDC discovery、`APP_BASE_URL` 与 Authing 回调白名单不一致 |
| DWS 任务持续失败 | 查看 `external_job_outbox` 和管理后台任务错误；确认 Worker 专用账号、`DWS_CONFIG_DIR`、`dws schema` 权限和组织可见范围 |
| 上传页在 `http://公网IP:端口` 白屏/加载失败 | 确认已部署含非安全上下文 ID 回退的版本；硬刷新缓存 |
