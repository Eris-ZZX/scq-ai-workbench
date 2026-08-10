import { describe, expect, it, vi } from 'vitest';
import { mergeUsersIntoPrimary } from '@/platform/auth/user-merge';

describe('user merge service', () => {
  it('migrates user relationships, keeps the stronger role, and disables duplicates', async () => {
    const queryRaw = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
      const sql = strings.join('');
      if (sql.includes('SELECT id, platform_role, role, directory_user_id')) {
        return Promise.resolve([
          {
            id: 'primary',
            platform_role: 'user',
            role: 'user',
            directory_user_id: null,
            status: 'active',
            external_source: 'authing',
          },
          {
            id: 'duplicate',
            platform_role: 'admin',
            role: 'manager',
            directory_user_id: null,
            status: 'active',
            external_source: 'dingtalk',
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const merged = await mergeUsersIntoPrimary(
      { $queryRaw: queryRaw } as never,
      'primary',
      ['primary', 'duplicate'],
      { preferredEmail: 'person@example.test' },
    );

    expect(merged).toEqual(['duplicate']);
    const sql = queryRaw.mock.calls.map(([strings]) => strings.join('')).join('\n');
    expect(sql).toContain('UPDATE user_identities');
    expect(sql).toContain('UPDATE project_members');
    expect(sql).toContain('UPDATE notifications');
    expect(sql).toContain('UPDATE ai_resource_memberships');
    expect(sql).toContain("SET status = 'disabled'");
    expect(sql).toContain('platform_role =');
    expect(sql).toContain('role =');
  });

  it('is idempotent for an already disabled merged account', async () => {
    const queryRaw = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
      const sql = strings.join('');
      if (sql.includes('SELECT id, platform_role, role, directory_user_id')) {
        return Promise.resolve([
          {
            id: 'primary',
            platform_role: 'admin',
            role: 'manager',
            directory_user_id: null,
            status: 'active',
            external_source: 'authing',
          },
          {
            id: 'duplicate',
            platform_role: 'user',
            role: 'user',
            directory_user_id: null,
            status: 'disabled',
            external_source: 'merged',
          },
        ]);
      }
      return Promise.resolve([]);
    });

    await expect(mergeUsersIntoPrimary(
      { $queryRaw: queryRaw } as never,
      'primary',
      ['duplicate'],
    )).resolves.toEqual([]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});
