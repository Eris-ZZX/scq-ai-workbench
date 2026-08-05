/**
 * Authing configuration that is safe to import from the Edge-compatible
 * middleware and server components. OIDC network and crypto helpers live in
 * authing.oidc.ts and must stay in Node-only route handlers.
 */
export function authingEnabled() {
  return Boolean(
    process.env.AUTHING_ISSUER?.trim() &&
      process.env.AUTHING_CLIENT_ID?.trim() &&
      process.env.AUTHING_CLIENT_SECRET?.trim(),
  );
}

export function authingRequired() {
  return process.env.NODE_ENV === 'production' || process.env.AUTHING_REQUIRED === 'true';
}

export function authingLoginAvailable() {
  return authingEnabled() || !authingRequired();
}

export function assertAuthingConfiguration() {
  const issuer = process.env.AUTHING_ISSUER?.trim();
  const clientId = process.env.AUTHING_CLIENT_ID?.trim();
  const clientSecret = process.env.AUTHING_CLIENT_SECRET?.trim();

  if (!issuer || !clientId || !clientSecret) {
    throw new Error(
      'Authing 配置不完整：AUTHING_ISSUER、AUTHING_CLIENT_ID、AUTHING_CLIENT_SECRET 必须同时存在',
    );
  }

  return { issuer, clientId, clientSecret };
}
