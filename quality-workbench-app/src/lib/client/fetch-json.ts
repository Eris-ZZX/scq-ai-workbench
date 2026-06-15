const DEFAULT_TIMEOUT_MS = 15_000;

type ApiErrorBody = {
  error?: unknown;
};

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: init?.signal ?? controller.signal,
    });
    const body = await response.json().catch(() => null) as ApiErrorBody | T | null;

    if (!response.ok) {
      const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `请求失败 (${response.status})`;
      throw new Error(message);
    }

    return body as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('请求超时，请刷新后重试');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
