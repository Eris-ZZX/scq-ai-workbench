type RequestLike = {
  headers: Headers;
  url: string;
};

function firstHeaderValue(value: string | null) {
  return value?.split(',')[0]?.trim() || null;
}

export function getRequestOrigin(request: RequestLike) {
  const fallbackUrl = new URL(request.url);
  const host =
    firstHeaderValue(request.headers.get('x-forwarded-host')) ??
    firstHeaderValue(request.headers.get('host')) ??
    fallbackUrl.host;
  const proto =
    firstHeaderValue(request.headers.get('x-forwarded-proto')) ??
    fallbackUrl.protocol.replace(':', '') ??
    'http';

  return `${proto}://${host}`;
}

export function getRequestUrl(request: RequestLike, pathname: string) {
  return new URL(pathname, getRequestOrigin(request));
}
