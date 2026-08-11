export const FEEDBACK_MAX_CONTENT_LENGTH = 3000;
export const FEEDBACK_MAX_ATTACHMENTS = 3;
export const FEEDBACK_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const FEEDBACK_MAX_FILE_SIZE_LABEL = '5MB';

export const FEEDBACK_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export type FeedbackCategory = 'feature' | 'problem' | 'suggestion';

export const FEEDBACK_CATEGORIES: Array<{ value: FeedbackCategory; label: string }> = [
  { value: 'feature', label: '需求' },
  { value: 'problem', label: '问题' },
  { value: 'suggestion', label: '建议' },
];

export type FeedbackApplication =
  | 'ai-resources'
  | 'npq'
  | 'pqm'
  | 'sqm'
  | 'qcm'
  | 'lab'
  | 'ems'
  | 'management'
  | 'platform-admin';

export const FEEDBACK_APPLICATIONS: Array<{ value: FeedbackApplication; label: string }> = [
  { value: 'ai-resources', label: 'AI 资源库' },
  { value: 'npq', label: 'NPQ工作台' },
  { value: 'pqm', label: 'PQM' },
  { value: 'sqm', label: 'SQM' },
  { value: 'qcm', label: 'QCM' },
  { value: 'lab', label: '实验室' },
  { value: 'ems', label: 'EMS' },
  { value: 'management', label: '管理工作台' },
  { value: 'platform-admin', label: '平台后台管理' },
];

export function isFeedbackApplication(value: string): value is FeedbackApplication {
  return FEEDBACK_APPLICATIONS.some((application) => application.value === value);
}

export function isFeedbackCategory(value: string): value is FeedbackCategory {
  return FEEDBACK_CATEGORIES.some((category) => category.value === value);
}

export function isFeedbackImageType(value: string): value is (typeof FEEDBACK_IMAGE_TYPES)[number] {
  return (FEEDBACK_IMAGE_TYPES as readonly string[]).includes(value);
}
