# QE 工作台部署手册

## 运行契约

- Node.js 22.13+（安装、构建和直接运行 pnpm 11.6.0）
- Node.js 20（仅最终 standalone 容器运行时）
- pnpm 11.6.0
- PostgreSQL 17
- MinIO/S3 兼容私有对象存储
- `pnpm start` 等同于 `next start`，不使用递归启动脚本
- 生产 Docker 镜像在 standalone 产物内执行 `node server.js`（见 `Dockerfile` `CMD`）

标准命令：

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

`pnpm@11.6.0` 自身要求 Node.js 22.13+；因此不能在 Node.js 20 上直接执行上述
pnpm 命令。生产 Docker 镜像使用 Node.js 22 构建，最终 standalone runner 继续使用
Node.js 20。非容器部署必须使用 Node.js 22.13+。

本地开发若已配置 `output: "standalone"`，`next start` 可能打印提示改用
`node .next/standalone/server.js`；当前版本下 `pnpm start` 仍可完成
instrumentation 初始化。容器部署请始终使用镜像内的 `node server.js`。

`instrumentation.ts` 在服务接收请求前完成以下操作：

1. 等待 PostgreSQL；
2. 获取 PostgreSQL advisory lock；
3. 执行 `drizzle/` 中尚未应用的 migration；
4. 幂等插入基础阶段、岗位、项目角色、组件和内置 NPQ 模板；
5. 空库创建 `admin` 和对应 AI 资源管理员权限；
6. 创建或复用 MinIO bucket；
7. 释放 advisory lock。

任一步骤失败都会阻止服务就绪。多实例同时启动时，初始化由 advisory lock 串行化。

## 环境变量

必填：

```dotenv
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=long-random-secret
APP_BASE_URL=https://qe.example.com

MINIO_ENDPOINT=minio.example.com
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=qe-workbench
```

空数据库首次启动还必须提供：

```dotenv
ADMIN_INITIAL_PASSWORD=...
```

管理员账号存在后不会再读取该变量来重置密码。密码不会写入日志。

钉钉能力按需配置：

```dotenv
DINGTALK_CLIENT_ID=
DINGTALK_CLIENT_SECRET=
DINGTALK_REDIRECT_URI=
DINGTALK_AGENT_ID=
```

不使用 Authing，也没有 Authing 环境变量。

## 数据与存储

`drizzle/0000_initial.sql` 是空库的初始结构，包含 40 个业务模型。新增结构变更必须：

```bash
pnpm db:generate
```

提交生成的 migration；生产环境禁止执行 `drizzle-kit push`。

附件由服务端读写 MinIO，浏览器不直连 MinIO，也不签发 presigned URL。对象位于：

```text
ai-resources/uploads/<storedName>
```

本次重构不迁移旧数据库记录或本地附件。

## 容器部署

本地联调：

```bash
docker compose up -d db minio
docker compose --profile app up -d --build
```

生产建议连接独立的新 PostgreSQL 数据库和独立 MinIO bucket。验收后切换入口；回滚时恢复旧应用及旧资源连接。

## 发布门禁

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

还需在预生产执行：

- 空库首次启动；
- 两实例并发启动；
- MinIO 上传、下载、HTML CSP 与 404；
- 本地 admin 登录；
- 钉钉扫码、岗位同步、工作通知和待办 smoke test。
