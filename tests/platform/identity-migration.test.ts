import { describe, expect, it } from 'vitest';
import { buildIdentityMigrationPlan } from '@/platform/auth/identity-migration';

describe('Authing identity migration matching', () => {
  const users = [
    { id: 'u1', username: 'E001', email: 'e001@example.test', status: 'active' },
    { id: 'u2', username: 'E002', email: 'shared@example.test', status: 'disabled' },
    { id: 'u3', username: 'E003', email: 'shared@example.test', status: 'active' },
  ];

  it('matches by stable username before email and preserves disabled users', () => {
    const [decision] = buildIdentityMigrationPlan(users, [{
      subject: 'sub-1',
      username: 'E002',
      email: 'shared@example.test',
    }]);
    expect(decision).toMatchObject({
      kind: 'link',
      matchedBy: 'username',
      user: { id: 'u2', status: 'disabled' },
    });
  });

  it('does not merge an email collision or an unmatched identity', () => {
    const decisions = buildIdentityMigrationPlan(users, [
      { subject: 'sub-shared', email: 'shared@example.test' },
      { subject: 'sub-missing', username: 'E999', name: '同名用户' },
    ]);
    expect(decisions[0]).toMatchObject({ kind: 'ambiguous' });
    expect(decisions[1]).toMatchObject({ kind: 'unmatched' });
  });
});
