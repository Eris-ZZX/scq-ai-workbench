# F4 工作台可用性重构 — Build-ready 计划

> 状态：已完成实现与 fulltest。
> 核心定位：不扩展新业务能力，不新增数据表；把 F3 已有项目、活动、待办、附件、阶段门、通知等能力组织成真正可日常使用的质量项目工作台。

## 1. App Summary

F4 要把当前“功能集合式系统”重构为 **行动优先的质量项目工作台**。

用户登录后进入 `/workbench`，看到自己相关未完成项目、项目分组待办、轻量项目状态卡、极简行动指标和最近动态；点击待办后在右侧处理抽屉完成角色允许的动作；进入项目后先处理该项目待办，再查看活动结构。

原先计划进入 F4 的审批、交付件在线预览、外部通知等能力顺延到 F5。

## 2. User Roles

F4 需要固定 8 个测试账号，用于 fulltest 和角色化验收：

| 账号 | 角色 | 工作台视角 |
|---|---|---|
| `npq` | NPQ | 项目推进、跨角色协调、退回、关闭母任务、阶段门关注 |
| `pqe` | PQE | 本岗位/被任命项目的执行任务与异常 |
| `sqe` | SQE | 本岗位/被任命项目的执行任务与异常 |
| `fae` | FAE | 本岗位/被任命项目的执行任务与异常 |
| `ram` | RAM | 本岗位/被任命项目的执行任务与异常 |
| `qcm` | QCM | 本岗位/被任命项目的执行任务与异常 |
| `manager` | 管理者（领导） | 业务只读/督办视角，看项目态势与风险，不维护任务 |
| `admin` | 管理员（系统管理员） | 系统配置视角，主要进入后台配置；可查看工作台但不是主工作入口 |

## 3. MVP Feature List

- 新增 `/workbench` 业务主入口。
- 导航收敛为两个主入口：工作台、后台配置。
- 新增 `/api/npq/workbench` 聚合接口。
- 工作台单页承载核心模块，不做总览/项目/任务流/数据等二级视图切换。
- 首屏采用行动优先顺序：待处理任务、关注项目状态卡、风险/逾期/统计、最近动态。
- 默认展示我参与或被项目任命相关的所有未完成项目，包括 `active` 和 `paused`。
- 待办按项目分组；项目内按风险和时间排序。
- 项目卡轻量展示：项目名、当前阶段、进度、待处理数、风险标记、进入项目。
- 项目卡按关注程度排序：有我的待办、逾期/阻塞、阶段门卡点、待关闭、最近更新。
- 极简行动指标：待处理、逾期、阻塞、缺交付件、待关闭；点击即过滤任务流。
- 项目详情页以该项目待处理事项为主，下方保留活动结构入口。
- 待办采用任务流 + 右侧处理抽屉。
- 处理抽屉采用角色化动作集。
- 后台只轻量整理为配置中心，不重做模板、岗位、用户、组件、运行日志能力。

## 4. Explicit Non-goals

F4 不做：

- 新增数据表
- 全局搜索
- 用户关注/星标项目
- 审批功能
- 交付件在线预览
- 外部通知
- 后台完整信息架构重构
- 新图表/报表体系
- 移动端完整体验重构

## 5. Main User Workflow

1. 用户登录。
2. 系统根据账号角色、岗位绑定、项目成员和项目岗位任命生成工作台数据。
3. 用户默认看到相关未完成项目和按项目分组的待处理事项。
4. 用户点击行动指标过滤任务流，例如逾期、阻塞、缺交付件。
5. 用户点击某条待办，在右侧抽屉查看任务、母任务、项目、阶段、交付标准和最近动态上下文。
6. 一线角色在抽屉内更新状态、说明、附件、阻塞、完成任务。
7. NPQ 在抽屉内可执行退回、关闭母任务、不涉及、有限调整等管理动作。
8. 管理者进入抽屉只读查看，不维护任务。
9. 用户进入项目详情后，先看到该项目待处理事项，再查看阶段分组活动结构。
10. 管理员通过后台配置入口管理模板、岗位、用户、组件、运行日志。

## 6. Page And UI Spec

### `/workbench`

桌面优先，中等密度，单页结构：

1. 顶部工作台栏
   - 当前用户显示名、岗位/角色
   - 今日日期
   - 后台配置入口，仅管理员明显展示

2. 极简行动指标
   - 我的待处理
   - 逾期
   - 阻塞
   - 缺交付件
   - 待关闭母任务
   - 点击后过滤下方任务流

