import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decryptExternalAppSecret,
  encryptExternalAppSecret,
  validateExternalAppProbeUrl,
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

  it('allows HTTP target URLs in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(validateExternalAppLaunchUrl('http://drawing.example.test'))
      .toBe('http://drawing.example.test/');
  });

  it('allows HTTP and private targets for production probes', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(validateExternalAppProbeUrl('http://127.0.0.1:8001'))
      .toBe('http://127.0.0.1:8001/');
    expect(validateExternalAppProbeUrl('http://drawing.example.test'))
      .toBe('http://drawing.example.test/');
  });
});
