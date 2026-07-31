# Quality Workbench App 部署说明

本文档面向 IT 部署和运维人员，说明如何在服务器上部署、启动和维护质量工作台应用。

## 1. 应用概览

该应用是基于 Next.js 的全栈 Web 应用：

```text
Browser
  -> Next.js 页面
  -> Next.js API Routes
  -> Prisma Client
  -> PostgreSQL 数据库
```

当前仓库中的 `quality-workbench-app` 是实际应用目录。项目包含前端页面、后端接口、数据库 schema 和迁移文件。

## 2. 运行环境要求

建议服务器准备以下环境：

```text
Node.js 20 LTS 或更新版本
npm
Git
PostgreSQL 17（推荐用 Docker 运行,见下方 docker-compose.yml）
```

> 应用推荐生产用 `npm run start:prod`（自动拼库连接并 migrate）。数据库为 PostgreSQL。本地开发与生产共用同一份 `docker-compose.yml` 启动 PostgreSQL：端口只绑 `127.0.0.1:5432`,不对外暴露。也可 `docker compose --profile app up -d --build` 同时起应用容器。

如需通过 Nginx、IIS 或其他网关暴露服务，请将外部访问地址反向代理到应用监听端口。

## 3. 首次部署

进入应用目录：

```bash
cd quality-workbench-app
```

安装依赖：

```bash
npm ci
```

创建环境变量文件：

```bash
touch .env
```

Windows PowerShell 示例：

```powershell
New-Item -ItemType File -Path .env -Force
```

然后按下方“环境变量”章节填写配置。

启动 PostgreSQL（Docker,首次会拉取 postgres:17 镜像）：

```bash
docker compose up -d db
```

> 生产环境请先在同目录 `.env` 设置强 `POSTGRES_PASSWORD`（以及 `JWT_SECRET`）。  
> 使用 `npm run start:prod` 或官方镜像入口时，**可不填 `DATABASE_URL`**：启动脚本会按 `POSTGRES_*` 自动拼接，并在库就绪后执行 `prisma migrate deploy`。

生成 Prisma Client：

```bash
npx prisma generate
```

如不用启动脚本、而是手动启进程，再执行数据库迁移：

```bash
npx prisma migrate deploy
```

`migrate deploy` 只会执行库里尚未应用的迁移，可重复执行、安全增量升级。`git pull` / 发版**不会**自动改库结构；用 `start:prod` / Docker ENTRYPOINT 时会在启动时自动跑一遍。

近期与 AI 资源库相关、生产上需确认已打上的迁移包括：

| 迁移 | 作用 |
| --- | --- |
| `20260730120000_ai_resource_search_trgm` | 启用 `pg_trgm`，为名称/说明/正文等建立搜索索引 |
| `20260730140000_ai_review_assignee_index` | 为审批单 `reviewerId` 建索引（指定审批人列表） |
| `20260730160000_dingtalk_notify` | 钉钉 userid / 待办字段、`AppSetting` 配置表 |
| `20260730170000_dingtalk_rework_todo` | 驳回后提交人待办字段 |
| `20260731080000_ai_resource_comments` | 资源评论表 + `createdAt` 索引 |

检查是否已应用：

```bash
npx prisma migrate status
```

如是全新数据库，需要初始化基础数据：

```bash
npm run db:seed
```

> 默认**不会**在启动时自动 seed。仅当设置 `RUN_SEED_ON_BOOT=true` 时，`start:prod` / 容器入口才会执行 seed（生产慎用，会重置 `admin` 密码）。

seed 仅创建超级管理员 `admin` / `zx123456`：

- 系统角色：`User.role = admin`（工作台 / NPQ / 系统后台全开）
- AI 资源模块：`AiResourceMembership.role = admin`（资源库后台、直改/归档、审批管理）

生产环境请尽快修改该密码。不包含演示测试账号。

构建应用：

```bash
npm run build
```

启动应用（推荐生产：自动拼 DATABASE_URL + 等库 + migrate）：

```bash
npm run start:prod
```

或仅启动 Next（需已自行配置 `DATABASE_URL` 并完成迁移）：

```bash
npm run start
```

一键起库+应用（Docker Compose，需已配置 `JWT_SECRET`）：

```bash
docker compose --profile app up -d --build
```

默认监听端口由 Next.js 决定，通常是 `3000`。可通过环境变量指定：

```bash
PORT=3000 npm run start:prod
```

Windows PowerShell 示例：