3. 按项目分组待办任务流
   - 项目标题行展示项目名、阶段、风险标记、待办数量
   - 项目内待办按风险/时间排序
   - 每条待办展示类型、标题、母任务、负责人/岗位、到期日、状态
   - 点击待办打开右侧处理抽屉

4. 轻量项目状态卡
   - 项目名
   - 当前阶段
   - 进度
   - 待处理数
   - 风险标记
   - 进入项目按钮

5. 风险/统计区域
   - 只展示行动指标对应的摘要，不做复杂图表

6. 最近动态
   - 展示当前用户相关项目的最近操作
   - 包括任务更新、退回、附件、母任务关闭、阶段门动作

### 项目详情页

F4 项目详情页应从“项目资料/阶段时间线为主”调整为：

1. 顶部项目概览
   - 项目名、当前阶段、整体进度、风险标记、待处理数量

2. 项目待办任务流
   - 先展示该项目待处理事项
   - 点击打开同一套右侧处理抽屉

3. 活动结构
   - 下方保留阶段分组母任务列表和子任务表格
   - 作为项目全貌和低频维护入口

4. 阶段门/动态
   - 保留但作为上下文模块，不抢占主区域

### 后台配置中心

- 后台首页文案调整为“配置中心”。
- 保留模板中心、岗位角色、用户管理、功能组件、运行日志。
- 非管理员不应把后台作为主工作路径。

## 7. Data Model

F4 不新增数据表。

复用：

- `User`
- `PositionRole`
- `UserPosition`
- `Project`
- `ProjectMember`
- `ProjectPositionAssignment`
- `ProjectActivityParent`
- `ProjectActivityChild`
- `ActivityAttachment`
- `Notification`
- `StageGateRecord`
- `ActivityEvent`
- `ComponentConfig`

需要通过 seed 补齐固定测试账号和样例项目/任务分布，但不新增 schema。

## 8. Permission Rules

### 一线岗位（PQE/SQE/FAE/RAM/QCM）

可见：
- 自己参与或被任命相关的未完成项目
- 自己负责/被分配的子任务
- 与自己项目相关的项目卡和动态

可做：
- 更新自己的任务状态
- 填写说明
- 上传/查看附件
- 标记阻塞
- 完成任务

### NPQ

可见：
- 自己参与/负责/被任命 NPQ 的项目
- 项目内跨角色待办和异常

可做：
- 一线执行动作
- 退回子任务
- 关闭母任务
- 标记不涉及
- 有限调整任务
- 查看阶段门卡点

### 管理者

可见：
- 业务只读/督办视角的数据
- 项目态势、风险、待处理分布

可做：
- 查看项目、任务、动态
- 不维护任务

### 管理员

可见：
- 后台配置入口
- 工作台可查看

可做：
- 系统配置：模板、岗位、用户、组件、运行日志
- 业务操作不作为主路径，除非已有 admin 权限允许

## 9. API Spec

新增：

`GET /api/npq/workbench`

返回 5 块核心数据：

```ts
type WorkbenchResponse = {
  roleContext: {
    userId: string;
    username: string;
    displayName: string;
    appRole: 'admin' | 'user';
    position?: { id: string; code: string; name: string; roleGroup: string };
    workbenchRole: 'npq' | 'executor' | 'manager' | 'admin';
  };
  actionMetrics: {
    totalTodo: number;
    overdue: number;
    blocked: number;
    missingDeliverable: number;
    pendingParentClose: number;
  };
  projectTodos: Array<{
    projectId: string;
    projectName: string;
    currentStage: string;
    riskFlags: string[];
    todoCount: number;
    todos: WorkbenchTodo[];
  }>;
  projectCards: Array<{
    projectId: string;
    projectName: string;
    currentStage: string;
    progressPercent: number;
    todoCount: number;
    riskFlags: string[];
    updatedAt: string;
  }>;
  recentEvents: Array<{
    id: string;
    projectId: string;
    projectName: string;
    actionType: string;
    note?: string | null;
    actorName?: string | null;
    createdAt: string;
  }>;
};
```

`WorkbenchTodo` 至少包含：

```ts
type WorkbenchTodo = {
  id: string;
  type: 'overdue' | 'blocked' | 'returned' | 'missing_deliverable' | 'responsibility' | 'pending_parent_close' | 'stage_gate';
  projectId: string;
  parentId?: string;
  childId?: string;
  stage: string;
  title: string;
  parentTitle?: string;
  ownerRole?: string;
  status: string;
  dueAt?: string | null;
  priorityRank: number;
  allowedActions: string[];
};
```

排序规则：

- 项目分组优先。
- 项目组排序：有我的待办、逾期/阻塞、阶段门卡点、待关闭、最近更新。
- 项目内待办排序：逾期、阻塞、退回、阶段门卡点、今日到期、近 3 天到期、普通进行中。

