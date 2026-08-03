// platform/observability/middleware.ts — API 自动记录中间件 (F6.S2)
import { NextResponse } from 'next/server';
import { getTracer } from './tracer';
import { logEvent } from './logger';

/** 包裹 API handler，自动记录请求开始/结束 */
export function withObservability(handler: (req: Request) => Promise<Response>) {
  return async function (request: Request) {
    const traceId = request.headers.get('x-trace-id') ?? getTracer().start();
    const start = Date.now();
    const { pathname } = new URL(request.url);

    let response: Response;
    try {
      response = await handler(request);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      logEvent({ traceId, eventType: 'error', path: pathname, method: request.method, errorMessage: err.message, errorStack: err.stack });
      response = NextResponse.json({ error: '服务器错误' }, { status: 500 });
    }

    const durationMs = Date.now() - start;
    logEvent({ traceId, eventType: 'request', path: pathname, method: request.method, statusCode: response.status, durationMs });

    // 将 traceId 写回响应头
    response.headers.set('x-trace-id', traceId);
    return response;
  };
}
