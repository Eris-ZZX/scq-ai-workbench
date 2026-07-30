import { z } from 'zod';
import {
  AI_CONTENT_MAX_LENGTH,
  AI_RESOURCE_STATUSES,
  AI_RESOURCE_TYPES,
  AI_SUMMARY_MAX_LENGTH,
  AI_UPLOAD_MAX_ATTACHMENTS,
  AI_UPLOAD_MAX_FILE_SIZE_BYTES,
  AI_VISIBILITY_SCOPES,
} from './constants';

const attachmentItemSchema = z.object({
  name: z.string().trim().min(1).max(260),
  url: z.string().trim().min(1).max(1000),
  size: z.number().int().nonnegative().max(AI_UPLOAD_MAX_FILE_SIZE_BYTES).optional().default(0),
  type: z.string().trim().max(200).optional().default('application/octet-stream'),
  storedName: z.string().trim().max(260).optional(),
});

function normalizeAttachments(value: unknown) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }
  return value;
}

export const resourcePayloadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(AI_RESOURCE_TYPES),
  summary: z.string().trim().max(AI_SUMMARY_MAX_LENGTH),
  tags: z.array(z.string().trim().min(1).max(30)).default([]),
  ownerName: z.string().trim().min(1).max(60),
  visibilityScope: z.enum(AI_VISIBILITY_SCOPES).default('ALL'),
  visibleDeptIds: z.array(z.string().trim().min(1)).default([]),
  visibleUserIds: z.array(z.string().trim().min(1)).default([]),
  status: z.enum(AI_RESOURCE_STATUSES).default('PUBLISHED'),
  resourceUrl: z.string().trim().max(3000).optional().nullable(),
  content: z.string().trim().max(AI_CONTENT_MAX_LENGTH),
  attachments: z
    .unknown()
    .optional()
    .nullable()
    .transform(normalizeAttachments)
    .superRefine((value, ctx) => {
      if (value == null) return;
      const parsed = z.array(attachmentItemSchema).safeParse(value);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '附件格式无效。',
        });
        return;
      }
      if (parsed.data.length > AI_UPLOAD_MAX_ATTACHMENTS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `每个资源最多 ${AI_UPLOAD_MAX_ATTACHMENTS} 个附件。`,
        });
      }
    }),
  extension: z.unknown().optional().nullable(),
  extractedText: z.string().optional().nullable(),
});

export const reviewSubmissionSchema = z.object({
  updateSummary: z.string().trim().min(4).max(500),
  reviewerId: z.string().trim().min(1, '请选择审批人'),
  resource: resourcePayloadSchema,
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(2).max(500),
});

export const archiveResourceSchema = z.object({
  confirmationName: z.string().trim().min(1),
});

export const archiveRequestSchema = z.object({
  reviewerId: z.string().trim().min(1, '请选择审批人'),
  updateSummary: z.string().trim().min(4).max(500),
  confirmationName: z.string().trim().min(1),
});

export const membershipRoleSchema = z.object({
  userId: z.string().trim().min(1),
  role: z.enum(['user', 'reviewer', 'admin']),
});
