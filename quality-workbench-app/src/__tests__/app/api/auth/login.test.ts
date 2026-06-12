import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindByUsername, mockVerifyPassword, mockCreateSession, mockJson, mockRedirect } = vi.hoisted(() => ({
  mockFindByUsername: vi.fn(),
  mockVerifyPassword: vi.fn(),
  mockCreateSession: vi.fn(),
  mockJson: vi.fn((data: unknown, init?: ResponseInit) => ({
    data,
    status: init?.status ?? 200,
  })),
  mockRedirect: vi.fn((url: URL, init?: ResponseInit) => ({
    url: url.toString(),
    status: init?.status ?? 307,
  })),
}));

vi.mock('@/lib/db/auth', () => ({
  findByUsername: mockFindByUsername,
  verifyPassword: mockVerifyPassword,
}));
vi.mock('@/platform/auth/auth.config', () => ({ createSession: mockCreateSession }));
vi.mock('next/server', () => ({ NextResponse: { json: mockJson, redirect: mockRedirect } }));

import { POST } from '@/app/api/auth/login/route';

type MockResponse = { status: number; data?: unknown; url?: string };

const activeUser = {
  id: 'u1',
  username: 'testuser',
  role: 'user',
  status: 'active',
  passwordHash: '$2a$12$dummyhashxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
};

function jsonRequest(body?: unknown) {
  return POST(
    body === undefined
      ? new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{',
        })
      : new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
  );
}

function formRequest(body: Record<string, string>) {
  return POST(
    new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    }),
  );
}

describe('POST /api/auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for invalid JSON', async () => {
    const res = (await jsonRequest()) as unknown as MockResponse;
    expect(res.status).toBe(400);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'username', body: { password: 'Test1234!' } },
    { label: 'password', body: { username: 'testuser' } },
  ])('returns 400 when $label is missing', async ({ body }) => {
    const res = (await jsonRequest(body)) as unknown as MockResponse;
    expect(res.status).toBe(400);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('returns 401 for non-existent user with timing-safe password check', async () => {
    mockFindByUsername.mockResolvedValueOnce(null);
    mockVerifyPassword.mockResolvedValueOnce(false);
    const res = (await jsonRequest({ username: 'nobody', password: 'Test1234!' })) as unknown as MockResponse;
    expect(res.status).toBe(401);
    expect(mockVerifyPassword).toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('returns 401 for wrong password', async () => {
    mockFindByUsername.mockResolvedValueOnce(activeUser);
    mockVerifyPassword.mockResolvedValueOnce(false);
    const res = (await jsonRequest({ username: 'testuser', password: 'WrongPass1!' })) as unknown as MockResponse;
    expect(res.status).toBe(401);
    expect(mockVerifyPassword).toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('returns 401 for disabled user after password verification', async () => {
    mockFindByUsername.mockResolvedValueOnce({ ...activeUser, status: 'disabled' });
    mockVerifyPassword.mockResolvedValueOnce(true);
    const res = (await jsonRequest({ username: 'disabled', password: 'Correct1!' })) as unknown as MockResponse;
    expect(res.status).toBe(401);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('returns 200 on JSON success', async () => {
    mockFindByUsername.mockResolvedValueOnce(activeUser);
    mockVerifyPassword.mockResolvedValueOnce(true);
    const res = (await jsonRequest({ username: 'testuser', password: 'Correct1!' })) as unknown as MockResponse;
    expect(res.status).toBe(200);
    expect(mockCreateSession).toHaveBeenCalledWith({
      id: 'u1',
      username: 'testuser',
      role: 'user',
    });
  });

  it('returns 401 for password longer than 128 chars', async () => {
    const res = (await jsonRequest({ username: 'testuser', password: 'a'.repeat(129) })) as unknown as MockResponse;
    expect(res.status).toBe(401);
  });

  it('redirects to workbench for form login success', async () => {
    mockFindByUsername.mockResolvedValueOnce(activeUser);
    mockVerifyPassword.mockResolvedValueOnce(true);
    const res = (await formRequest({ username: 'testuser', password: 'Correct1!' })) as unknown as MockResponse;

    expect(res.status).toBe(303);
    expect(res.url).toBe('http://localhost/workbench');
    expect(mockCreateSession).toHaveBeenCalledWith({
      id: 'u1',
      username: 'testuser',
      role: 'user',
    });
  });

  it('redirects back to login for form login failure', async () => {
    mockFindByUsername.mockResolvedValueOnce(activeUser);
    mockVerifyPassword.mockResolvedValueOnce(false);
    const res = (await formRequest({ username: 'testuser', password: 'WrongPass1!' })) as unknown as MockResponse;

    expect(res.status).toBe(303);
    expect(res.url).toBe('http://localhost/login?error=1');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});
