import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDrawingReliabilityLaunchEndpoint,
  hashLaunchCode,
} from '@/platform/sso/launch-code';

describe('drawing reliability launch-code configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('stores a deterministic digest rather than the opaque code itself', () => {
    const digest = hashLaunchCode('one-time-code');

    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).toBe(hashLaunchCode('one-time-code'));
    expect(digest).not.toContain('one-time-code');
  });

  it('builds a fixed external POST endpoint from deployment configuration', () => {
    vi.stubEnv('SQM_DRAWING_RELIABILITY_URL', 'https://drawing.example.test');

    expect(getDrawingReliabilityLaunchEndpoint()).toBe(
      'https://drawing.example.test/api/auth/sso/launch',
    );
  });

  it('allows HTTP target configuration in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SQM_DRAWING_RELIABILITY_URL', 'http://drawing.example.test');

    expect(getDrawingReliabilityLaunchEndpoint()).toBe(
      'http://drawing.example.test/api/auth/sso/launch',
    );
  });
});
