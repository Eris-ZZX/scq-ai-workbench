import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetSession, mockFindById, mockJson } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFindById: vi.fn(),
  mockJson: vi.fn((data: unknown, init?: ResponseInit) => ({
    data,
    status: (init as { status?: number })?.status ?? 200,
  })),
}));

vi.mock('@/platform/auth/auth.config', () => ({ getSession: mockGetSession }));
vi.mock('@/lib/db/auth', () => ({ findById: mockFindById }));
vi.mock('next/server', () => ({ NextResponse: { json: mockJson } }));

import { GET } from '@/app/api/auth/me/route';

type MockResponse = { status: number; data: unknown };

describe('GET /api/auth/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no session', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = (await GET()) as unknown as MockResponse;
    expect(res.status).toBe(401);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('returns 404 when session user not in DB', async () => {
    mockGetSession.mockResolvedValueOnce({ sub: 'ghost', username: 'g', role: 'user' });
    mockFindById.mockResolvedValueOnce(null);
    const res = (await GET()) as unknown as MockResponse;
    expect(res.status).toBe(404);
  });

  it('returns 200 with user data (no passwordHash)', async () => {
    const safe = { id: 'u1', username: 'test', role: 'user', status: 'active' };
    mockGetSession.mockResolvedValueOnce({ sub: 'u1', username: 'test', role: 'user' });
    mockFindById.mockResolvedValueOnce(safe);
    const res = (await GET()) as unknown as MockResponse;
    expect(res.status).toBe(200);
    expect(res.data).toEqual(safe);
    expect(res.data).not.toHaveProperty('passwordHash');
  });
});
