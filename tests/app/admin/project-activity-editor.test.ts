import { describe, expect, it } from 'vitest';
import { toStructure } from '@/app/(dashboard)/admin/projects/project-activity-editor';
import { normalizeActivityStructure } from '@/app/(dashboard)/admin/templates/activity-structure-editor';

describe('project activity editor structure conversion', () => {
  it('deduplicates stages that are returned by both stage records and parent activities', () => {
    const stages = toStructure(
      [
        {
          id: 'parent-1',
          stage: 'TR1',
          projectTaskName: 'TR1 Activity',
          sortOrder: 1,
          children: [],
        },
      ],
      [
        { id: 'gate-1', stage: 'TR1' },
        { id: 'gate-duplicate', stage: 'TR1' },
        { id: 'gate-2', stage: 'TR2' },
      ],
    );

    expect(stages.map((stage) => stage.id)).toEqual(['stage:TR1', 'stage:TR2']);
    expect(stages[0]?.parents).toHaveLength(1);
  });

  it('normalizes duplicated stage ids before rendering or saving editor state', () => {
    const stages = normalizeActivityStructure([
      {
        id: 'stage:TR1',
        name: 'TR1',
        sortOrder: 1,
        parents: [
          {
            id: 'parent-1',
            name: 'Activity 1',
            description: null,
            closureStandard: null,
            plannedOffsetDays: null,
            sortOrder: 1,
            children: [],
          },
        ],
      },
      {
        id: 'stage:TR1',
        name: 'TR1',
        sortOrder: 2,
        parents: [
          {
            id: 'parent-2',
            name: 'Activity 2',
            description: null,
            closureStandard: null,
            plannedOffsetDays: null,
            sortOrder: 1,
            children: [],
          },
        ],
      },
    ]);

    expect(stages).toHaveLength(1);
    expect(stages[0]?.id).toBe('stage:TR1');
    expect(stages[0]?.parents.map((parent) => parent.id)).toEqual(['parent-1', 'parent-2']);
  });
});