```powershell
$env:PORT="3000"
npm run start:prod
```

## 4. 环境变量

生产环境**最小**配置（推荐，交给启动脚本拼连接串）：

```env
JWT_SECRET="replace-with-a-long-random-secret"
POSTGRES_USER="qe"
POSTGRES_PASSWORD="强密码"
POSTGRES_DB="qe"
# 宿主机连本机 compose 库时用 localhost；compose 内 app 服务已设 POSTGRES_HOST=db
POSTGRES_HOST="localhost"
POSTGRES_PORT="5432"
```

也可用显式连接串覆盖（优先级更高）：

```env
DATABASE_URL="postgresql://qe:强密码@localhost:5432/qe?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
```

说明：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | 是 | 登录会话签名密钥。生产环境必须配置，建议使用 32 位以上随机字符串。 |
| `POSTGRES_PASSWORD` | 条件必填 | 与 `docker-compose` 的库密码一致。未设 `DATABASE_URL` 时必填；生产勿用 `dev`。 |
| `POSTGRES_USER` / `POSTGRES_DB` | 否 | 默认均为 `qe`。 |
| `POSTGRES_HOST` / `POSTGRES_PORT` | 否 | 默认 `localhost` / `5432`；compose 内 app 用 `db`。 |
| `DATABASE_URL` | 否 | 可选。已设置则直接使用；未设置时由 `POSTGRES_*` 自动生成。 |
| `RUN_SEED_ON_BOOT` | 否 | `true` 时启动脚本会执行 `db:seed`（默认关闭）。 |
| `SKIP_MIGRATE_ON_BOOT` | 否 | `true` 时跳过启动时 `migrate deploy`。 |
| `DINGTALK_CLIENT_ID` | 条件必填 | 钉钉企业内部应用 AppKey。启用钉钉登录或 AI 资源通知时必填。 |
| `DINGTALK_CLIENT_SECRET` | 条件必填 | 钉钉应用 AppSecret。与 Client ID 成对配置。 |
| `DINGTALK_REDIRECT_URI` | 条件必填 | 钉钉 OAuth 回调地址。启用钉钉扫码登录时必填，须与开放平台一致。 |
| `DINGTALK_AGENT_ID` | 条件必填 | 钉钉微应用 AgentId。工作通知 / 上线广播必填；仅扫码登录可不配。 |
| `APP_BASE_URL` | 条件必填 | 对外可访问的站点根地址（无末尾斜杠）。待办与工作通知里的详情链接依赖它，如 `https://qe.example.com`。 |
| `ALLOWED_DEV_ORIGINS` | 否 | 开发环境跨主机访问白名单，生产环境通常不需要。 |

说明：AI 资源库为产品内置模块，默认启用，无需额外开关。

全新库执行 `npm run db:seed` 后仅创建超级管理员 `admin` / `zx123456`（系统管理员 + AI 资源模块管理员），生产环境请尽快修改密码。不包含演示测试账号。

部署红线：

- 推荐用 `npm run start:prod` 或镜像 ENTRYPOINT：自动拼 `DATABASE_URL`、等待库就绪、执行 `migrate deploy`。
- 生产 `POSTGRES_PASSWORD` 必须为强密码；与 compose 中库账号一致。显式 `DATABASE_URL` 时也须指向同一库。
- 数据库端口只绑 `127.0.0.1`,不要对公网暴露 `5432`。
- 重新部署代码不会自动删除数据库;数据存放在 Docker 命名卷 `qe_pgdata`,需单独做备份。
- AI 资源附件在磁盘目录 `storage/ai-resources/uploads/`（不进 Git），升级代码时勿清空该目录；备份与容灾需一并覆盖。
- `JWT_SECRET` 变更后，已有登录会话会失效。
- 若 Nginx 等反向代理托管上传，请将 `client_max_body_size` 调到至少 **100m**（单附件上限 100MB；托管 HTML 上限 5MB）。
- 镜像 / `start:prod` 已内置 migrate；若平台自管 CMD 且不用本入口，仍需能执行 `prisma`（勿在 `npm ci --omit=dev` 后无 prisma 再迁库）。

注意：

- 不要将 `.env` 提交到 Git。
- 生产环境务必设置强 `POSTGRES_PASSWORD`,不要沿用本地开发的弱密码。
- 定期对 PostgreSQL 做备份(如 `pg_dump`),重要数据勿仅依赖单机命名卷。
- 部署面板若只注入运行时变量：至少配置 `JWT_SECRET` + `POSTGRES_PASSWORD`（及可选钉钉）；**不必再配 `DATABASE_URL`**，除非要覆盖自动拼接。

