import { Client as MinioClient } from 'minio';
import { jwtVerify } from 'jose';
import pg from 'pg';

const { Client: PgClient } = pg;

const results = [];
const cleanup = {
  projectId: null,
  projectName: null,
  resourceId: null,
  reviewId: null,
  storedNames: new Set(),
};

let sessionCookie = '';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pass(name, detail = '') {
  results.push({ name, detail });
  console.log(`[smoke] PASS ${name}${detail ? ` - ${detail}` : ''}`);
}

function safeBody(value) {
  return value.replace(/[\r\n]+/g, ' ').slice(0, 500);
}

async function request(path, options = {}) {
  const {
    expected = 200,
    authenticated = true,
    timeoutMs = 30_000,
    ...fetchOptions
  } = options;
  const headers = new Headers(fetchOptions.headers);
  if (authenticated && sessionCookie) headers.set('cookie', sessionCookie);

  const response = await fetch(new URL(path, required('SMOKE_BASE_URL')), {
    ...fetchOptions,
    headers,
    redirect: fetchOptions.redirect ?? 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(response.status)) {
    const body = safeBody(await response.clone().text());
    throw new Error(`${fetchOptions.method ?? 'GET'} ${path}: expected ${allowed.join('/')} but received ${response.status}: ${body}`);
  }
  return response;
}

async function json(response) {
  const value = await response.json();
  assert(value && typeof value === 'object', 'Expected a JSON object response');
  return value;
}

function cookieHeaders(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  const value = response.headers.get('set-cookie');
  return value ? [value] : [];
}

async function testPublicAndAuth() {
  await request('/login', { authenticated: false });
  pass('login page');

  const page = await request('/portal', {
    authenticated: false,
    expected: [302, 303, 307, 308],
  });
  const pageLocation = new URL(page.headers.get('location'), required('SMOKE_BASE_URL'));
  assert(pageLocation.pathname === '/login', 'Unauthenticated page did not redirect to /login');
  pass('page auth redirect');

  await request('/api/auth/me', { authenticated: false, expected: 401 });
  pass('API auth rejection');

  await request('/api/auth/login', {
    authenticated: false,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: `wrong-${Date.now()}` }),
    expected: 401,
  });
  pass('wrong password rejection');

  const login = await request('/api/auth/login', {
    authenticated: false,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: process.env.SMOKE_ADMIN_PASSWORD?.trim() || required('ADMIN_INITIAL_PASSWORD'),
    }),
  });
  const loginBody = await json(login.clone());
  assert(loginBody.username === 'admin' && loginBody.role === 'admin', 'Admin login response is incompatible');

  const setCookies = cookieHeaders(login);
  const sessionHeader = setCookies.find((value) => value.startsWith('qe-session='));
  assert(sessionHeader, 'Login did not set the qe-session cookie');
  sessionCookie = sessionHeader.split(';', 1)[0];
  if (new URL(required('SMOKE_BASE_URL')).protocol === 'http:') {
    assert(!/;\s*Secure(?:;|$)/i.test(sessionHeader), 'HTTP deployment emitted an unusable Secure session cookie');
  }
  assert(/;\s*HttpOnly(?:;|$)/i.test(sessionHeader), 'Session cookie is missing HttpOnly');
  assert(/;\s*SameSite=Lax(?:;|$)/i.test(sessionHeader), 'Session cookie is missing SameSite=Lax');
  pass('local admin login and cookie contract');

  const token = sessionCookie.slice('qe-session='.length);
  const verified = await jwtVerify(
    token,
    new TextEncoder().encode(required('JWT_SECRET')),
  );
  assert(verified.payload.sub === loginBody.id, 'Session JWT subject is incompatible');
  assert(typeof verified.payload.authAt === 'number', 'Session JWT is missing millisecond authAt');
  pass('session JWT signature and payload');

  const diagnosticClient = new PgClient({
    connectionString: required('DATABASE_URL'),
    connectionTimeoutMillis: 10_000,
  });
  await diagnosticClient.connect();
  const diagnostic = await diagnosticClient.query(
    'SELECT status, updated_at FROM users WHERE id = $1',
    [loginBody.id],
  );
  await diagnosticClient.end();
  const databaseUser = diagnostic.rows[0];
  assert(databaseUser?.status === 'active', 'Admin became inactive after login');
  const updatedAt = new Date(databaseUser.updated_at).getTime();
  assert(verified.payload.authAt >= updatedAt, `Session authAt predates user.updatedAt by ${updatedAt - verified.payload.authAt}ms`);
  pass('session revocation timestamp contract');

  const authenticatedPage = await request('/portal', { expected: [200, 302, 303, 307, 308] });
  assert(authenticatedPage.status === 200, 'Authenticated page request did not carry the session cookie');
  pass('session cookie reaches protected proxy');

  const meResponse = await request('/api/auth/me', { expected: [200, 401] });
  if (meResponse.status !== 200) {
    const reachedRoute = Boolean(meResponse.headers.get('x-user-id'));
    throw new Error(`Authenticated profile rejected the valid session (proxyPass=${reachedRoute})`);
  }
  const me = await json(meResponse);
  assert(me.id === loginBody.id && me.username === 'admin' && me.status === 'active', 'Authenticated profile is incompatible');
  pass('authenticated profile');
  return me;
}

