import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@libsql/client';
import path from 'node:path';

const dbPath = path.resolve(process.cwd(), 'dev.db');
const db = createClient({ url: `file:${dbPath}` });

describe('Database — integration (libsql direct)', () => {
  afterAll(() => db.close());

  // ── Connection ──
  it('connects to SQLite successfully', async () => {
    const rs = await db.execute('SELECT 1 AS connected');
    const row = rs.rows[0] as unknown as { connected: number };
    expect(row.connected).toBe(1);
  });

  // ── Seed data (🔧 H9: ON CONFLICT preserves createdAt on re-run) ──
  it('has 6 default stage templates (TR1→TR6) seeded', async () => {
    const rs = await db.execute(
      'SELECT name, "order" FROM StageTemplate WHERE isDefault = 1 ORDER BY "order" ASC'
    );
    expect(rs.rows).toHaveLength(6);
    const names = rs.rows.map((r) => (r as unknown as { name: string }).name);
    expect(names).toEqual([
      'TR1 概念评审', 'TR2 方案评审', 'TR3 样机评审',
      'TR4 试产评审', 'TR5 量产准入', 'TR6 项目结项',
    ]);
  });

  it('has 9 component configs with unified personal project workbench and F4 entries', async () => {
    const rs = await db.execute(
      'SELECT name, path, enabled, "order" FROM ComponentConfig ORDER BY "order" ASC'
    );
    expect(rs.rows).toHaveLength(9);
    const rows = rs.rows as unknown as { name: string; path: string; enabled: number; order: number }[];
    rows.forEach((r, i) => {
      expect(r.enabled).toBe(1);
      expect(r.order).toBe(i + 1); // 🔧 order 字段验证
    });
    expect(rows.map((row) => row.path)).toContain('/workbench');
    expect(rows.map((row) => row.path)).not.toContain('/project-workbench');
    expect(rows.map((row) => row.path)).not.toContain('/flows/npq/projects');
    expect(rows.map((row) => row.path)).not.toContain('/flows/npq/todos');
    expect(rows.map((row) => row.path)).not.toContain('/flows/npq/tasks');
    expect(rows.map((row) => row.path)).toContain('/flows/npq/activities');
    expect(rows.map((row) => row.path)).toContain('/flows/npq/activity-dashboard');
    expect(rows.map((row) => row.path)).toContain('/admin/positions');
  });

  // ── Schema: all tables exist ──
  const tables = [
    'User', 'Project', 'ProjectMember', 'StageTemplate',
    'ProjectStage', 'Task', 'ComponentConfig', 'ObservabilityEvent',
    'TaskStatusChange', 'ActivityTemplate', 'ProjectActivityParent',
    'ProjectActivityChild', 'ActivityEvent', // 🔧 H7/F2: 新增审计表和活动表
    'PositionRole', 'UserPosition', 'ProjectPositionAssignment',
    'ActivityTemplateSet', 'ActivityTemplateVersion', 'ActivityTemplateStage',
    'ActivityTemplateParent', 'ActivityTemplateChild',
    'ProjectActivitySnapshotMeta', 'ActivityAttachment', 'Notification',
    'NpqActionPermission', 'StageGateRecord',
  ] as const;

  for (const table of tables) {
    it(`table "${table}" exists`, async () => {
      const rs = await db.execute({
        sql: 'SELECT name FROM sqlite_master WHERE type=? AND name=?',
        args: ['table', table],
      });
      expect(rs.rows).toHaveLength(1);
    });
  }

  it('has F2 quality activity templates and sample project activities seeded', async () => {
    const templateCount = await db.execute('SELECT COUNT(*) AS count FROM ActivityTemplate');
    const parentCount = await db.execute("SELECT COUNT(*) AS count FROM ProjectActivityParent WHERE projectId = 'seed-f2-project'");
    const childCount = await db.execute("SELECT COUNT(*) AS count FROM ProjectActivityChild WHERE projectId = 'seed-f2-project'");
    expect(Number(templateCount.rows[0]?.count)).toBe(828);
    expect(Number(parentCount.rows[0]?.count)).toBe(340);
    expect(Number(childCount.rows[0]?.count)).toBe(828);
  });

  it('has F3 structured template center seed data', async () => {
    const roleCount = await db.execute('SELECT COUNT(*) AS count FROM PositionRole');
    const setCount = await db.execute("SELECT COUNT(*) AS count FROM ActivityTemplateSet WHERE code = 'npq-quality-activity'");
    const versionCount = await db.execute(`
      SELECT COUNT(*) AS count
      FROM ActivityTemplateVersion v
      JOIN ActivityTemplateSet t ON t.id = v.templateSetId
      WHERE t.code = 'npq-quality-activity' AND v.status = 'published'
    `);
    const stageCount = await db.execute(`
      SELECT COUNT(*) AS count
      FROM ActivityTemplateStage s
      JOIN ActivityTemplateVersion v ON v.id = s.versionId
      JOIN ActivityTemplateSet t ON t.id = v.templateSetId
      WHERE t.code = 'npq-quality-activity' AND v.status = 'published'
    `);
    const parentCount = await db.execute(`
      SELECT COUNT(*) AS count
      FROM ActivityTemplateParent p
      JOIN ActivityTemplateStage s ON s.id = p.stageId
      JOIN ActivityTemplateVersion v ON v.id = s.versionId
      JOIN ActivityTemplateSet t ON t.id = v.templateSetId
      WHERE t.code = 'npq-quality-activity' AND v.status = 'published'
    `);
    const childCount = await db.execute(`
      SELECT COUNT(*) AS count
      FROM ActivityTemplateChild c
      JOIN ActivityTemplateParent p ON p.id = c.parentId
      JOIN ActivityTemplateStage s ON s.id = p.stageId
      JOIN ActivityTemplateVersion v ON v.id = s.versionId
      JOIN ActivityTemplateSet t ON t.id = v.templateSetId
      WHERE t.code = 'npq-quality-activity' AND v.status = 'published'
    `);

    expect(Number(roleCount.rows[0]?.count)).toBe(7);
    expect(Number(setCount.rows[0]?.count)).toBe(1);
    expect(Number(versionCount.rows[0]?.count)).toBe(1);
    expect(Number(stageCount.rows[0]?.count)).toBe(6);
    expect(Number(parentCount.rows[0]?.count)).toBe(340);
    expect(Number(childCount.rows[0]?.count)).toBe(828);
  });

  it('has F4 fixed role test accounts and position bindings', async () => {
    const users = await db.execute(
      "SELECT username, role, status FROM User WHERE username IN ('npq','pqe','sqe','fae','ram','qcm','manager','admin') ORDER BY username ASC"
    );
    const bindings = await db.execute(
      `SELECT u.username, pr.code
       FROM User u
       JOIN UserPosition up ON up.userId = u.id
       JOIN PositionRole pr ON pr.id = up.positionRoleId
       WHERE u.username IN ('npq','pqe','sqe','fae','ram','qcm','manager','admin')
       ORDER BY u.username ASC`
    );

    expect(users.rows).toHaveLength(8);
    expect(users.rows.every((row) => (row as unknown as { status: string }).status === 'active')).toBe(true);
    expect(bindings.rows.map((row) => row as unknown as { username: string; code: string })).toEqual([
      { username: 'admin', code: 'NPQ' },
      { username: 'fae', code: 'FAE' },
      { username: 'manager', code: 'MANAGER' },
      { username: 'npq', code: 'NPQ' },
      { username: 'pqe', code: 'PQE' },
      { username: 'qcm', code: 'QCM' },
      { username: 'ram', code: 'RAM' },
      { username: 'sqe', code: 'SQE' },
    ]);
  });

  it('binds the sample project to a template version and NPQ position assignment', async () => {
    const snapshot = await db.execute(
      "SELECT templateSetId, templateVersionId FROM ProjectActivitySnapshotMeta WHERE projectId = 'seed-f2-project'"
    );
    const assignments = await db.execute(
      "SELECT positionRoleId FROM ProjectPositionAssignment WHERE projectId = 'seed-f2-project' ORDER BY positionRoleId ASC"
    );
    const gates = await db.execute(
      "SELECT COUNT(*) AS count FROM StageGateRecord WHERE projectId = 'seed-f2-project'"
    );
    const permissions = await db.execute('SELECT COUNT(*) AS count FROM NpqActionPermission');

    expect(snapshot.rows[0]).toMatchObject({
      templateSetId: 'seed-npq-activity-template',
      templateVersionId: 'seed-npq-activity-template-v1',
    });
    const assignedRoleIds = assignments.rows.map((row) => (row as unknown as { positionRoleId: string }).positionRoleId);
    expect(assignedRoleIds).toEqual(['pos-fae', 'pos-npq', 'pos-pqe', 'pos-qcm', 'pos-ram', 'pos-sqe']);
    expect(Number(gates.rows[0]?.count)).toBe(6);
    expect(Number(permissions.rows[0]?.count)).toBe(18);
  });

  // ── 🔧 C2: Task.stageId FK → ProjectStage ──
  it('Task.stageId has FK to ProjectStage', async () => {
    const rs = await db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='Task'");
    const sql = (rs.rows[0] as unknown as { sql: string }).sql.toLowerCase();
    expect(sql).toContain('references "projectstage"');
  });

  // ── 🔧 H5: Task.assignee → ProjectMember (SQLite 自动小写列名) ──
  it('Task.assignee is via ProjectMember (not direct User)', async () => {
    const rs = await db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='Task'");
    const sql = (rs.rows[0] as unknown as { sql: string }).sql.toLowerCase();
    // 新 schema 中 assignee 引用 ProjectMember，确保只能分配给项目成员
    expect(sql).toContain('"assigneememberid"');
    expect(sql).toContain('references "projectmember"');
  });

  // ── 🔧 H8: User.email unique constraint ──
  it('User.email has unique constraint', async () => {
    const rs = await db.execute(
      "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='User' AND name LIKE '%email%'"
    );
    expect(rs.rows.length).toBeGreaterThanOrEqual(1);
    const sql = (rs.rows[0] as unknown as { sql: string }).sql.toLowerCase();
    expect(sql).toContain('unique');
  });

  // ── 🔧 H4: Composite indexes ──
  it('Task has composite index on (assigneeMemberId, status)', async () => {
    const rs = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='Task'"
    );
    const names = rs.rows.map((r) => (r as unknown as { name: string }).name);
    const idx = names.find((n) => n.includes('assigneeMemberId') && n.includes('status'));
    expect(idx).toBeDefined();
  });

  it('ProjectStage has composite index on (projectId, order)', async () => {
    const rs = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='ProjectStage'"
    );
    const names = rs.rows.map((r) => (r as unknown as { name: string }).name);
    const idx = names.find((n) => n.includes('projectId') && n.includes('order'));
    expect(idx).toBeDefined();
  });

  it('ObservabilityEvent has composite index on (traceId, timestamp)', async () => {
    const rs = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='ObservabilityEvent'"
    );
    const names = rs.rows.map((r) => (r as unknown as { name: string }).name);
    const idx = names.find((n) => n.includes('traceId') && n.includes('timestamp'));
    expect(idx).toBeDefined();
  });

  // ── 🔧 H10: User.status field ──
  it('User table has status column', async () => {
    const rs = await db.execute("PRAGMA table_info('User')");
    const cols = rs.rows.map((r) => (r as unknown as { name: string }).name);
    expect(cols).toContain('status');
  });

  // ── 🔧 User.email unique, Project.completedAt, Task.completedAt ──
  it('Project table has completedAt column', async () => {
    const rs = await db.execute("PRAGMA table_info('Project')");
    const cols = rs.rows.map((r) => (r as unknown as { name: string }).name);
    expect(cols).toContain('completedAt');
  });

  it('Task table has completedAt column', async () => {
    const rs = await db.execute("PRAGMA table_info('Task')");
    const cols = rs.rows.map((r) => (r as unknown as { name: string }).name);
    expect(cols).toContain('completedAt');
  });

  it('ProjectStage table has blockedReason and completedAt columns', async () => {
    const rs = await db.execute("PRAGMA table_info('ProjectStage')");
    const cols = rs.rows.map((r) => (r as unknown as { name: string }).name);
    expect(cols).toContain('blockedReason');
    expect(cols).toContain('completedAt');
  });

  // ── 🔧 L19: unique(projectId, order) ──
  it('ProjectStage has unique constraint on (projectId, order)', async () => {
    const rs = await db.execute(
      "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='ProjectStage'"
    );
    const hasUnique = rs.rows.some(
      (r) => (r as unknown as { sql: string }).sql?.toLowerCase().includes('unique')
    );
    expect(hasUnique).toBe(true);
  });

  // ── 🔧 L17: ObservabilityEvent.projectId FK ──
  it('ObservabilityEvent.projectId has FK to Project', async () => {
    const rs = await db.execute(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='ObservabilityEvent'"
    );
    const sql = (rs.rows[0] as unknown as { sql: string }).sql.toLowerCase();
    expect(sql).toContain('references "project"');
  });

  // ── 🔧 M13/M14: ComponentConfig dependsOn + policy ──
  it('ComponentConfig has dependsOnId and policy columns', async () => {
    const rs = await db.execute("PRAGMA table_info('ComponentConfig')");
    const cols = rs.rows.map((r) => (r as unknown as { name: string }).name);
    expect(cols).toContain('dependsOnId');
    expect(cols).toContain('policy');
  });

  // ── 🔧 M13: Component dependency chain seeded ──
  it('Component dependencies are seeded (comp-mgmt→templates)', async () => {
    const compMgmt = await db.execute(
      "SELECT dependsOnId FROM ComponentConfig WHERE id = 'cmp-admin-components'"
    );
    expect((compMgmt.rows[0] as unknown as { dependsOnId: string }).dependsOnId).toBe('cmp-admin-templates');

    const users = await db.execute(
      "SELECT dependsOnId FROM ComponentConfig WHERE id = 'cmp-admin-users'"
    );
    expect((users.rows[0] as unknown as { dependsOnId: string }).dependsOnId).toBe('cmp-admin-positions');
  });
});
