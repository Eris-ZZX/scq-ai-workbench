import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCorpAccessToken } = vi.hoisted(() => ({
  getCorpAccessToken: vi.fn(),
}));

vi.mock('@/lib/database', () => ({ db: {} }));
vi.mock('@/lib/dingtalk/token', () => ({ getCorpAccessToken }));

import {
  fetchDingTalkDepartments,
  fetchDingTalkDirectoryUsers,
  normalizeDepartmentIds,
  normalizeDepartmentOrders,
  selectPrimaryDepartmentId,
  type DingTalkDepartmentSnapshot,
} from '@/lib/dingtalk/organization';

describe('DingTalk organization synchronization helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCorpAccessToken.mockResolvedValue('test-token');
  });

  it('normalizes department ids and ordering from DingTalk response variants', () => {
    const user = {
      dept_id_list: [1, '2', 2],
      dept_order_list: [{ dept_id: 1, order: 3 }, { dept_id: '2', order: 8 }],
    };

    expect(normalizeDepartmentIds(user)).toEqual(['1', '2']);
    expect(normalizeDepartmentOrders(user)).toEqual({ '1': 3, '2': 8 });
  });

  it('selects one lowest-level department and uses order as the tie breaker', () => {
    const departments = new Map<string, DingTalkDepartmentSnapshot>([
      ['10', { id: '10', name: '品质中心', parentId: '1' }],
      ['11', { id: '11', name: '品质工程组', parentId: '10' }],
      ['20', { id: '20', name: '供应商质量组', parentId: '1' }],
    ]);

    expect(selectPrimaryDepartmentId(['10', '11'], departments)).toBe('11');
    expect(selectPrimaryDepartmentId(
      ['10', '11', '20'],
      departments,
      { '11': 2, '20': 8 },
    )).toBe('20');
  });

  it('walks department hierarchy and paginates directory users without duplicates', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        result: [
          { dept_id: 10, name: '品质中心', parent_id: 1 },
          { dept_id: 20, name: '供应商质量组', parent_id: 1 },
        ],
      }))
      .mockResolvedValueOnce(jsonResponse({
        result: [{ dept_id: 11, name: '品质工程组', parent_id: 10 }],
      }))
      .mockResolvedValueOnce(jsonResponse({ result: [] }))
      .mockResolvedValueOnce(jsonResponse({ result: [] }))
      .mockResolvedValueOnce(jsonResponse({
        result: {
          list: [{ userid: 'u-1', dept_id_list: [10, 11] }],
          has_more: true,
          next_cursor: 100,
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        result: {
          list: [{ userid: 'u-1', dept_id_list: [10, 11] }, { userid: 'u-2', dept_id_list: [20] }],
          has_more: false,
        },
      }));

    const departments = await fetchDingTalkDepartments();
    const users = await fetchDingTalkDirectoryUsers(departments.slice(0, 1));

    expect(departments.map((department) => department.id)).toEqual(['1', '10', '20', '11']);
    expect(users.map((user) => user.userid)).toEqual(['u-1', 'u-2']);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify({ errcode: 0, errmsg: 'ok', ...body }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
