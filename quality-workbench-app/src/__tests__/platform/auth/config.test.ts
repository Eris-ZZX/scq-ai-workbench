import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSecretKey } from '@/platform/auth/auth.jwt';

describe('auth config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails fast in production when JWT_SECRET is missing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', '');

    expect(() => getSecretKey()).toThrow('JWT_SECRET is required in production');
  });

  it('keeps a development fallback for local runs', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('JWT_SECRET', '');

    expect(getSecretKey()).toBeInstanceOf(Uint8Array);
  });
});
