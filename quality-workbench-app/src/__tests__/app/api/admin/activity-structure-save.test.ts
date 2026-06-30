import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('@/platform/auth/auth.config', () => ({
  getSession: mockGetSession,
}));

import { PATCH as patchTemplates, POST as postTemplates } from '@/app/api/admin/templates/route';
import {
  GET as getProjectActivities,
  PUT as putProjectActivities,
} from '@/app/api/admin/projects/[id]/activities/route';

const testRunId = `activity-structure-${Date.now()}`;
const adminUserId = `${testRunId}-admin`;
const projectId = `${testRunId}-project`;
const existingParentId = `${testRunId}-parent`;
const existingChildId = `${testRunId}-child`;
let templateSetId = '';
let templateVersionId = '';

function jsonRequest(url: string, method: 'PATCH' | 'POST' | 'PUT', body: unknown) {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('admin activity structure save regressions', () => {
  beforeAll(async () => {
    mockGetSession.mockResolvedValue({
      sub: adminUserId,
      username: 'activity-structure-admin',
      role: 'admin',
    });

    await prisma.user.create({
      data: {
        id: adminUserId,
        username: `${testRunId}-admin`,
        passwordHash: 'test-only',
        role: 'admin',
        status: 'active',
      },
    });

    const createTemplateResponse = await postTemplates(jsonRequest('http://localhost/api/admin/templates', 'POST', {
      action: 'createTemplate',
      name: `${testRunId}-template`,
      description: 'Regression template fixture',
    }));
    expect(createTemplateResponse.status).toBe(201);
    const createdTemplate = await createTemplateResponse.json() as { id: string; latestPublishedVersionId: string };
    templateSetId = createdTemplate.id;
    templateVersionId = createdTemplate.latestPublishedVersionId;

    await prisma.project.create({
      data: {
        id: projectId,
        name: 'Regression Project',
        status: 'active',
        currentStage: 'TR1',
        stageGateRecords: {
          create: {
            stage: 'TR1',
          },
        },
      },
    });

    await prisma.projectActivityParent.create({
      data: {
        id: existingParentId,
        projectId,
        stage: 'TR1',
        projectTaskName: 'Existing Project Activity',
        status: 'in_progress',
        sortOrder: 1,
        children: {
          create: {
            id: existingChildId,
            projectId,
            thirdLevelPlan: 'Existing Child Task',
            ownerRole: 'NPQ',
            roleGroup: 'NPQ',
            status: 'in_progress',
            sortOrder: 1,
          },
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.activityTemplateSet.deleteMany({ where: { id: templateSetId } });
    await prisma.user.deleteMany({ where: { id: adminUserId } });
    await prisma.$disconnect();
  });

  it('template center saves edited activity structure as a new published version', async () => {
    const response = await patchTemplates(jsonRequest('http://localhost/api/admin/templates', 'PATCH', {
      action: 'saveTemplateEdit',
      templateSetId,
      baseVersionId: templateVersionId,
      name: 'Regression Template Edited',
      description: 'Save edit regression',
      isActive: true,
      changeNotes: 'Add stage and activity',
      stages: [
        {
          name: 'TR1',
          plannedStartOffsetDays: null,
          plannedDueOffsetDays: null,
          parents: [
            {
              name: 'Edited Project Activity',
              description: null,
              closureStandard: null,
              plannedStartOffsetDays: null,
              plannedOffsetDays: null,
              children: [
                {
                  title: 'Edited Child Task',
                  ownerRoleName: 'NPQ',
                  roleGroup: 'NPQ',
                  deliverableName: null,
                  requiresDeliverable: false,
                  isRequired: true,
                },
              ],
            },
          ],
        },
        {
          name: 'TRX',
          plannedStartOffsetDays: null,
          plannedDueOffsetDays: null,
          parents: [
            {
              name: 'Added Project Activity',
              description: null,
              closureStandard: null,
              plannedStartOffsetDays: null,
              plannedOffsetDays: null,
              children: [
                {
                  title: 'Added Child Task',
                  ownerRoleName: 'SQE-SMT',
                  roleGroup: 'SQE',
                  deliverableName: 'Test Report',
                  requiresDeliverable: true,
                  isRequired: true,
                },
              ],
            },
          ],
        },
      ],
    }));
    expect(response.status).toBe(200);
    const saved = await response.json() as { id: string };

    const set = await prisma.activityTemplateSet.findUniqueOrThrow({
      where: { id: templateSetId },
      select: { name: true, latestPublishedVersionId: true },
    });
    expect(set.name).toBe('Regression Template Edited');
    expect(set.latestPublishedVersionId).toBe(saved.id);

    const stages = await prisma.activityTemplateStage.findMany({
      where: { versionId: saved.id },
      include: { parents: { include: { children: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    expect(stages.map((stage) => stage.name)).toEqual(['TR1', 'TRX']);
    expect(stages[1]?.parents[0]?.name).toBe('Added Project Activity');
    expect(stages[1]?.parents[0]?.children[0]).toMatchObject({
      title: 'Added Child Task',
      ownerRoleName: 'SQE-SMT',
      roleGroup: 'SQE',
      deliverableName: 'Test Report',
      requiresDeliverable: true,
    });
  });

  it('project management preserves an added empty stage after saving activity structure', async () => {
    const response = await putProjectActivities(
      jsonRequest(`http://localhost/api/admin/projects/${projectId}/activities`, 'PUT', {
        stages: [
          { stage: 'TR1', sortOrder: 1 },
          { stage: 'TRX Empty Stage', sortOrder: 2 },
        ],
        parents: [
          {
            id: existingParentId,
            stage: 'TR1',
            projectTaskName: 'Existing Project Activity Edited',
            sortOrder: 1,
            children: [
              {
                id: existingChildId,
                thirdLevelPlan: 'Existing Child Task Edited',
                ownerRole: 'NPQ',
                roleGroup: 'NPQ',
                requiresDeliverable: false,
                deliverableName: null,
                sortOrder: 1,
              },
            ],
          },
        ],
        changeNote: 'Save empty stage regression',
      }),
      routeParams(projectId),
    );
    expect(response.status).toBe(200);
    const saved = await response.json() as { stages: Array<{ stage: string }>; parents: Array<{ projectTaskName: string }> };
    expect(saved.stages.map((stage) => stage.stage)).toContain('TRX Empty Stage');
    expect(saved.parents[0]?.projectTaskName).toBe('Existing Project Activity Edited');

    const gate = await prisma.stageGateRecord.findUnique({
      where: { projectId_stage: { projectId, stage: 'TRX Empty Stage' } },
      select: { stage: true },
    });
    expect(gate).toEqual({ stage: 'TRX Empty Stage' });

    const getResponse = await getProjectActivities(
      new Request(`http://localhost/api/admin/projects/${projectId}/activities`),
      routeParams(projectId),
    );
    expect(getResponse.status).toBe(200);
    const reloaded = await getResponse.json() as { stages: Array<{ stage: string }>; parents: Array<{ projectTaskName: string; children: Array<{ thirdLevelPlan: string }> }> };
    expect(reloaded.stages.map((stage) => stage.stage)).toContain('TRX Empty Stage');
    expect(reloaded.parents[0]).toMatchObject({
      projectTaskName: 'Existing Project Activity Edited',
      children: [{ thirdLevelPlan: 'Existing Child Task Edited' }],
    });
  });
});
