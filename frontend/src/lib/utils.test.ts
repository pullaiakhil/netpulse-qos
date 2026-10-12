import { describe, it, expect } from 'vitest';
import { formatSessionId, getTargetProtocol, formatMs, formatPct, formatNumber } from './utils';

describe('formatSessionId', () => {
  it('formats numeric session IDs with a hash prefix', () => {
    expect(formatSessionId(1)).toBe('#1');
    expect(formatSessionId(128)).toBe('#128');
    expect(formatSessionId(0)).toBe('#0');
  });

  it('formats numeric strings with a hash prefix', () => {
    expect(formatSessionId('42')).toBe('#42');
    expect(formatSessionId('9999')).toBe('#9999');
  });

  it('formats UUID strings safely by truncating to 8 characters with ellipsis', () => {
    expect(formatSessionId('e0f17770-2de1-49e8-8cea-c29dc1d123f6')).toBe('e0f17770...');
    expect(formatSessionId('abcdef123456')).toBe('abcdef12...');
  });

  it('returns short non-numeric strings as-is', () => {
    expect(formatSessionId('sess-1')).toBe('sess-1');
  });

  it('handles null, undefined, and empty string without throwing', () => {
    expect(formatSessionId(null)).toBe('Unknown');
    expect(formatSessionId(undefined)).toBe('Unknown');
    expect(formatSessionId('')).toBe('Unknown');
  });
});

describe('getTargetProtocol', () => {
  it('extracts target_type safely', () => {
    expect(getTargetProtocol({ target_type: 'tcp' })).toBe('TCP');
    expect(getTargetProtocol({ type: 'icmp' })).toBe('ICMP');
  });

  it('handles undefined and null target safely', () => {
    expect(getTargetProtocol(undefined)).toBe('ICMP');
    expect(getTargetProtocol(null)).toBe('ICMP');
    expect(getTargetProtocol({})).toBe('ICMP');
  });
});

describe('formatNumber and formatMs', () => {
  it('handles null and undefined metrics safely', () => {
    expect(formatMs(null)).toBe('—');
    expect(formatMs(undefined)).toBe('—');
    expect(formatNumber(null)).toBe('—');
    expect(formatPct(null)).toBe('—');
  });

  it('formats valid numbers properly', () => {
    expect(formatMs(12.34)).toBe('12.3 ms');
    expect(formatNumber(12.34, 2)).toBe('12.34');
    expect(formatPct(5.5)).toBe('5.5%');
  });
});
