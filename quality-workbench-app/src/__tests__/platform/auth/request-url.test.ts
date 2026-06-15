import { describe, expect, it } from 'vitest';
import { getRequestUrl } from '@/platform/auth/request-url';

describe('auth request url helpers', () => {
  it('uses the browser Host header when the framework request url is normalized', () => {
    const request = new Request('http://localhost:3000/api/auth/login', {
      headers: { host: '172.17.137.235:3000' },
    });

    expect(getRequestUrl(request, '/workbench').toString()).toBe('http://172.17.137.235:3000/workbench');
  });

  it('prefers forwarded host and protocol behind a proxy', () => {
    const request = new Request('http://localhost:3000/api/auth/login', {
      headers: {
        'x-forwarded-host': 'qe.example.test',
        'x-forwarded-proto': 'https',
      },
    });

    expect(getRequestUrl(request, '/login').toString()).toBe('https://qe.example.test/login');
  });
});
