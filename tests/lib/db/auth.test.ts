import { describe, it, expect, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/database';

const SALT_ROUNDS = 12;
const describeDatabase = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;

const testUser = {
  username: `test-auth-${Date.now()}`,
  password: 'Test1234!',
};

describeDatabase('Auth: User CRUD + bcrypt (database gateway)', () => {
  let userId = '';

  afterAll(async () => {
    if (userId) {
      await db.user.deleteMany({ where: { id: userId } });
    }
    await db.user.deleteMany({ where: { username: testUser.username } });
  });

  it('creates a user with bcrypt-hashed password', async () => {
    const hash = await bcrypt.hash(testUser.password, SALT_ROUNDS);
    const user = await db.user.create({
      data: { username: testUser.username, passwordHash: hash },
      select: { id: true, username: true, role: true, status: true },
    });
    userId = user.id;
    expect(user.username).toBe(testUser.username);

    const raw = await db.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    expect(raw?.passwordHash).toMatch(/^\$2[aby]\$\d+\$/);
    expect(raw?.passwordHash).not.toBe(testUser.password);
  });

  it('findByUsername: finds existing user', async () => {
    const user = await db.user.findUnique({
      where: { username: testUser.username },
      select: { id: true, username: true, role: true, status: true },
    });
    expect(user).not.toBeNull();
    expect(user?.username).toBe(testUser.username);
  });

  it('findByUsername: returns null for non-existent user', async () => {
    const user = await db.user.findUnique({
      where: { username: `nobody-${Date.now()}` },
    });
    expect(user).toBeNull();
  });

  it('findById: returns user without passwordHash when not selected', async () => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });
    expect(user?.username).toBe(testUser.username);
    expect((user as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('verifyPassword: bcrypt.compare returns true for correct password', async () => {
    const raw = await db.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    const ok = await bcrypt.compare(testUser.password, raw!.passwordHash);
    expect(ok).toBe(true);
  });

  it('verifyPassword: bcrypt.compare returns false for wrong password', async () => {
    const raw = await db.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    const ok = await bcrypt.compare('WrongPassword123!', raw!.passwordHash);
    expect(ok).toBe(false);
  });

  it('username has unique constraint', async () => {
    await expect(
      db.user.create({
        data: { username: testUser.username, passwordHash: 'noop' },
      }),
    ).rejects.toThrow();
  });

  it('user.status defaults to active', async () => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { status: true, createdAt: true, updatedAt: true },
    });
    expect(user?.status).toBe('active');
    expect(user?.createdAt).toBeInstanceOf(Date);
    expect(user?.updatedAt).toBeInstanceOf(Date);
  });

  it('disabled user has status=disabled after update', async () => {
    await db.user.update({ where: { id: userId }, data: { status: 'disabled' } });
    const disabled = await db.user.findUnique({ where: { id: userId }, select: { status: true } });
    expect(disabled?.status).toBe('disabled');
    await db.user.update({ where: { id: userId }, data: { status: 'active' } });
  });
});
