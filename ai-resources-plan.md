# AI 资源社区 — 方案概要

## 定位

团队共用的 AI 资源集合页，不限资源类型（agent、skill、web 应用、prompt 模板等），轻量录入，文档管理式界面。

## 路由

- 页面：`/(dashboard)/ai-resources`
- API：`/api/ai-resources`
- 左侧导航：新增 "AI资源社区" 入口，与"个人项目工作台"平级

## 数据模型

一个表 `AiResource`：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (cuid) | 主键 |
| name | String | 资源名称 |
| description | String? | 简短描述 |
| url | String? | 资源链接 |
| tags | String (JSON 数组) | 标签，如 `["agent","代码"]` |
| contributedBy | String? | 贡献者 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

## 功能

### 浏览
- 文档管理风格的列表视图（非卡片网格）
- 支持按名称搜索
- 支持按标签筛选

### 管理
- 所有人可浏览、搜索、筛选
- 登录用户可新增
- 创建者可编辑/删除自己的资源
- 管理员可编辑/删除所有资源

### 页面布局
- 顶部：标题 + "新增资源"按钮
- 搜索栏：名称搜索 + 标签筛选
- 主体：表格/列表展示，列为 名称、描述、标签、链接、贡献者、操作
- 新增/编辑：弹窗或侧边抽屉表单

## 实施步骤

1. Prisma schema 新增 `AiResource` 模型 → migrate
2. API Route：`GET /api/ai-resources` + `POST/PATCH/DELETE`
3. 前端页面 `/(dashboard)/ai-resources/page.tsx`
4. 导航 `DynamicNav` 添加入口
5. `ComponentConfig` 注册路由

## 待确认

- 标签是自由输入还是预设可选？（建议自由输入 + 列出已有标签供快速选择）
- 文档管理风格是否指：左侧分类树/标签目录 + 右侧列表？（建议先做单列表 + 标签筛选，后续再加左侧目录）
