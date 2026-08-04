import { ZodError } from 'zod';

const fieldLabels: Record<string, string> = {
  name: '资源名称',
  type: '资源类型',
  summary: '面向用户/使用说明',
  tags: '适用小组',
  ownerId: '负责人',
  ownerName: '负责人',
  resourceUrl: '存储路径/链接',
  content: '实现方法简述',
  updateSummary: '修改原因',
  reviewerId: '审批人',
  reason: '驳回原因',
  resource: '资源信息',
  confirmationName: '确认名称',
  attachments: '附件',
};

export function formatZodError(error: ZodError) {
  const issues = error.issues.map((issue) => {
    const key = issue.path[issue.path.length - 1]?.toString() ?? '';
    const label = fieldLabels[key] ?? fieldLabels[issue.path[0]?.toString() ?? ''] ?? '字段';

    if (issue.code === 'too_small') {
      if (issue.origin === 'string') return `${label}至少需要 ${issue.minimum} 个字符。`;
      if (issue.origin === 'array') return `${label}至少需要选择 ${issue.minimum} 项。`;
    }

    if (issue.code === 'too_big') {
      if (issue.origin === 'string') return `${label}不能超过 ${issue.maximum} 个字符。`;
      if (issue.origin === 'array') return `${label}不能超过 ${issue.maximum} 项。`;
    }

    if (issue.code === 'invalid_type') {
      return `${label}格式不正确。`;
    }

    if (issue.code === 'invalid_value') {
      return `${label}选项无效。`;
    }

    return `${label}填写不正确。`;
  });

  return Array.from(new Set(issues)).join(' ');
}

export function getErrorMessage(payload: unknown, fallback = '操作失败。') {
  if (!payload || typeof payload !== 'object') return fallback;
  const error = (payload as { error?: unknown }).error;
  return typeof error === 'string' && error.trim() ? error : fallback;
}