## 4.1 钉钉登录与通知配置

AI 资源审批通知、驳回返工待办、上线广播，与钉钉扫码登录共用**同一个企业内部应用**。不配钉钉时，资源库审批仍可在 Web 内完成，只是不会发工作通知 / 待办。

### 4.1.1 能力与环境变量对照

| 能力                 | 需要的环境变量                                                               | 备注                      |
| ------------------ | --------------------------------------------------------------------- | ----------------------- |
| 钉钉扫码登录             | `DINGTALK_CLIENT_ID`、`DINGTALK_CLIENT_SECRET`、`DINGTALK_REDIRECT_URI` | 开放平台回调地址须完全一致           |
| 审批工作通知（提交/通过/驳回）   | 上表三项 + `DINGTALK_AGENT_ID` + `APP_BASE_URL`                           | 走企业内部应用工作通知，**不发群机器人**  |
| 审批人高优先级待办 / 驳回返工待办 | 同上（含 AgentId、APP_BASE_URL）                                            | 开放平台需开通待办写权限            |
| 新建/更新资源上线广播        | 同上                                                                    | 后台可开关；默认开启；只推已绑定钉钉的模块成员 |

生产示例（将域名换成实际对外地址）：

```env
DINGTALK_CLIENT_ID="钉钉应用 AppKey"
DINGTALK_CLIENT_SECRET="钉钉应用 AppSecret"
DINGTALK_REDIRECT_URI="https://你的域名/api/auth/dingtalk/callback"
DINGTALK_AGENT_ID="微应用 AgentId"
APP_BASE_URL="https://你的域名"
```

注意：

- `APP_BASE_URL` **不要**末尾斜杠；生产必须是员工浏览器能打开的 HTTPS 根地址。
- `DINGTALK_AGENT_ID` 为开放平台「应用信息」里的 **AgentId**（数字），不是 AppKey。
- 修改 `.env` 后必须**重启**应用进程（`npm run start` / PM2 / systemd），后台「环境检查」才会变为已配置。

### 4.1.2 钉钉开放平台准备清单

1. 创建或选用**企业内部应用**（与扫码登录同一应用）。
2. 记录 **AppKey**、**AppSecret**、**AgentId**，写入服务器 `.env`。
3. 登录与分享 → 配置回调域名 / 重定向 URL：

```text
https://你的域名/api/auth/dingtalk/callback
```

必须与 `DINGTALK_REDIRECT_URI` 完全一致（协议、域名、端口、路径）。项目固定路径为 `/api/auth/dingtalk/callback`。

1. 权限管理中开通（名称以开放平台当前文案为准）：
  1. **待办写权限**（创建 / 完成个人待办，对应 Todo API）
  2. **企业内工作通知** / 消息通知相关权限（`asyncsend_v2`）
  3. 通讯录按需开通「根据 unionId 获取 userid」类权限（用于把登录用户映射到工作通知接收人）
2. 如开放平台要求 **服务器出口 IP 白名单**，把应用服务器公网出口 IP 加进去。
3. 将应用发布给需要使用资源库的员工可见范围（至少覆盖审批人与模块成员）。

### 4.1.3 业务行为说明

1. **提交审批**（新建 / 变更 / 归档）：给指定审批人发工作通知 + 高优先级待办（`priority=40`）；详情经 `/api/auth/entry?next=...` 恢复登录后进入 `/ai-resources/review/{id}`。PC 端待办尽量用系统浏览器打开（`pc_slide=false`）。
2. **审批通过 / 驳回**：完成审批人待办；通过时通知提交人；驳回时给提交人再建**返工待办**。
3. **驳回后再提 / 废弃**：完成提交人返工待办。
4. **新建 / 更新审批通过**（含管理员后台直改发布）：若「AI 资源后台 → 钉钉通知」开关开启（未保存过时默认开启），向已绑定钉钉的模块成员分批发工作通知；**归档 / 删除通过不广播**。
5. **用户绑定**：员工需至少用钉钉扫码登录一次，系统才会落库 `unionId` / `dingtalkUserId`；未绑定则收不到工作通知与待办。
6. 管理入口：`/ai-resources/admin/dingtalk`（环境检查三项 + 测试通知 + 上线广播开关）。

