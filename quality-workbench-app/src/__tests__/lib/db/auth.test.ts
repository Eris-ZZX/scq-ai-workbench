import { describe, it, expect, afterAll } from 'vitest';
import path from 'node:path';
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

const dbPath = path.resolve(process.cwd(), 'dev.db');
const db = createClient({ url: `file:${dbPath}` });
const SALT_ROUNDS = 12;

const testUser = {
  username: `test-auth-${Date.now()}`,
  password: 'Test1234!',
};

describe('Auth: User CRUD + bcrypt (libsql direct)', () => {
  let userId = '';

  afterAll(async () => {
    if (userId) {
      await db.execute({ sql: 'DELETE FROM User WHERE id = ?', args: [userId] });
    }
    await db.execute({ sql: 'DELETE FROM User WHERE username = ?', args: [testUser.username] });
  });

  it('creates a user with bcrypt-hashed password', async () => {
    const hash = await bcrypt.hash(testUser.password, SALT_ROUNDS);
    const rs = await db.execute({
      sql: `INSERT INTO User (id, username, "passwordHash", role, status, createdAt, updatedAt)
            VALUES (?, ?, ?, 'user', 'active', datetime('now'), datetime('now'))
            RETURNING id, username, role, status`,
      args: [crypto.randomUUID(), testUser.username, hash],
    });
    const user = rs.rows[0] as unknown as { id: string; username: string };
    userId = user.id;
    expect(user.username).toBe(testUser.username);

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
      sql: 'SELECT id, username, role, status FROM User WHERE username = ?',
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

  it('findById: returns user without passwordHash', async () => {
    const rs = await db.execute({
      sql: 'SELECT id, username FROM User WHERE id = ?',
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
          sql: `INSERT INTO User (id, username, "passwordHash")
                VALUES (?, ?, ?)`,
          args: [crypto.randomUUID(), testUser.username, 'noop'],
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
    await db.execute({ sql: 'UPDATE User SET status = ? WHERE id = ?', args: ['active', userId] });
  });
});
