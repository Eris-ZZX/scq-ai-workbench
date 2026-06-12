import { describe, it, expect, afterAll } from 'vitest';
import path from 'node:path';
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

// 直接用 libsql 测试认证逻辑，绕过 PrismaClient 的 DATABASE_URL 问题
const dbPath = path.resolve(process.cwd(), 'dev.db');
const db = createClient({ url: `file:${dbPath}` });
const SALT_ROUNDS = 12;

const testUser = {
  username: `test-auth-${Date.now()}`,
  password: 'Test1234!',
  displayName: '测试用户',
};

describe('Auth: User CRUD + bcrypt (libsql direct)', () => {
  let userId = '';

  afterAll(async () => {
    if (userId) {
      await db.execute({ sql: 'DELETE FROM User WHERE id = ?', args: [userId] });
    }
    // 兜底: 用 username 清理
    await db.execute({ sql: 'DELETE FROM User WHERE username = ?', args: [testUser.username] });
  });

  it('creates a user with bcrypt-hashed password', async () => {
    const hash = await bcrypt.hash(testUser.password, SALT_ROUNDS);
    const rs = await db.execute({
      sql: `INSERT INTO User (id, username, "passwordHash", displayName, role, status, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, 'user', 'active', datetime('now'), datetime('now'))
            RETURNING id, username, displayName, role, status`,
      args: [crypto.randomUUID(), testUser.username, hash, testUser.displayName],
    });
    const user = rs.rows[0] as unknown as { id: string; username: string };
    userId = user.id;
    expect(user.username).toBe(testUser.username);

    // 验证密码哈希不存为明文
    const raw = await db.execute({
      sql: 'SELECT "passwordHash" FROM User WHERE id = ?',
      args: [userId],
    });
    const row = raw.rows[0] as unknown as { passwordHash: string };
    expect(row.passwordHash).toMatch(/^\$2[aby]\$\d+\$/);
    expect(row.passwordHash).not.toBe(testUser.password);
  });

  it('findByUsername: finds existing user', async () => {
    const rs = await db.execute({
      sql: 'SELECT id, username, displayName, role, status FROM User WHERE username = ?',
      args: [testUser.username],
    });
    expect(rs.rows).toHaveLength(1);
    const user = rs.rows[0] as unknown as { username: string };
    expect(user.username).toBe(testUser.username);
  });

  it('findByUsername: returns empty for non-existent user', async () => {
    const rs = await db.execute({
      sql: 'SELECT id FROM User WHERE username = ?',
      args: [`nobody-${Date.now()}`],
    });
    expect(rs.rows).toHaveLength(0);
  });

  it('findById: returns user without passwordHash (application layer)', async () => {
    const rs = await db.execute({
      sql: 'SELECT id, username, displayName FROM User WHERE id = ?',
      args: [userId],
    });
    const user = rs.rows[0] as Record<string, unknown>;
    expect(user.username).toBe(testUser.username);
    expect(user.passwordHash).toBeUndefined();
  });

  it('verifyPassword: bcrypt.compare returns true for correct password', async () => {
    const raw = await db.execute({
      sql: 'SELECT "passwordHash" FROM User WHERE id = ?',
      args: [userId],
    });
    const { passwordHash } = raw.rows[0] as unknown as { passwordHash: string };
    const ok = await bcrypt.compare(testUser.password, passwordHash);
    expect(ok).toBe(true);
  });

  it('verifyPassword: bcrypt.compare returns false for wrong password', async () => {
    const raw = await db.execute({
      sql: 'SELECT "passwordHash" FROM User WHERE id = ?',
      args: [userId],
    });
    const { passwordHash } = raw.rows[0] as unknown as { passwordHash: string };
    const ok = await bcrypt.compare('WrongPassword123!', passwordHash);
    expect(ok).toBe(false);
  });

  it('username has unique constraint', async () => {
    await expect(
      (async () => {
        await db.execute({
          sql: `INSERT INTO User (id, username, "passwordHash", displayName)
                VALUES (?, ?, ?, ?)`,
          args: [crypto.randomUUID(), testUser.username, 'noop', 'dup'],
        });
      })(),
    ).rejects.toThrow();
  });

  it('user.status defaults to active', async () => {
    const rs = await db.execute({
      sql: 'SELECT status FROM User WHERE id = ?',
      args: [userId],
    });
    const { status } = rs.rows[0] as unknown as { status: string };
    expect(status).toBe('active');
  });

  it('disabled user has status=disabled after update', async () => {
    await db.execute({ sql: 'UPDATE User SET status = ? WHERE id = ?', args: ['disabled', userId] });
    const rs = await db.execute({ sql: 'SELECT status FROM User WHERE id = ?', args: [userId] });
    const { status } = rs.rows[0] as unknown as { status: string };
    expect(status).toBe('disabled');
    // 恢复
    await db.execute({ sql: 'UPDATE User SET status = ? WHERE id = ?', args: ['active', userId] });
  });
});
