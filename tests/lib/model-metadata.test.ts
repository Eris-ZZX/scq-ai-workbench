import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '@/db/schema';
import { modelMetadata } from '@/db/model-metadata.generated';

describe('database model metadata', () => {
  it('maps every compatibility field to its physical Drizzle column', () => {
    for (const [modelName, metadata] of Object.entries(modelMetadata)) {
      const table = (schema as Record<string, unknown>)[modelName];
      expect(table, `${modelName} table export`).toBeDefined();

      const columns = getTableColumns(table as Parameters<typeof getTableColumns>[0]);
      for (const [fieldName, field] of Object.entries(metadata.fields)) {
        expect(columns[fieldName]?.name, `${modelName}.${fieldName}`).toBe(field.column);
      }
    }
  });

  it('preserves create-time defaults required by existing business writes', () => {
    const expectedDefaults = [
      ['StageTemplate', 'isDefault', false],
      ['ActivityTemplateChild', 'requiresDeliverable', false],
      ['ActivityTemplateChild', 'requiresAttachment', false],
      ['ActivityTemplateChild', 'requiresNote', false],
      ['ActivityTemplate', 'requiresDeliverable', false],
      ['ProjectActivityParent', 'hasBlocked', false],
      ['ProjectActivityParent', 'hasOverdue', false],
      ['ProjectActivityChild', 'requiresDeliverable', false],
      ['ProjectActivityChild', 'requiresAttachment', false],
      ['ProjectActivityChild', 'requiresNote', false],
      ['ProjectActivityChild', 'isBlocked', false],
      ['ProjectActivityChild', 'isNotApplicable', false],
      ['ProjectActivityChild', 'isManuallyAdded', false],
      ['AiResource', 'tags', ''],
      ['AiResource', 'visibleDeptIds', ''],
      ['AiResource', 'visibleUserIds', ''],
      ['AiResourceReviewRequest', 'changedFields', ''],
      ['AiResourceUpdateLog', 'changedFields', ''],
    ] as const;

    for (const [modelName, fieldName, expected] of expectedDefaults) {
      const table = (schema as Record<string, unknown>)[modelName];
      const columns = getTableColumns(table as Parameters<typeof getTableColumns>[0]);
      expect(columns[fieldName]?.default, `${modelName}.${fieldName}`).toBe(expected);
    }
  });
});
