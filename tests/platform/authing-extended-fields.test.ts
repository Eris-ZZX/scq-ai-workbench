import { describe, expect, it } from 'vitest';
import {
  buildEmpOriginIndex,
  matchAuthingSupervisor,
  readAuthingExtendedString,
} from '@/platform/auth/authing-extended-fields';

describe('Authing extended fields supervisor matching', () => {
  it('reads emp_leader_origin_id and emp_origin_id from extended_fields JSON', () => {
    const fields = JSON.stringify({
      emp_no: '017298',
      emp_leader_origin_id: '1626178515924779009',
      emp_origin_id: '1778666829264318465',
    });

    expect(readAuthingExtendedString(fields, 'emp_leader_origin_id')).toBe('1626178515924779009');
    expect(readAuthingExtendedString(fields, 'emp_origin_id')).toBe('1778666829264318465');
  });

  it('matches a leader by emp_leader_origin_id to another user emp_origin_id', () => {
    const index = buildEmpOriginIndex([
      {
        id: 'leader-1',
        username: '013192',
        displayName: '戴锋',
        extendedFields: JSON.stringify({ emp_origin_id: '1626178515924779009' }),
      },
      {
        id: 'user-1',
        username: '017298',
        displayName: '马跃如',
        extendedFields: JSON.stringify({
          emp_leader_origin_id: '1626178515924779009',
          emp_origin_id: 'other',
        }),
      },
    ]);

    expect(matchAuthingSupervisor('1626178515924779009', index)).toMatchObject({
      id: 'leader-1',
      displayName: '戴锋',
      empOriginId: '1626178515924779009',
    });
  });
});
