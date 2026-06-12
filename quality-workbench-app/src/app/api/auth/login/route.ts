// POST /api/auth/login - user login (F2.S3)
import { NextResponse } from 'next/server';
import { findByUsername, verifyPassword } from '@/lib/db/auth';
import { createSession } from '@/platform/auth/auth.config';

const DUMMY_HASH = '$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

type LoginBody = {
  username?: string;
  password?: string;
};

function isFormRequest(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  return (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  );
}

async function readLoginBody(request: Request): Promise<{ body: LoginBody | null; formMode: boolean }> {
  const formMode = isFormRequest(request);
  if (formMode) {
    const form = await request.formData();
    const username = form.get('username');
    const password = form.get('password');
    return {
      formMode,
      body: {
        username: typeof username === 'string' ? username : undefined,
        password: typeof password === 'string' ? password : undefined,
      },
    };
  }

  try {
    return { formMode, body: await request.json() };
  } catch {
    return { formMode, body: null };
  }
}

function fail(formMode: boolean, request: Request, error: string, status: number) {
  if (formMode) {
    const url = new URL('/login', request.url);
    url.searchParams.set('error', '1');
    return NextResponse.redirect(url, { status: 303 });
  }
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const { body, formMode } = await readLoginBody(request);
  if (!body) {
    return fail(formMode, request, '无效的请求体', 400);
  }

  const { username, password } = body;
  if (!username || !password) {
    return fail(formMode, request, '用户名和密码为必填项', 400);
  }
  if (typeof password !== 'string' || password.length > 128) {
    return fail(formMode, request, '用户名或密码错误', 401);
  }

  const user = await findByUsername(username);
  const hashToVerify = user?.passwordHash ?? DUMMY_HASH;
  const valid = await verifyPassword(
    typeof password === 'string' ? password : '',
    hashToVerify,
  );

  if (!user || !valid || user.status !== 'active') {
    return fail(formMode, request, '用户名或密码错误', 401);
  }

  await createSession({
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
  });

  if (formMode) {
    return NextResponse.redirect(new URL('/workbench', request.url), { status: 303 });
  }

  return NextResponse.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  });
}