### 4.1.4 反向代理注意

若经 Nginx / IIS 等反向代理：

- 正确传递 `Host`、`X-Forwarded-Proto`、`X-Forwarded-For`，保证 Cookie 与登录跳转使用 HTTPS 公网域名。
- `APP_BASE_URL` / `DINGTALK_REDIRECT_URI` 使用**对外**域名，不要写 `http://127.0.0.1:3000`。

## 5. 数据库

数据库 schema 位于：

```text
prisma/schema.prisma
```

迁移文件位于：

```text
prisma/migrations/
```

常用命令：

```bash
# 检查迁移状态
npx prisma migrate status

# 生产部署迁移
npx prisma migrate deploy

# 生成 Prisma Client
npx prisma generate

# 初始化种子数据
npm run db:seed
```

本地开发数据库由 `docker compose up -d db` 启动的 PostgreSQL 提供。可用显式 `DATABASE_URL`，或只配 `POSTGRES_*` 后执行 `npm run start:prod`：

```env
DATABASE_URL="postgresql://qe:dev@localhost:5432/qe?schema=public"
```

生产环境使用服务器上运行的 PostgreSQL,凭据换成强密码,数据落在 Docker 命名卷 `qe_pgdata`。重置本地库可用:

```bash
docker compose down -v && docker compose up -d db
npx prisma migrate deploy && npm run db:seed
```

## 6. 更新部署

当代码有新版本时，建议按以下顺序更新：

```bash
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
# 然后重启进程（npm run start:prod / PM2 / systemd 等）
```

说明：

1. **`npx prisma migrate deploy` 不可省略**（若不用 `start:prod` / 镜像入口自动 migrate）。只 pull + build 不会应用新索引/表结构。本次版本尤其确认下列迁移均为 Applied：`ai_resource_search_trgm`、`ai_review_assignee_index`、`dingtalk_notify`、`dingtalk_rework_todo`、`ai_resource_comments`。
2. **已有生产库不要重复 `db:seed`**，也不要开 `RUN_SEED_ON_BOOT`，否则会把 `admin` 密码重置回 `zx123456`。仅全新空库需要 seed。
3. 如果使用 PM2、systemd、Docker 或其他进程管理工具，请在 `npm run build` 后重启对应服务；推荐 CMD 使用 `npm run start:prod` 或镜像默认 ENTRYPOINT。
4. 常规版本更新只更新代码与构建产物，**不会删除** `storage/` 下的用户上传附件。
5. 若启用钉钉通知：确认生产 `.env` 已含第 4.1 节变量，重启后再打开 `/ai-resources/admin/dingtalk` 看环境检查三项均为「已配置」。

## 7. 启动方式建议

开发调试：

```bash
npm run dev
```

生产运行：

```bash
npm run build
npm run start:prod
```

PM2 示例：

```bash
pm2 start npm --name quality-workbench -- run start
pm2 save
```

Nginx 反向代理示例：

