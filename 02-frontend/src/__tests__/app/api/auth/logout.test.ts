import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDestroySession, mockJson, mockRedirect } = vi.hoisted(() => ({
  mockDestroySession: vi.fn(),
  mockJson: vi.fn((data: unknown) => ({ data, status: 200 })),
  mockRedirect: vi.fn((url: URL, init?: ResponseInit) => ({
    url: url.toString(),
    status: init?.status ?? 307,
  })),
}));

vi.mock('@/platform/auth/auth.config', () => ({ destroySession: mockDestroySession }));
vi.mock('next/server', () => ({ NextResponse: { json: mockJson, redirect: mockRedirect } }));

import { POST } from '@/app/api/auth/logout/route';

type MockResponse = { data?: unknown; status: number; url?: string };

describe('POST /api/auth/logout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('destroys session and returns JSON for API callers', async () => {
    const res = (await POST(new Request('http://localhost/api/auth/logout'))) as unknown as MockResponse;

    expect(mockDestroySession).toHaveBeenCalledTimes(1);
    expect(res.data).toEqual({ ok: true });
  });

  it('destroys session and redirects browser form submits to login', async () => {
    const res = (await POST(
      new Request('http://localhost/api/auth/logout', {
        headers: { accept: 'text/html,application/xhtml+xml' },
      }),
    )) as unknown as MockResponse;

    expect(mockDestroySession).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(303);
    expect(res.url).toBe('http://localhost/login');
  });
});
