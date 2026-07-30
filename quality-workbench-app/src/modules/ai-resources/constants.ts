export const AI_RESOURCE_TYPES = [
  'APP',
  'AGENT',
  'SKILL',
  'MCP',
  'WEB_PAGE',
  'CASE',
  'PROMPT',
  'STANDARD_DOC',
  'WORKFLOW',
  'OTHER',
] as const;
export type AiResourceType = (typeof AI_RESOURCE_TYPES)[number];

export const AI_RESOURCE_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type AiResourceStatus = (typeof AI_RESOURCE_STATUSES)[number];

export const AI_VISIBILITY_SCOPES = ['ALL', 'DEPARTMENTS', 'MEMBERS'] as const;
export type AiVisibilityScope = (typeof AI_VISIBILITY_SCOPES)[number];

export const AI_REVIEW_TYPES = ['CREATE', 'UPDATE', 'ARCHIVE'] as const;
export type AiReviewType = (typeof AI_REVIEW_TYPES)[number];

export const AI_REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'DISCARDED'] as const;
export type AiReviewStatus = (typeof AI_REVIEW_STATUSES)[number];

export const AI_UPDATE_LOG_ACTIONS = ['CREATE', 'UPDATE', 'ARCHIVE', 'RESTORE'] as const;
export type AiUpdateLogAction = (typeof AI_UPDATE_LOG_ACTIONS)[number];

export const AI_UPDATE_LOG_RESULTS = ['PENDING', 'APPROVED', 'REJECTED', 'DONE'] as const;
export type AiUpdateLogResult = (typeof AI_UPDATE_LOG_RESULTS)[number];

export function isAiResourceType(value: string): value is AiResourceType {
  return (AI_RESOURCE_TYPES as readonly string[]).includes(value);
}

export function isAiResourceStatus(value: string): value is AiResourceStatus {
  return (AI_RESOURCE_STATUSES as readonly string[]).includes(value);
}

export function isAiReviewStatus(value: string): value is AiReviewStatus {
  return (AI_REVIEW_STATUSES as readonly string[]).includes(value);
}

/** AI 资源附件：单文件上限与单资源最多附件数（托管 HTML 仍单独 1 个）。 */
export const AI_UPLOAD_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const AI_UPLOAD_MAX_FILE_SIZE_LABEL = '100MB';
export const AI_UPLOAD_MAX_ATTACHMENTS = 3;
export const AI_HOSTED_HTML_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const AI_HOSTED_HTML_MAX_FILE_SIZE_LABEL = '5MB';
/** 实现方法简述 / 面向用户说明最大字符数；不做最小字符限制。 */
export const AI_CONTENT_MAX_LENGTH = 3000;
export const AI_SUMMARY_MAX_LENGTH = 3000;
