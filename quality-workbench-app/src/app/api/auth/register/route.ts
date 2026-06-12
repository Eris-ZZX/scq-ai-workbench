// POST /api/auth/register — 用户注册 (F2.S2)
import { NextResponse } from 'next/server';
import { createUser, findByUsername } from '@/lib/db/auth';
import { Prisma } from '@/generated/prisma/client';

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json({ error: '用户名和密码为必填项' }, { status: 400 });
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    return NextResponse.json({ error: '密码长度应为 6-128 位' }, { status: 400 });
  }
  if (!username || username.length < 1 || username.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(username)) {
    return NextResponse.json({ error: '用户名须为 1-50 位字母、数字、下划线或连字符' }, { status: 400 });
  }
  const existing = await findByUsername(username);
  if (existing) {
    return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
  }

  // 🔧 HI-1: 并发注册时的唯一约束冲突返回 409 而非 500
  try {
    const user = await createUser({ username, password });
    return NextResponse.json(
      { id: user.id, username: user.username },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
    }
    console.error('[register]', e);
    return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
  }
}
