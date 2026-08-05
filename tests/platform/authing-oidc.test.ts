import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import {
  authingRedirectUri,
  buildAuthingAuthorizationUrl,
  pkceChallenge,
  safeAuthingReturnPath,
  verifyAuthingIdToken,
} from '@/platform/auth/authing.oidc';
import { mapAuthingClaims } from '@/platform/auth/authing.claims';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe('Authing OIDC adapter', () => {
  it('builds S256 authorization parameters and rejects unsafe return paths', () => {
    const url = new URL(buildAuthingAuthorizationUrl({
      authorizationEndpoint: 'https://auth.example.test/oidc/auth',
      clientId: 'client',
      redirectUri: 'https://app.example.test/api/auth/authing/callback',
      state: 'state',
      nonce: 'nonce',
      codeChallenge: pkceChallenge('verifier'),
    }));

    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toContain('openid');
    expect(safeAuthingReturnPath('/portal?tab=users')).toBe('/portal?tab=users');
    expect(safeAuthingReturnPath('//evil.example')).toBe('/portal');
    expect(safeAuthingReturnPath('/api/auth/authing')).toBe('/portal');
  });

  it('uses the public app base URL for the registered callback', () => {
    const previous = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = 'https://qe.example.test/';
    try {
      expect(authingRedirectUri('http://internal:3000/login'))
        .toBe('https://qe.example.test/api/auth/authing/callback');
    } finally {
      if (previous === undefined) delete process.env.APP_BASE_URL;
      else process.env.APP_BASE_URL = previous;
    }
  });

  it('verifies the company HS256 Authing token and nonce', async () => {
    const config = {
      issuer: 'https://auth.example.test',
      clientId: 'client',
      clientSecret: 'secret',
    };
    const token = await new SignJWT({
      sub: 'auth-sub',
      username: 'E001',
      nonce: 'nonce',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(config.issuer)
      .setAudience(config.clientId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(config.clientSecret));

    const payload = await verifyAuthingIdToken({
      idToken: token,
      config,
      jwksUri: 'https://unused.example.test/jwks',
      nonce: 'nonce',
    });
    expect(payload.sub).toBe('auth-sub');
    expect(() => mapAuthingClaims(config.issuer, payload)).not.toThrow();
    await expect(verifyAuthingIdToken({
      idToken: token,
      config,
      jwksUri: 'https://unused.example.test/jwks',
      nonce: 'wrong',
    })).rejects.toThrow('nonce');
  });

  it('verifies an RS256 token through the discovered JWKS', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key';
    const server = createServer((request, response) => {
      if (request.url === '/jwks') {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ keys: [jwk] }));
        return;
      }
      response.statusCode = 404;
      response.end();
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server did not start');

    const config = {
      issuer: 'https://auth.example.test',
      clientId: 'client',
      clientSecret: 'unused',
    };
    const token = await new SignJWT({
      sub: 'auth-sub-rs',
      username: 'E002',
      nonce: 'nonce-rs',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(config.issuer)
      .setAudience(config.clientId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    const payload = await verifyAuthingIdToken({
      idToken: token,
      config,
      jwksUri: `http://127.0.0.1:${address.port}/jwks`,
      nonce: 'nonce-rs',
    });
    expect(payload.sub).toBe('auth-sub-rs');
  });

  it('requires a stable username claim', () => {
    expect(() => mapAuthingClaims('https://auth.example.test', { sub: 'sub' })).toThrow('username');
    expect(mapAuthingClaims('https://auth.example.test', {
      sub: 'sub',
      preferred_username: 'E003',
      email: 'e003@example.test',
    })).toMatchObject({
      subject: 'sub',
      username: 'E003',
      email: 'e003@example.test',
    });
  });
});
