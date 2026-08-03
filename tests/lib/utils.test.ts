import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn() utility', () => {
  it('merges plain class names', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('filters out falsy values (false, undefined, null, empty string)', () => {
    expect(cn('base', false && 'hidden', undefined, null, '', 'extra')).toBe('base extra');
  });

  it('resolves Tailwind conflicts via twMerge (last wins)', () => {
    expect(cn('px-4 py-2', 'px-6')).toBe('py-2 px-6');
  });

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles object-style conditionals', () => {
    expect(cn('base', { hidden: true, visible: false })).toBe('base hidden');
  });

  it('handles numeric 0 as falsy', () => {
    expect(cn('base', 0 && 'hidden')).toBe('base');
  });
});