```nginx
server {
  listen 80;
  server_name your-domain.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 8. 部署后验证

启动后访问：

```text
http://服务器地址:3000/login
```

建议验证：

```text
1. 登录页可以打开。
2. 用户可以登录（账号密码；若启用钉钉则扫码登录可用）。
3. 项目工作台可以打开。
4. 项目详情页可以读取项目、TR 时间轴和试产计划。
5. 计划维护页面可以保存数据。
6. （钉钉）管理员打开 /ai-resources/admin/dingtalk：三项环境检查为已配置；点「发送测试通知给我」能在钉钉收到工作通知。
7. （钉钉）用已扫码绑定的账号提交一条资源审批，审批人应收到工作通知 + 待办；通过/驳回后待办应关闭。
```

也可以用命令检查：

```bash
curl -I http://127.0.0.1:3000/login
npx prisma migrate status
```

正常情况下登录页应返回 `200` 或 `307` 等有效 HTTP 状态；迁移状态应为 Database schema is up to date。

## 9. 目录说明

```text
src/app/               Next.js 页面和 API 路由
src/lib/db/            业务数据访问层
src/platform/          鉴权、权限、观测、布局等平台能力
prisma/schema.prisma   数据库模型
prisma/migrations/     数据库迁移
prisma/seed.ts         初始化数据脚本
public/                静态资源
storage/ai-resources/uploads/   AI 资源附件（运行时生成，不进 Git）
```

### 9.1 AI 资源附件持久化（IT 必读）

AI 资源库上传的 HTML / 附件等文件保存在应用工作目录：

```text
quality-workbench-app/storage/ai-resources/uploads/
```

该目录**不在 Git 中**，数据库只保存文件名等引用；真正文件在服务器磁盘上。

**正常版本更新不会丢文件。** 例如：

```text
git pull → npm ci → prisma migrate deploy → npm run build → 重启进程
```

只会更新代码、`node_modules/`、`.next/`，不会动 `storage/`。

**会丢失附件的场景：**

| 场景                               | 是否丢失  |
| -------------------------------- | ----- |
| `git pull` / 发版重启                | 否     |
| 只删除 `.next/`、`node_modules/` 后重装 | 否     |
| 清空或删除整个应用目录后重装                   | **是** |
| 换机器未拷贝 `storage/`                | **是** |
| 容器无挂卷、每次重建容器                     | **是** |
| 误删 `storage/`                    | **是** |

**运维要求：**

1. 使用固定部署目录，升级时覆盖代码，不要整目录清空重装。
2. 备份策略需同时备份 PostgreSQL 与 `storage/ai-resources/`（至少包含 `uploads/`）。
3. 若用 Docker / 容器运行应用进程，请为 `storage/ai-resources` 挂载持久卷（volume / bind mount）。
4. 迁移到新服务器时，除数据库外，需同步拷贝 `storage/ai-resources/uploads/`。

附件丢失后的表现：库中资源记录仍在，但打开/下载附件失败。

## 10. 不应上传或部署的本地文件

以下文件通常不应进入 Git，也不应作为部署包固定上传：

```text
node_modules/
.next/
.env
*.log
*.tsbuildinfo
```

说明：

- `node_modules/` 由 `npm ci` 安装生成。
- `.next/` 由 `npm run build` 生成。
- 数据库数据存放在 Docker 命名卷 `qe_pgdata`,不在仓库目录内。
- `.env` 包含环境变量和密钥，应由服务器单独配置。
- `storage/ai-resources/` 为运行时附件目录，不进 Git，但**服务器上必须保留并纳入备份**，不要当作可随意清理的缓存。

## 11. 常见问题

### 11.1 生产环境启动时报 `JWT_SECRET is required in production`

原因：未配置 `JWT_SECRET`。

处理：在 `.env` 或服务器环境变量中配置：

```env
JWT_SECRET="replace-with-a-long-random-secret"
```

### 11.2 数据库迁移失败

先检查状态：

```bash
npx prisma migrate status
```

如果是新环境，通常执行：

```bash
npx prisma migrate deploy
```

如果是已有数据库出现迁移记录不一致，不要直接删除表或数据库，应先备份数据库，再由开发人员确认处理方式。

### 11.3 页面能打开，但数据为空

可能原因：

```text
1. 连接到了新的空数据库。
2. 没有执行 npm run db:seed。
3. DATABASE_URL 指向了错误的数据库文件。
```

处理：

```bash
npx prisma migrate status
npm run db:seed
```

并确认 `.env` 中的 `DATABASE_URL`。

### 11.4 数据库连接失败

确认 PostgreSQL 容器在运行,且 `.env` 的 `DATABASE_URL` 与 `docker-compose.yml` 凭据一致。

示例：

```bash
docker compose ps          # 确认 db 容器为 healthy
docker compose logs db      # 查看数据库日志
npx prisma migrate status   # 检查迁移状态
```

### 11.5 钉钉通知发不出去 / 后台显示未配置

按顺序核对：

```text
1. .env 是否含 DINGTALK_CLIENT_ID / SECRET、DINGTALK_AGENT_ID、APP_BASE_URL（以及登录用的 REDIRECT_URI）。
2. 修改 .env 后是否已重启应用进程。
3. APP_BASE_URL / REDIRECT_URI 是否为对外 HTTPS 域名，而非 localhost。
4. 开放平台是否开通待办写权限与工作通知权限；出口 IP 是否已加白。
5. 接收人是否已用钉钉扫码登录过本系统（落库 dingtalkUserId）。
6. 服务器日志是否出现 [dingtalk] 相关 warn/error。
```

管理页 `/ai-resources/admin/dingtalk` 的「环境检查」与「发送测试通知」可快速定位是环境变量问题还是开放平台权限问题。

## 12. 版本同步

当前部署仓库建议只保留运行所需代码、配置、数据库迁移和种子数据。文档、原型、测试、AI 协作过程记录等内容不作为部署必需文件提交。