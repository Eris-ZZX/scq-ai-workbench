import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockJson } = vi.hoisted(() => ({
  mockJson: vi.fn((data: unknown, init?: ResponseInit) => ({
    type: 'json',
    data,
    status: (init as { status?: number })?.status,
  })),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    next: vi.fn(() => ({ type: 'next' })),
    redirect: vi.fn((url: URL) => ({ type: 'redirect', url })),
    json: mockJson,
  },
}));

// jose not mocked — JWT validation tested via API route integration tests

import { authMiddleware } from '@/platform/auth/middleware';

type MockJsonResponse = { type: string; data: unknown; status: number };

function mockReq(pathname: string, token?: string, headers = new Headers()) {
  const url = new URL(`http://localhost${pathname}`);
  return {
    nextUrl: url,
    url: url.href,
    headers,
    cookies: { get: () => (token ? { value: token } : undefined) },
  } as unknown as Parameters<typeof authMiddleware>[0];
}

describe('Auth Middleware — routing logic', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes through /login', async () => {
    expect(await authMiddleware(mockReq('/login'))).toEqual({ type: 'next' });
  });

  it('passes through /register', async () => {
    expect(await authMiddleware(mockReq('/register'))).toEqual({ type: 'next' });
  });

  it('passes through /api/auth/login', async () => {
    expect(await authMiddleware(mockReq('/api/auth/login'))).toEqual({ type: 'next' });
  });

  it('passes through /api/auth/register', async () => {
    expect(await authMiddleware(mockReq('/api/auth/register'))).toEqual({ type: 'next' });
  });

  it('passes through /_next/static/...', async () => {
    expect(await authMiddleware(mockReq('/_next/static/chunks/app.js'))).toEqual({ type: 'next' });
  });

  it('passes through /favicon.ico', async () => {
    expect(await authMiddleware(mockReq('/favicon.ico'))).toEqual({ type: 'next' });
  });

  it('redirects page routes without cookie', async () => {
    const res = (await authMiddleware(mockReq('/dashboard'))) as { type: string };
    expect(res.type).toBe('redirect');
  });

  it('redirects page routes to the browser host for LAN access', async () => {
    const headers = new Headers({ host: '172.17.137.235:3000' });
    const res = (await authMiddleware(mockReq('/dashboard', undefined, headers))) as { type: string; url: URL };
    expect(res.type).toBe('redirect');
    expect(res.url.toString()).toBe('http://172.17.137.235:3000/login');
  });

  it('returns JSON 401 for /api/ routes without cookie', async () => {
    const res = (await authMiddleware(mockReq('/api/projects'))) as unknown as MockJsonResponse;
    expect(res.type).toBe('json');
    expect(res.status).toBe(401);
  });

  it('returns JSON 401 for /api/ routes with invalid cookie', async () => {
    const res = (await authMiddleware(mockReq('/api/tasks', 'invalid-jwt'))) as unknown as MockJsonResponse;
    expect(res.type).toBe('json');
    expect(res.status).toBe(401);
  });
});
