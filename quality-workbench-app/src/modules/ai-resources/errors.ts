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
  console.error('[ai-resources]', error);
  return Response.json({ error: 'Internal Server Error' }, { status: 500 });
}
