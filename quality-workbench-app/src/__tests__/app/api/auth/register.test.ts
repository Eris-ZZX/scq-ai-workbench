import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateUser, mockFindByUsername, mockJson } = vi.hoisted(() => ({
  mockCreateUser: vi.fn(),
  mockFindByUsername: vi.fn(),
  mockJson: vi.fn(
    (data: unknown, init?: ResponseInit) => ({
      data,
      status: (init as { status?: number })?.status ?? 200,
    }),
  ),
}));

vi.mock('@/lib/db/auth', () => ({
  createUser: mockCreateUser,
  findByUsername: mockFindByUsername,
}));

vi.mock('next/server', () => ({ NextResponse: { json: mockJson } }));

import { POST } from '@/app/api/auth/register/route';

type MockResponse = { status: number; data: unknown };

function post(body?: unknown) {
  return POST(
    body === undefined
      ? ({ json: () => Promise.reject(new Error('parse error')) } as unknown as Request)
      : ({ json: () => Promise.resolve(body) } as unknown as Request),
  );
}

describe('POST /api/auth/register', () => {
  beforeEach(() => vi.clearAllMocks());

  const validBody = { username: 'newuser', password: 'Test1234!' };

  it('returns 400 for invalid JSON', async () => {
    const res = (await post()) as unknown as MockResponse;
    expect(res.status).toBe(400);
  });

  it.each([
    { label: 'username', body: { password: 'Test1234!' } },
    { label: 'password', body: { username: 'u' } },
  ])('returns 400 when $label is missing', async ({ body }) => {
    const res = (await post(body)) as unknown as MockResponse;
    expect(res.status).toBe(400);
  });

  it('returns 400 for short password', async () => {
    const res = (await post({ ...validBody, password: 'Ab1' })) as unknown as MockResponse;
    expect(res.status).toBe(400);
  });

  it('returns 400 for long password (>128)', async () => {
    const res = (await post({ ...validBody, password: 'a'.repeat(129) })) as unknown as MockResponse;
    expect(res.status).toBe(400);
  });

  it('returns 400 for long username', async () => {
    const res = (await post({ ...validBody, username: 'a'.repeat(51) })) as unknown as MockResponse;
    expect(res.status).toBe(400);
  });

  it('returns 400 for username with invalid chars', async () => {
    const res = (await post({ ...validBody, username: 'bad name!' })) as unknown as MockResponse;
    expect(res.status).toBe(400);
  });

  it('returns 409 for duplicate username', async () => {
    mockFindByUsername.mockResolvedValueOnce({ id: 'exists' });
    const res = (await post(validBody)) as unknown as MockResponse;
    expect(res.status).toBe(409);
  });

  it('returns 201 on success', async () => {
    mockFindByUsername.mockResolvedValueOnce(null);
    mockCreateUser.mockResolvedValueOnce({
      id: 'new-id',
      username: 'newuser',
    });
    const res = (await post(validBody)) as unknown as MockResponse;
    expect(res.status).toBe(201);
    expect(mockCreateUser).toHaveBeenCalledWith(validBody);
  });
});
