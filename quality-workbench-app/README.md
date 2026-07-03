# Quality Workbench App 部署说明

本文档面向 IT 部署和运维人员，说明如何在服务器上部署、启动和维护质量工作台应用。

## 1. 应用概览

该应用是基于 Next.js 的全栈 Web 应用：

```text
Browser
  -> Next.js 页面
  -> Next.js API Routes
  -> Prisma Client
  -> SQLite 数据库文件
```

当前仓库中的 `quality-workbench-app` 是实际应用目录。项目包含前端页面、后端接口、数据库 schema 和迁移文件。

## 2. 运行环境要求

建议服务器准备以下环境：

```text
Node.js 20 LTS 或更新版本
npm
Git
可写的数据目录，用于存放 SQLite 数据库文件
```

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

生成 Prisma Client：

```bash
npx prisma generate
```

执行数据库迁移：

```bash
npx prisma migrate deploy
```

如是全新数据库，需要初始化基础数据：

```bash
npm run db:seed
```

构建应用：

```bash
npm run build
```

启动应用：

```bash
npm run start
```

默认监听端口由 Next.js 决定，通常是 `3000`。可通过环境变量指定：

```bash
PORT=3000 npm run start
```

Windows PowerShell 示例：

```powershell
$env:PORT="3000"
npm run start
```

## 4. 环境变量

生产环境至少需要配置：

```env
DATABASE_URL="file:/absolute/path/to/prod.db"
JWT_SECRET="replace-with-a-long-random-secret"
```

说明：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | SQLite 数据库连接地址。生产环境建议使用绝对路径，例如 `file:/data/qeworkbench/prod.db`。 |
| `JWT_SECRET` | 是 | 登录会话签名密钥。生产环境必须配置，建议使用 32 位以上随机字符串。 |
| `DINGTALK_CLIENT_ID` | 否 | 钉钉扫码登录应用 ID。启用钉钉登录时需要。 |
| `DINGTALK_CLIENT_SECRET` | 否 | 钉钉扫码登录应用密钥。启用钉钉登录时需要。 |
| `DINGTALK_REDIRECT_URI` | 否 | 钉钉 OAuth 回调地址。启用钉钉登录时需要。 |
| `ALLOWED_DEV_ORIGINS` | 否 | 开发环境跨主机访问白名单，生产环境通常不需要。 |

部署红线：

- 生产环境 `DATABASE_URL` 必须指向服务器固定数据目录，不要使用仓库目录内的 `dev.db`。
- 重新部署代码不会自动删除数据库；只有当 `DATABASE_URL` 指向新的或不存在的文件时，才会创建新库。
- `JWT_SECRET` 变更后，已有登录会话会失效。

注意：

- 不要将 `.env` 提交到 Git。
- 不要在多个应用实例同时写同一个本地 SQLite 文件，容易产生锁冲突。
- 如果需要多人长期稳定使用，建议将 SQLite 文件放在服务器本地磁盘，并做好定期备份。

## 4.1 钉钉登录配置

如需保留钉钉扫码登录，IT 需要在钉钉开放平台准备企业内部应用，并在服务器环境变量中配置：

```env
DINGTALK_CLIENT_ID="钉钉应用 Client ID"
DINGTALK_CLIENT_SECRET="钉钉应用 Client Secret"
DINGTALK_REDIRECT_URI="https://你的域名/api/auth/dingtalk/callback"
```

项目固定回调路径为：

```text
/api/auth/dingtalk/callback
```

钉钉开放平台后台配置的回调地址必须与 `DINGTALK_REDIRECT_URI` 完全一致，包括协议、域名、端口和路径。

示例：

```text
https://qeworkbench.example.com/api/auth/dingtalk/callback
```

如果应用通过 Nginx、IIS 或其他网关反向代理，代理需要正确传递原始协议和域名，否则可能导致回调地址、Cookie 安全属性或登录跳转异常。

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

本地开发默认数据库文件通常是：

```text
quality-workbench-app/dev.db
```

生产环境建议不要使用仓库目录内的 `dev.db`，应将数据库文件放到服务器数据目录，例如：

```env
DATABASE_URL="file:/data/qeworkbench/prod.db"
```

## 6. 更新部署

当代码有新版本时，建议按以下顺序更新：

```bash
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start
```

如果使用 PM2、systemd、Docker 或其他进程管理工具，请在 `npm run build` 后重启对应服务。

## 7. 启动方式建议

开发调试：

```bash
npm run dev
```

生产运行：

```bash
npm run build
npm run start
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
2. 用户可以登录。
3. 项目工作台可以打开。
4. 项目详情页可以读取项目、TR 时间轴和试产计划。
5. 计划维护页面可以保存数据。
```

也可以用命令检查：

```bash
curl -I http://127.0.0.1:3000/login
```

正常情况下应返回 `200` 或 `307` 等有效 HTTP 状态。

## 9. 目录说明

```text
src/app/               Next.js 页面和 API 路由
src/lib/db/            业务数据访问层
src/platform/          鉴权、权限、观测、布局等平台能力
prisma/schema.prisma   数据库模型
prisma/migrations/     数据库迁移
prisma/seed.ts         初始化数据脚本
public/                静态资源
```

## 10. 不应上传或部署的本地文件

以下文件通常不应进入 Git，也不应作为部署包固定上传：

```text
node_modules/
.next/
dev.db
.env
*.log
*.tsbuildinfo
```

说明：

- `node_modules/` 由 `npm ci` 安装生成。
- `.next/` 由 `npm run build` 生成。
- `dev.db` 是本地开发数据库。
- `.env` 包含环境变量和密钥，应由服务器单独配置。

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

### 11.4 SQLite 文件权限问题

确保运行应用的系统用户对数据库文件和所在目录有读写权限。

示例：

```bash
mkdir -p /data/qeworkbench
chown -R appuser:appuser /data/qeworkbench
```

## 12. 版本同步

当前部署仓库建议只保留运行所需代码、配置、数据库迁移和种子数据。文档、原型、测试、AI 协作过程记录等内容不作为部署必需文件提交。
