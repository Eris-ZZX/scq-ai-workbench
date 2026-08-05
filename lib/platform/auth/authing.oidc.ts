import { createHash, randomBytes } from 'node:crypto';
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  type JWTPayload,
} from 'jose';
import { assertAuthingConfiguration } from './authing.config';
import { sanitizeReturnPath } from './return-path';

export const AUTHING_SCOPES = 'openid profile email username';

export type AuthingDiscovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

export type AuthingConfig = ReturnType<typeof assertAuthingConfiguration>;

export function randomToken() {
  return randomBytes(32).toString('base64url');
}

export function pkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function buildAuthingAuthorizationUrl(input: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}) {
  const url = new URL(input.authorizationEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('scope', AUTHING_SCOPES);
  url.searchParams.set('state', input.state);
  url.searchParams.set('nonce', input.nonce);
  url.searchParams.set('code_challenge', input.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export function safeAuthingReturnPath(raw: string | null | undefined) {
  return sanitizeReturnPath(raw) ?? '/portal';
}

export function authingRedirectUri(requestUrl: string) {
  const baseUrl = process.env.APP_BASE_URL?.trim();
  return new URL(
    '/api/auth/authing/callback',
    baseUrl ? `${baseUrl.replace(/\/+$/, '')}/` : requestUrl,
  ).toString();
}

let discoveryCache: {
  issuer: string;
  value: AuthingDiscovery;
  fetchedAt: number;
} | null = null;

const DISCOVERY_TTL_MS = 10 * 60_000;

export async function discoverAuthing(issuer: string): Promise<AuthingDiscovery> {
  if (
    discoveryCache &&
    discoveryCache.issuer === issuer &&
    Date.now() - discoveryCache.fetchedAt < DISCOVERY_TTL_MS
  ) {
    return discoveryCache.value;
  }

  const response = await fetch(`${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Authing 服务发现失败：HTTP ${response.status}`);
  }

  const value = (await response.json()) as Partial<AuthingDiscovery>;
  if (
    typeof value.authorization_endpoint !== 'string' ||
    typeof value.token_endpoint !== 'string' ||
    typeof value.jwks_uri !== 'string'
  ) {
    throw new Error('Authing 服务发现响应缺少必要端点');
  }

  const result = {
    authorization_endpoint: value.authorization_endpoint,
    token_endpoint: value.token_endpoint,
    jwks_uri: value.jwks_uri,
  };
  discoveryCache = { issuer, value: result, fetchedAt: Date.now() };
  return result;
}

export async function exchangeAuthingCode(input: {
  config: AuthingConfig;
  tokenEndpoint: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  const response = await fetch(input.tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: input.config.clientId,
      client_secret: input.config.clientSecret,
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Authing 换取 token 失败：HTTP ${response.status} ${(await response.text()).slice(0, 200)}`,
    );
  }

  const body = (await response.json()) as { id_token?: unknown };
  if (typeof body.id_token !== 'string' || !body.id_token) {
    throw new Error('Authing 响应缺少 id_token');
  }
  return body.id_token;
}

let jwksCache: {
  uri: string;
  keySet: ReturnType<typeof createRemoteJWKSet>;
} | null = null;

export async function verifyAuthingIdToken(input: {
  idToken: string;
  config: AuthingConfig;
  jwksUri: string;
  nonce: string;
}): Promise<JWTPayload> {
  const { alg } = decodeProtectedHeader(input.idToken);
  if (!alg) throw new Error('Authing id_token 缺少签名算法');

  const verifyOptions = {
    issuer: input.config.issuer,
    audience: input.config.clientId,
  };

  let payload: JWTPayload;
  if (alg.startsWith('HS')) {
    ({ payload } = await jwtVerify(
      input.idToken,
      new TextEncoder().encode(input.config.clientSecret),
      { ...verifyOptions, algorithms: [alg as 'HS256' | 'HS384' | 'HS512'] },
    ));
  } else {
    if (!jwksCache || jwksCache.uri !== input.jwksUri) {
      jwksCache = {
        uri: input.jwksUri,
        keySet: createRemoteJWKSet(new URL(input.jwksUri)),
      };
    }
    ({ payload } = await jwtVerify(input.idToken, jwksCache.keySet, verifyOptions));
  }

  if (payload.nonce !== input.nonce) {
    throw new Error('Authing id_token nonce 不匹配');
  }
  return payload;
}

export function authingConfig() {
  return assertAuthingConfiguration();
}