async function testDingTalk() {
  const entry = await request('/api/auth/dingtalk?next=%2Fportal', {
    authenticated: false,
    expected: [302, 303, 307, 308],
  });
  const location = new URL(entry.headers.get('location'));
  assert(location.protocol === 'https:' && location.hostname === 'login.dingtalk.com', 'DingTalk entry did not redirect to the official login host');
  assert(location.pathname === '/oauth2/auth', 'DingTalk OAuth path is incompatible');
  assert(location.searchParams.get('response_type') === 'code', 'DingTalk response_type is incompatible');
  assert(location.searchParams.get('scope') === 'openid', 'DingTalk scope is incompatible');
  const redirectUri = new URL(required('DINGTALK_REDIRECT_URI'));
  const publicBase = new URL(required('APP_BASE_URL'));
  assert(location.searchParams.get('redirect_uri') === redirectUri.href, 'DingTalk redirect URI does not match deployment configuration');
  assert(redirectUri.origin === publicBase.origin, 'DingTalk redirect URI and APP_BASE_URL must use the same public origin');
  assert(redirectUri.pathname === '/api/auth/dingtalk/callback', 'DingTalk redirect URI path is incompatible');
  assert((location.searchParams.get('state') ?? '').length === 64, 'DingTalk OAuth state is missing or malformed');
  const cookies = cookieHeaders(entry).join(';');
  assert(cookies.includes('dingtalk_oauth_state='), 'DingTalk state cookie is missing');
  assert(cookies.includes('auth_return_to='), 'DingTalk return-path cookie is missing');
  pass('DingTalk OAuth entry and state contract');

  const agentId = Number(required('DINGTALK_AGENT_ID'));
  assert(Number.isSafeInteger(agentId) && agentId > 0, 'DingTalk agent ID is invalid');

  const tokenUrl = new URL('https://oapi.dingtalk.com/gettoken');
  tokenUrl.searchParams.set('appkey', required('DINGTALK_CLIENT_ID'));
  tokenUrl.searchParams.set('appsecret', required('DINGTALK_CLIENT_SECRET'));
  const response = await fetch(tokenUrl, { signal: AbortSignal.timeout(30_000) });
  const tokenResult = await response.json().catch(() => null);
  assert(response.ok, `DingTalk credential endpoint returned HTTP ${response.status}`);
  assert(tokenResult?.errcode === 0 && typeof tokenResult.access_token === 'string', `DingTalk credentials were rejected (errcode ${tokenResult?.errcode ?? 'unknown'})`);
  pass('DingTalk enterprise credentials');
}

