import { NextResponse } from 'next/server';
import { recordAuthLoginEvent } from '@/platform/auth/login-audit';

/**
 * Legacy compatibility endpoint. DingTalk OAuth is intentionally disabled:
 * company policy no longer provides DingTalk application credentials.
 */
export async function GET(request: Request) {
  await recordAuthLoginEvent({
    request,
    provider: 'dingtalk',
    stage: 'initiation',
    outcome: 'failure',
    errorCode: 'authing_config',
    errorMessage: '钉钉登录入口已停用，请使用 Authing 登录',
  });
  const url = new URL('/login?error=authing_config', request.url);
  return NextResponse.redirect(url, { status: 303 });
}
