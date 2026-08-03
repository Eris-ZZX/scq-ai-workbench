import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSecureCookie, getSecretKey } from '@/platform/auth/auth.jwt';

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

  it('uses the external application URL for cookie transport security', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_BASE_URL', 'http://43.110.141.102:3000');
    expect(defaultSecureCookie()).toBe(false);

    vi.stubEnv('APP_BASE_URL', 'https://qe.example.com');
    expect(defaultSecureCookie()).toBe(true);
  });
});
