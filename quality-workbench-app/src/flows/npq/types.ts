// NPQ 业务流 — 类型定义 (F3/F4)

/** 项目状态 */
export type ProjectStatus = 'active' | 'completed' | 'paused';

/** 项目内成员角色 */
export type ProjectMemberRole = 'owner' | 'member' | 'observer';

/** 阶段状态 */
export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

/** 任务状态 */
export type TaskStatus = 'todo' | 'in_progress' | 'done';

/** 任务优先级 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/** 新产品导入项目活动状态 */
export type ActivityParentStatus = 'not_started' | 'in_progress' | 'pending_npq_close' | 'closed';

/** 新产品导入活动子任务状态 */
export type ActivityChildStatus = 'not_started' | 'in_progress' | 'returned' | 'completed';

/** 用户账号状态 */
export type UserStatus = 'active' | 'disabled';

/** 组件中间件策略 */
export type ComponentPolicy = 'whitelist' | 'blacklist';

export type ActivityTemplateVersionStatus = 'draft' | 'published' | 'retired';

export type PositionRoleCode = 'NPQ' | 'PQE' | 'SQE' | 'FAE' | 'RAM' | 'QCM' | 'MANAGER';

export type StageGateStatus = 'pending' | 'passed' | 'conditional_release';

export type NotificationStatus = 'unread' | 'read';
