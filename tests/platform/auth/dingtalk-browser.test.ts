import { describe, expect, it } from 'vitest';
import { resolveReturnPath } from '@/platform/auth/return-path';
import {
  buildDingTalkBrowserUrl,
  hasBrowserHandoff,
  isDingTalkDesktopUserAgent,
  markBrowserHandoff,
} from '@/platform/auth/dingtalk-browser';

describe('DingTalk browser handoff helpers', () => {
  it('recognizes desktop DingTalk without treating mobile clients as desktop', () => {
    expect(isDingTalkDesktopUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DingTalk/7.6.0',
    )).toBe(true);
    expect(isDingTalkDesktopUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Mobile) DingTalk/7.6.0',
    )).toBe(false);
    expect(isDingTalkDesktopUserAgent('Mozilla/5.0 Chrome/140.0.0.0')).toBe(false);
    expect(isDingTalkDesktopUserAgent(null)).toBe(false);
  });

  it('encodes the launch target inside the DingTalk browser protocol', () => {
    const target = 'https://qe.example.test/login/launch?browser=1&next=%2Fportal';
    const url = new URL(buildDingTalkBrowserUrl(target));

    expect(url.protocol).toBe('dingtalk:');
    expect(url.hostname).toBe('dingtalkclient');
    expect(url.pathname).toBe('/page/link');
    expect(url.searchParams.get('pc_slide')).toBe('false');
    expect(url.searchParams.get('url')).toBe(target);
  });

  it('adds and detects a one-time browser handoff marker without mutating the source URL', () => {
    const source = new URL('https://qe.example.test/login/launch?next=%2Fportal');
    const marked = markBrowserHandoff(source);

    expect(source.searchParams.has('browser')).toBe(false);
    expect(hasBrowserHandoff(source)).toBe(false);
    expect(hasBrowserHandoff(marked)).toBe(true);
    expect(new URL(marked).searchParams.get('next')).toBe('/portal');
  });

  it('keeps return paths same-origin and falls back to the portal', () => {
    expect(resolveReturnPath('/portal?tab=mine')).toBe('/portal?tab=mine');
    expect(resolveReturnPath('https://evil.example')).toBe('/portal');
    expect(resolveReturnPath('//evil.example')).toBe('/portal');
    expect(resolveReturnPath('/api/auth/entry')).toBe('/portal');
  });
});
