import { describe, it, expect } from 'vitest';
import type {
  ProjectStatus,
  ProjectMemberRole,
  StageStatus,
  TaskStatus,
  TaskPriority,
  ActivityParentStatus,
  ActivityChildStatus,
  ActivityTemplateVersionStatus,
  PositionRoleCode,
  StageGateStatus,
  NotificationStatus,
} from '@/flows/npq/types';

describe('NPQ type aliases — compile-time smoke test', () => {
  it('ProjectStatus accepts only valid union members', () => {
    const values: ProjectStatus[] = ['active', 'completed', 'paused'];
    expect(values).toHaveLength(3);
    // Each literal is assignable to the type
    const a: ProjectStatus = 'active';
    const c: ProjectStatus = 'completed';
    const p: ProjectStatus = 'paused';
    expect([a, c, p]).toEqual(['active', 'completed', 'paused']);
  });

  it('ProjectMemberRole accepts only valid union members', () => {
    const values: ProjectMemberRole[] = ['owner', 'member', 'observer'];
    expect(values).toHaveLength(3);
    const o: ProjectMemberRole = 'owner';
    const m: ProjectMemberRole = 'member';
    const ob: ProjectMemberRole = 'observer';
    expect([o, m, ob]).toEqual(['owner', 'member', 'observer']);
  });

  it('StageStatus accepts only valid union members', () => {
    const values: StageStatus[] = ['pending', 'in_progress', 'completed', 'blocked'];
    expect(values).toHaveLength(4);
    const p: StageStatus = 'pending';
    const ip: StageStatus = 'in_progress';
    const c: StageStatus = 'completed';
    const b: StageStatus = 'blocked';
    expect([p, ip, c, b]).toEqual(['pending', 'in_progress', 'completed', 'blocked']);
  });

  it('TaskStatus accepts only valid union members', () => {
    const values: TaskStatus[] = ['todo', 'in_progress', 'done'];
    expect(values).toHaveLength(3);
    const t: TaskStatus = 'todo';
    const ip: TaskStatus = 'in_progress';
    const d: TaskStatus = 'done';
    expect([t, ip, d]).toEqual(['todo', 'in_progress', 'done']);
  });

  it('TaskPriority accepts only valid union members', () => {
    const values: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
    expect(values).toHaveLength(4);
    const l: TaskPriority = 'low';
    const m: TaskPriority = 'medium';
    const h: TaskPriority = 'high';
    const u: TaskPriority = 'urgent';
    expect([l, m, h, u]).toEqual(['low', 'medium', 'high', 'urgent']);
  });

  it('ActivityParentStatus accepts only valid union members', () => {
    const values: ActivityParentStatus[] = ['not_started', 'in_progress', 'pending_npq_close', 'closed'];
    expect(values).toHaveLength(4);
    const ns: ActivityParentStatus = 'not_started';
    const ip: ActivityParentStatus = 'in_progress';
    const pending: ActivityParentStatus = 'pending_npq_close';
    const closed: ActivityParentStatus = 'closed';
    expect([ns, ip, pending, closed]).toEqual(['not_started', 'in_progress', 'pending_npq_close', 'closed']);
  });

  it('ActivityChildStatus accepts only valid union members', () => {
    const values: ActivityChildStatus[] = ['not_started', 'in_progress', 'returned', 'completed'];
    expect(values).toHaveLength(4);
    const ns: ActivityChildStatus = 'not_started';
    const ip: ActivityChildStatus = 'in_progress';
    const returned: ActivityChildStatus = 'returned';
    const completed: ActivityChildStatus = 'completed';
    expect([ns, ip, returned, completed]).toEqual(['not_started', 'in_progress', 'returned', 'completed']);
  });

  it('F3 template, role, gate, and notification status types accept valid union members', () => {
    const templateStatuses: ActivityTemplateVersionStatus[] = ['draft', 'published', 'retired'];
    const roleCodes: PositionRoleCode[] = ['NPQ', 'PQE', 'SQE', 'FAE', 'RAM', 'QCM'];
    const gateStatuses: StageGateStatus[] = ['pending', 'passed', 'conditional_release'];
    const notificationStatuses: NotificationStatus[] = ['unread', 'read'];

    expect(templateStatuses).toHaveLength(3);
    expect(roleCodes).toHaveLength(6);
    expect(gateStatuses).toHaveLength(3);
    expect(notificationStatuses).toHaveLength(2);
  });
});
