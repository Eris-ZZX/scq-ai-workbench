import type {
  AiResourceType,
  AiReviewStatus,
  AiReviewType,
  AiVisibilityScope,
} from './constants';

export const resourceTypeLabel: Record<AiResourceType, string> = {
  APP: '应用',
  AGENT: 'Agent',
  SKILL: 'Skill',
  MCP: 'MCP',
  WEB_PAGE: 'HTML 网页',
  CASE: '案例',
  PROMPT: 'Prompt',
  STANDARD_DOC: '规范文档',
  WORKFLOW: '工作流',
  OTHER: '其他',
};

export const visibilityLabel: Record<AiVisibilityScope, string> = {
  ALL: '全员可见',
  DEPARTMENTS: '指定部门',
  MEMBERS: '指定成员',
};

export const reviewTypeLabel: Record<AiReviewType, string> = {
  CREATE: '新建',
  UPDATE: '修改',
};

export const reviewStatusLabel: Record<AiReviewStatus, string> = {
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已驳回',
};

export const resourceFieldLabel: Record<string, string> = {
  name: '名称',
  type: '类型',
  summary: '使用说明',
  tags: '适用小组',
  ownerName: '负责人',
  visibilityScope: '可见范围',
  visibleDeptIds: '可见部门',
  visibleUserIds: '可见成员',
  status: '状态',
  resourceUrl: '存储路径/链接',
  content: '实现方法',
  attachments: '附件',
  extension: '扩展字段',
  extractedText: '提取文本',
};