async function testProjectFlow() {
  const name = `IT smoke ${new Date().toISOString()}`;
  cleanup.projectName = name;
  const created = await json(await request('/api/npq/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, description: 'Automated deployment smoke test' }),
    expected: 201,
    timeoutMs: 60_000,
  }));
  assert(typeof created.id === 'string' && created.name === name, 'Project create response is incompatible');
  cleanup.projectId = created.id;
  pass('project creation and template snapshot');

  const listing = await json(await request('/api/npq/projects?page=1&pageSize=100'));
  assert(Array.isArray(listing.items) && listing.items.some((item) => item.id === created.id), 'Created project is missing from list');
  pass('project listing');

  const detail = await json(await request(`/api/npq/projects/${encodeURIComponent(created.id)}`));
  assert(detail.id === created.id && Array.isArray(detail.members), 'Project detail response is incompatible');
  pass('project detail and membership');

  const activities = await json(await request(`/api/npq/projects/${encodeURIComponent(created.id)}/activities`, { timeoutMs: 60_000 }));
  assert(activities.project?.id === created.id, 'Project activities response references the wrong project');
  assert(Array.isArray(activities.parents) && activities.parents.length > 0, 'Built-in NPQ activities were not instantiated');
  assert(Array.isArray(activities.stageGates), 'Stage gate response is incompatible');
  pass('project activities and stage gates', `${activities.parents.length} parent activities`);

  const workbench = await json(await request(`/api/npq/workbench?projectId=${encodeURIComponent(created.id)}`, { timeoutMs: 60_000 }));
  assert(workbench && typeof workbench === 'object', 'Workbench response is incompatible');
  pass('project workbench aggregation');

  await request(`/api/npq/projects/${encodeURIComponent(created.id)}`, {
    method: 'DELETE',
  });
  cleanup.projectId = null;
  cleanup.projectName = null;
  pass('project cleanup through API');
}

async function upload(name, content, type, purpose) {
  const form = new FormData();
  form.append('files', new File([content], name, { type }));
  if (purpose) form.append('purpose', purpose);
  const payload = await json(await request('/api/ai-resources/uploads', {
    method: 'POST',
    body: form,
    timeoutMs: 60_000,
  }));
  const attachment = payload.attachments?.[0];
  assert(attachment && typeof attachment.storedName === 'string', 'Upload response is incompatible');
  cleanup.storedNames.add(attachment.storedName);
  return attachment;
}

