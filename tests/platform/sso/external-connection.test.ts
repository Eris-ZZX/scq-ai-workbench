import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decryptExternalAppSecret,
  encryptExternalAppSecret,
  validateExternalAppLaunchUrl,
} from '@/platform/sso/external-connection';

describe('platform external connection configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('encrypts and decrypts secrets without storing plaintext', () => {
    vi.stubEnv('JWT_SECRET', 'test-jwt-secret');

    const encrypted = encryptExternalAppSecret('shared-exchange-secret');

    expect(encrypted).not.toContain('shared-exchange-secret');
    expect(decryptExternalAppSecret(encrypted)).toBe('shared-exchange-secret');
  });

  it('rejects credentials and query parameters in target URLs', () => {
    expect(() => validateExternalAppLaunchUrl(
      'https://user:pass@example.test/path?token=bad',
    )).toThrow();
  });

  it('requires HTTPS for production target URLs', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(() => validateExternalAppLaunchUrl('http://drawing.example.test'))
      .toThrow('https');
  });
});
