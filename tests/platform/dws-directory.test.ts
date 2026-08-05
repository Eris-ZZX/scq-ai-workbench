import { describe, expect, it } from 'vitest';
import { createDwsDirectoryProvider, selectDwsPrimaryDepartmentId } from '@/lib/dws/directory';

describe('DWS directory contract', () => {
  it('walks departments, deduplicates members and hydrates user details', async () => {
    const calls: string[][] = [];
    const cli = {
      run: async <T>(args: string[]) => {
        calls.push(args);
        if (args[2] === 'list-children' && args[4] === '1') {
          return { departments: [{ deptId: 10, name: '品质中心', parentId: 1 }] } as T;
        }
        if (args[2] === 'list-children') return { departments: [] } as T;
        if (args[2] === 'list-members') {
          return {
            members: [{ userId: 'dws-1', deptIdList: args[4] === '1' ? [1, 10] : [10] }],
            ...(args.includes('--cursor') ? {} : { nextCursor: 'cursor-1' }),
          } as T;
        }
        return {
          users: [{
            userId: 'dws-1',
            username: 'E001',
            name: '测试用户',
            email: 'e001@example.test',
            title: 'PQE',
            deptIdList: [10],
            managerUserId: 'manager-1',
          }],
        } as T;
      },
    };

    const provider = createDwsDirectoryProvider(cli);
    const departments = await provider.listDepartments();
    const users = await provider.listUsers(departments);

    expect(departments.map((department) => department.id)).toEqual(['1', '10']);
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      id: 'dws-1',
      username: 'E001',
      title: 'PQE',
      supervisorId: 'manager-1',
    });
    expect(calls.some((args) => args.includes('--format'))).toBe(false);
  });

  it('selects the deepest department and uses directory order as tie breaker', () => {
    const departments = new Map([
      ['1', { id: '1', name: '组织', parentId: null }],
      ['10', { id: '10', name: '品质中心', parentId: '1' }],
      ['11', { id: '11', name: '品质工程组', parentId: '10' }],
    ]);
    expect(selectDwsPrimaryDepartmentId(['10', '11'], departments)).toBe('11');
    expect(selectDwsPrimaryDepartmentId(['10', '11'], departments, { '10': 99, '11': 1 })).toBe('11');
  });
});