async function testAiAndMinio(me) {
  const status = await json(await request('/api/ai-resources/status'));
  assert(status.enabled === true && status.actor?.isEffectiveAdmin === true, 'AI resource admin bootstrap is missing');
  pass('AI resource membership bootstrap');

  const initialList = await json(await request('/api/ai-resources/resources'));
  assert(Array.isArray(initialList.resources), 'AI resource list response is incompatible');
  pass('AI resource listing');

  const textContent = `minio-smoke-${Date.now()}`;
  const attachment = await upload('smoke.txt', textContent, 'text/plain');
  assert(attachment.url === `/api/ai-resources/files/${attachment.storedName}`, 'Upload URL contract changed');
  const downloaded = await request(`${attachment.url}?name=smoke.txt`);
  assert(await downloaded.text() === textContent, 'Downloaded object differs from uploaded content');
  assert(downloaded.headers.get('content-disposition')?.startsWith('attachment;'), 'Download disposition is incompatible');
  pass('MinIO upload and streamed download');

  await request(`/api/ai-resources/files/${crypto.randomUUID()}.txt`, { expected: 404 });
  pass('missing MinIO object returns 404');

  const htmlContent = '<!doctype html><html><body><script>document.body.dataset.smoke="ok"</script>QE smoke</body></html>';
  const htmlAttachment = await upload('smoke.html', htmlContent, 'text/html', 'hosted-html');
  const resourceName = `IT hosted HTML smoke ${Date.now()}`;
  const draft = await json(await request('/api/ai-resources/resources/draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      reviewerId: me.id,
      updateSummary: 'Deployment smoke publication',
      resource: {
        name: resourceName,
        type: 'WEB_PAGE',
        summary: 'Automated hosted HTML deployment smoke test',
        tags: ['deployment-smoke'],
        ownerName: 'admin',
        visibilityScope: 'ALL',
        visibleDeptIds: [],
        visibleUserIds: [],
        status: 'PUBLISHED',
        resourceUrl: null,
        content: 'Automated hosted HTML deployment smoke test',
        attachments: null,
        extension: {
          hostedHtml: {
            storedName: htmlAttachment.storedName,
            originalName: htmlAttachment.name,
            size: htmlAttachment.size,
          },
        },
        extractedText: null,
      },
    }),
    expected: 201,
  }));
  cleanup.reviewId = draft.review?.id ?? null;
  assert(cleanup.reviewId, 'Draft response is missing review ID');

  const approved = await json(await request(`/api/ai-resources/review-requests/${encodeURIComponent(cleanup.reviewId)}/approve`, {
    method: 'POST',
  }));
  cleanup.resourceId = approved.resource?.id ?? null;
  assert(cleanup.resourceId, 'Approval response is missing resource ID');
  pass('AI resource draft and admin approval');

  const hosted = await request(`/api/ai-resources/resources/${encodeURIComponent(cleanup.resourceId)}/html`);
  assert((hosted.headers.get('content-type') ?? '').startsWith('text/html'), 'Hosted HTML content type is incompatible');
  assert((hosted.headers.get('content-security-policy') ?? '').startsWith('sandbox'), 'Hosted HTML is missing CSP sandbox');
  assert(await hosted.text() === htmlContent, 'Hosted HTML content differs from uploaded content');
  pass('hosted HTML MinIO stream and CSP sandbox');

  const search = await json(await request(`/api/ai-resources/resources?q=${encodeURIComponent(resourceName)}`));
  assert(search.resources.some((resource) => resource.id === cleanup.resourceId), 'Published resource is missing from search');
  pass('AI resource PostgreSQL search');

  await request(`/api/ai-resources/admin/resources/${encodeURIComponent(cleanup.resourceId)}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ confirmationName: resourceName }),
  });
  pass('AI resource archive');
}

async function testLogout() {
  await request('/api/auth/logout', { method: 'POST' });
  await request('/api/auth/me', { expected: 401 });
  pass('logout and session revocation');
}

async function cleanupDatabase() {
  if (!cleanup.projectId && !cleanup.projectName && !cleanup.resourceId && !cleanup.reviewId) return;
  const client = new PgClient({
    connectionString: required('DATABASE_URL'),
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    if (cleanup.projectId) {
      await client.query('DELETE FROM projects WHERE id = $1', [cleanup.projectId]);
    } else if (cleanup.projectName) {
      await client.query(
        'DELETE FROM projects WHERE name = $1 AND description = $2',
        [cleanup.projectName, 'Automated deployment smoke test'],
      );
    }
    if (cleanup.resourceId) {
      await client.query('DELETE FROM ai_resources WHERE id = $1', [cleanup.resourceId]);
    }
    if (cleanup.reviewId) {
      await client.query('DELETE FROM ai_resource_review_requests WHERE id = $1', [cleanup.reviewId]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function cleanupObjects() {
  if (!cleanup.storedNames.size) return;
  const useSSL = (process.env.MINIO_USE_SSL ?? 'false') === 'true';
  const client = new MinioClient({
    endPoint: required('MINIO_ENDPOINT'),
    port: Number(process.env.MINIO_PORT ?? (useSSL ? 443 : 9000)),
    useSSL,
    accessKey: required('MINIO_ACCESS_KEY'),
    secretKey: required('MINIO_SECRET_KEY'),
  });
  const bucket = required('MINIO_BUCKET');
  await Promise.all([...cleanup.storedNames].map((name) => (
    client.removeObject(bucket, `ai-resources/uploads/${name}`)
  )));
}

async function main() {
  const me = await testPublicAndAuth();
  await testDingTalk();
  await testProjectFlow();
  await testAiAndMinio(me);
  await testLogout();
  console.log(`[smoke] COMPLETE ${results.length} checks passed`);
}

let failure;
try {
  await main();
} catch (error) {
  failure = error;
  console.error(`[smoke] FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  const cleanupErrors = [];
  await cleanupDatabase().catch((error) => cleanupErrors.push(`database: ${error instanceof Error ? error.message : String(error)}`));
  await cleanupObjects().catch((error) => cleanupErrors.push(`object storage: ${error instanceof Error ? error.message : String(error)}`));
  if (cleanupErrors.length) {
    console.error(`[smoke] CLEANUP FAIL ${cleanupErrors.join('; ')}`);
    failure ??= new Error('Smoke cleanup failed');
  } else {
    console.log('[smoke] CLEANUP complete');
  }
}

if (failure) process.exitCode = 1;
