import { getTargetProtocol, formatMs, formatPct, formatDuration } from '../lib/utils';
import { Target } from '../lib/types';

/**
 * Regression test suite for Target protocol property resolution.
 * Verifies that missing 'type', undefined values, legacy 'target_type' fields,
 * and malformed target models do not cause TypeError: Cannot read properties of undefined (reading 'toUpperCase').
 */

describe('getTargetProtocol & Target Resolution Regression Tests', () => {
  test('correctly capitalizes standard "type" field', () => {
    const target: Partial<Target> = {
      id: '1',
      name: 'Cloudflare DNS',
      host: '1.1.1.1',
      type: 'icmp',
    };
    expect(getTargetProtocol(target as any)).toBe('ICMP');
  });

  test('correctly resolves TCP protocol', () => {
    const target: Partial<Target> = {
      id: '2',
      name: 'Web Server',
      host: 'example.com',
      type: 'tcp',
    };
    expect(getTargetProtocol(target as any)).toBe('TCP');
  });

  test('falls back to "target_type" when "type" is undefined (backend schema mismatch)', () => {
    // This replicates the exact backend response contract where Pydantic serializes `target_type`
    const backendTarget = {
      id: 1,
      name: 'Google DNS',
      host: '8.8.8.8',
      target_type: 'icmp',
      port: null,
      enabled: true,
    };
    expect(getTargetProtocol(backendTarget as any)).toBe('ICMP');
  });

  test('safely handles target where BOTH type and target_type are undefined without throwing', () => {
    const brokenTarget = {
      id: '3',
      name: 'Corrupted Target',
      host: '10.0.0.1',
    };
    // Should safely default to ICMP instead of throwing Uncaught TypeError
    expect(() => getTargetProtocol(brokenTarget as any)).not.toThrow();
    expect(getTargetProtocol(brokenTarget as any)).toBe('ICMP');
  });

  test('safely handles null target object without throwing', () => {
    expect(() => getTargetProtocol(null)).not.toThrow();
    expect(getTargetProtocol(null)).toBe('ICMP');
  });

  test('safely handles undefined target object without throwing', () => {
    expect(() => getTargetProtocol(undefined)).not.toThrow();
    expect(getTargetProtocol(undefined)).toBe('ICMP');
  });
});
