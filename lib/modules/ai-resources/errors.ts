import { databaseErrorStatus } from '@/lib/database';

export class AiResourceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'AiResourceError';
  }
}

export function aiResourceErrorResponse(error: unknown) {
  if (error instanceof AiResourceError) {
    return Response.json(
      { error: error.message, code: error.code ?? undefined },
      { status: error.status },
    );
  }
  const databaseStatus = databaseErrorStatus(error);
  if (databaseStatus) {
    return Response.json(
      {
        error:
          databaseStatus === 409
            ? '数据已存在或发生冲突。'
            : databaseStatus === 404
              ? '数据不存在。'
              : '数据不符合约束。',
      },
      { status: databaseStatus },
    );
  }
  console.error('[ai-resources]', error);
  return Response.json({ error: 'Internal Server Error' }, { status: 500 });
}
