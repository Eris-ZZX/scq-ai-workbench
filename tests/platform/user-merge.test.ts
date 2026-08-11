import { describe, expect, it, vi } from 'vitest';
import {
  mergeUsersIntoPrimary,
  selectSafeUserMergeCandidate,
  type UserMergeCandidate,
} from '@/platform/auth/user-merge';

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

  it('does not automatically merge an email-only or ambiguous match', () => {
    expect(selectSafeUserMergeCandidate([
      candidate({ email_match: true }),
    ])).toBeNull();
    expect(selectSafeUserMergeCandidate([
      candidate({ unionid_match: true }),
      candidate({ userid_match: true }),
    ])).toBeNull();
  });

  it('prefers the unique provider identity over a weaker username match', () => {
    expect(selectSafeUserMergeCandidate([
      candidate({ username_match: true }),
      candidate({ unionid_match: true }),
    ])).toMatchObject({ id: 'user-2' });
  });
});

function candidate(overrides: Partial<UserMergeCandidate>): UserMergeCandidate {
  return {
    id: 'user-1',
    display_name: null,
    email: null,
    platform_role: 'user',
    role: 'user',
    status: 'active',
    has_authing_identity: false,
    username_match: false,
    email_match: false,
    unionid_match: false,
    userid_match: false,
    ...overrides,
    ...(overrides.unionid_match ? { id: 'user-2' } : {}),
    ...(overrides.userid_match ? { id: 'user-3' } : {}),
  };
}