## 10. Suggested Technical Architecture

- Next.js App Router 页面：`src/app/(dashboard)/workbench/page.tsx`
- 聚合接口：`src/app/api/npq/workbench/route.ts`
- 数据聚合 helper：`src/lib/db/workbench.ts`
- 角色判定 helper 可复用/扩展：`src/lib/db/npq-permissions.ts`
- UI 复用现有 Button/样式，不引入新 UI 框架。
- 不新增表，不新增迁移。
- seed 更新固定测试账号、用户岗位绑定、项目任命和样例任务分布。

## 11. Edge Cases And Risks

- 用户没有岗位绑定：工作台应提示“未绑定岗位”，展示空状态和联系管理员入口。
- 用户没有相关项目：展示空状态，引导 NPQ 创建项目或联系管理员任命。
- 项目有活动但没有待办：项目卡仍展示，任务流为空。
- 管理者视角不应出现可维护按钮。
- 管理员后台入口应明显，但工作台不应变成后台菜单页。
- 旧页面保留，但主导航应弱化旧业务入口，避免用户继续从分散入口开始。
- 手机端只保证可查看和简单处理，F4 不追求完整移动工作台体验。

## 12. Acceptance Criteria

F4 采用 **角色优先** 验收。

必须满足：

- 使用 `npq` 登录后，工作台展示 NPQ 相关项目、跨角色待办、待关闭母任务和 NPQ 管理动作。
- 使用 `pqe/sqe/fae/ram/qcm` 登录后，工作台展示对应岗位/项目任命下的执行任务，只暴露执行动作。
- 使用 `manager` 登录后，工作台展示业务只读/督办视角，不出现任务维护按钮。
- 使用 `admin` 登录后，后台配置入口清晰；工作台可访问但不是唯一入口。
- 首页默认展示相关未完成项目，而不是全部项目。
- 待办按项目分组，项目内高风险/临期任务靠前。
- 项目卡轻量且按关注程度排序。
- 点击行动指标可以过滤任务流。
- 点击待办可以打开右侧处理抽屉，并按角色显示动作。
- 进入项目详情后，先看到该项目待办，再看到活动结构。
- 旧业务页面仍可访问，但主导航聚焦“工作台 + 后台配置”。

## 13. Implementation Backlog

- [ ] F4.S1 设计并实现 workbench 聚合 helper 与 `/api/npq/workbench`，返回角色上下文、行动指标、项目分组待办、项目卡、最近动态。
- [ ] F4.S2 新建 `/workbench` 单页工作台：行动指标、项目分组任务流、轻量项目卡、最近动态。
- [ ] F4.S3 实现右侧处理抽屉，并按一线/NPQ/管理者/管理员显示不同动作集。
- [ ] F4.S4 调整项目详情页：顶部概览、项目待办优先、下方活动结构，复用同一处理抽屉。
- [ ] F4.S5 收敛导航为“工作台 + 后台配置”，弱化旧项目/活动/待办/看板入口但保留可访问。
- [ ] F4.S6 轻量整理后台首页为配置中心，保持现有后台功能。
- [ ] F4.S7 更新 seed：创建 `npq/pqe/sqe/fae/ram/qcm/manager/admin` 8 个固定测试账号，绑定岗位/角色，并准备可验证的项目任命与任务分布。
- [ ] F4.S8 补充测试与 fulltest：8 角色登录冒烟、workbench 聚合数据、角色化动作、导航收敛、项目详情主流程、构建和运行时冒烟。

## 14. Ready-to-use Build Prompt

执行 F4：在不新增数据表、不实现 F5 能力的前提下，把现有 F3 系统重构为 `/workbench` 行动优先质量项目工作台。新增 `/api/npq/workbench` 聚合接口，返回角色上下文、行动指标、按项目分组待办、轻量项目卡、最近动态。新增单页工作台 UI，默认展示当前用户参与/任命相关的未完成项目；待办按项目分组并在项目内按风险/时间排序；项目卡轻量展示并按关注程度排序；行动指标可过滤任务流。实现右侧处理抽屉，并按角色显示动作：一线执行、NPQ 管理、管理者只读、管理员配置导向。项目详情页调整为项目待办优先，下方保留活动结构。导航收敛为工作台 + 后台配置，旧业务页面保留但弱化。seed 创建 npq/pqe/sqe/fae/ram/qcm/manager/admin 8 个固定测试账号和可验证项目数据。最后更新 plan/state，运行 tsc、lint、seed、vitest、build 和 8 角色 HTTP 冒烟。
