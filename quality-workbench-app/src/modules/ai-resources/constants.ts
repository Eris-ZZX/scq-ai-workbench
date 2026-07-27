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

export const AI_REVIEW_TYPES = ['CREATE', 'UPDATE'] as const;
export type AiReviewType = (typeof AI_REVIEW_TYPES)[number];

export const AI_REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
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
