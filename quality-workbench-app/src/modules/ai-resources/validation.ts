import { z } from 'zod';
import {
  AI_RESOURCE_STATUSES,
  AI_RESOURCE_TYPES,
  AI_VISIBILITY_SCOPES,
} from './constants';

export const resourcePayloadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(AI_RESOURCE_TYPES),
  summary: z.string().trim().max(500),
  tags: z.array(z.string().trim().min(1).max(30)).default([]),
  ownerName: z.string().trim().min(1).max(60),
  visibilityScope: z.enum(AI_VISIBILITY_SCOPES).default('ALL'),
  visibleDeptIds: z.array(z.string().trim().min(1)).default([]),
  visibleUserIds: z.array(z.string().trim().min(1)).default([]),
  status: z.enum(AI_RESOURCE_STATUSES).default('PUBLISHED'),
  resourceUrl: z.string().trim().max(3000).optional().nullable(),
  content: z.string().trim(),
  attachments: z.unknown().optional().nullable(),
  extension: z.unknown().optional().nullable(),
  extractedText: z.string().optional().nullable(),
});

export const reviewSubmissionSchema = z.object({
  updateSummary: z.string().trim().min(4).max(500),
  resource: resourcePayloadSchema,
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(2).max(500),
});

export const archiveResourceSchema = z.object({
  confirmationName: z.string().trim().min(1),
});

export const membershipRoleSchema = z.object({
  userId: z.string().trim().min(1),
  role: z.enum(['user', 'reviewer', 'admin']),
});

export const maintenanceModeSchema = z.object({
  enabled: z.boolean(),
});
