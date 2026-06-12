import { beforeEach, describe, expect, it, vi } from 'vitest';

const { jar, mockJwtVerify, mockPrisma } = vi.hoisted(() => {
  const jar = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };
  return {
    jar,
    mockJwtVerify: vi.fn(),
    mockPrisma: {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => jar),
  headers: vi.fn(async () => new Headers({ host: 'localhost:3000' })),
}));

vi.mock('jose', () => ({
  SignJWT: class {
    setProtectedHeader() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    async sign() {
      return 'signed-token';
    }
  },
  jwtVerify: mockJwtVerify,
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { destroySession, getSession } from '@/platform/auth/auth.config';

describe('auth session revocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jar.get.mockReturnValue({ value: 'token-1' });
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: 'user-1',
        username: 'npq',
        role: 'user',
        iat: 200,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'npq',
      role: 'user',
      status: 'active',
      updatedAt: new Date(100_000),
    });
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });
  });

  it('rejects the same token after logout', async () => {
    await destroySession();
    const session = await getSession();

    expect(session).toBeNull();
    expect(jar.delete).toHaveBeenCalledWith('qe-session');
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects tokens issued before the user invalidation timestamp', async () => {
    jar.get.mockReturnValue({ value: 'token-2' });
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        sub: 'user-1',
        username: 'npq',
        role: 'user',
        iat: 100,
      },
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      username: 'npq',
      role: 'user',
      status: 'active',
      updatedAt: new Date(103_000),
    });

    await expect(getSession()).resolves.toBeNull();
  });

  it('uses millisecond authAt to reject tokens invalidated in the same second', async () => {
    jar.get.mockReturnValue({ value: 'token-3' });
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        sub: 'user-1',
        username: 'npq',
        role: 'user',
        iat: 100,
        authAt: 100_100,
      },
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      username: 'npq',
      role: 'user',
      status: 'active',
      updatedAt: new Date(100_101),
    });

    await expect(getSession()).resolves.toBeNull();
  });
});
