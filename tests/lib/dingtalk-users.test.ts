import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCorpAccessToken } = vi.hoisted(() => ({
  getCorpAccessToken: vi.fn(),
}));

vi.mock('@/lib/database', () => ({ db: {} }));
vi.mock('@/lib/dingtalk/token', () => ({ getCorpAccessToken }));

import { resolveDingTalkIdentityByUserId } from '@/lib/dingtalk/users';

describe('DingTalk user identity lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    getCorpAccessToken.mockResolvedValue('test-token');
  });

  it('resolves unionid from an internal userid through the official user detail API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      result: {
        userid: '017298',
        unionid: 'union-017298',
        job_number: '017298',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveDingTalkIdentityByUserId('017298')).resolves.toEqual({
      userid: '017298',
      unionid: 'union-017298',
      jobNumber: '017298',
      title: null,
      managerUserId: null,
      name: null,
      departmentIds: [],
      departmentOrders: {},
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/topapi/v2/user/get?access_token=test-token'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userid: '017298', language: 'zh_CN' }),
      }),
    );
  });

  it('rejects a response without unionid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      result: { userid: '017298' },
    })));

    await expect(resolveDingTalkIdentityByUserId('017298')).resolves.toBeNull();
  });

  it('rejects a response for a different userid or an API error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        result: { userid: 'other-user', unionid: 'union-other' },
      }))
      .mockResolvedValueOnce(jsonResponse(
        { errcode: 60011, errmsg: '权限不足' },
        200,
      ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveDingTalkIdentityByUserId('017298')).resolves.toBeNull();
    await expect(resolveDingTalkIdentityByUserId('017298')).resolves.toBeNull();
  });

  it('returns title, manager and department ids from the user detail response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      result: {
        userid: '017298',
        unionid: 'union-017298',
        name: '马跃如',
        title: 'PQE',
        manager_userid: '013192',
        job_number: '017298',
        dept_id_list: [100, 200],
        dept_order_list: [
          { dept_id: 100, order: 1 },
          { dept_id: 200, order: 9 },
        ],
      },
    })));

    await expect(resolveDingTalkIdentityByUserId('017298')).resolves.toEqual({
      userid: '017298',
      unionid: 'union-017298',
      jobNumber: '017298',
      title: 'PQE',
      managerUserId: '013192',
      name: '马跃如',
      departmentIds: ['100', '200'],
      departmentOrders: { '100': 1, '200': 9 },
    });
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify({ errcode: 0, errmsg: 'ok', ...body as object }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
