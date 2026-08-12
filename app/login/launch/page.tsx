'use client';

import { useEffect, useRef, useState } from 'react';
import { resolveReturnPath } from '@/platform/auth/return-path';
import {
  buildDingTalkBrowserUrl,
  hasBrowserHandoff,
  isDingTalkDesktopUserAgent,
  markBrowserHandoff,
} from '@/platform/auth/dingtalk-browser';

function buildAuthEntryUrl(next: string) {
  const url = new URL('/api/auth/entry', window.location.origin);
  url.searchParams.set('next', next);
  return url.toString();
}

export default function LoginLaunchPage() {
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('正在准备登录...');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const next = resolveReturnPath(params.get('next'));
    const authEntryUrl = buildAuthEntryUrl(next);

    if (
      hasBrowserHandoff(window.location.href) ||
      !isDingTalkDesktopUserAgent(window.navigator.userAgent)
    ) {
      window.location.replace(authEntryUrl);
      return;
    }

    const launchUrl = new URL(window.location.href);
    const browserUrl = buildDingTalkBrowserUrl(markBrowserHandoff(launchUrl));
    setFallbackUrl(browserUrl);
    setMessage('正在打开外部浏览器...');
    window.location.replace(browserUrl);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ws-content-bg px-4">
      <section className="w-full max-w-sm rounded-lg border border-border bg-white p-8 text-center shadow-md">
        <div
          className="mx-auto mb-5 h-9 w-9 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
          aria-hidden="true"
        />
        <h1 className="text-xl font-semibold text-foreground">正在登录</h1>
        <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
          {message}
        </p>
        {fallbackUrl && (
          <a
            href={fallbackUrl}
            className="mt-6 inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            浏览器未自动打开，点击重试
          </a>
        )}
      </section>
    </main>
  );
}
