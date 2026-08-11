import { NextResponse } from 'next/server';
import { recordAuthLoginEvent } from '@/platform/auth/login-audit';

/** Legacy callback retained only to return an explicit migration response. */
export async function GET(request: Request) {
  await recordAuthLoginEvent({
    request,
    provider: 'dingtalk',
    stage: 'callback',
    outcome: 'failure',
    errorCode: 'authing_config',
    errorMessage: '钉钉登录回调已停用，请使用 Authing 登录',
  });
  return NextResponse.redirect(
    new URL('/login?error=authing_config', request.url),
    { status: 303 },
  );
}
