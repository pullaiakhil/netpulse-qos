import { formatMs, formatPct, formatKbps, formatBytes, formatDuration, formatNumber } from '../lib/utils';

/**
 * Regression test suite for Reports statistics and numeric formatting.
 * Verifies that null, undefined, NaN, and zero measurements:
 * 1. Do not cause TypeError: Cannot read properties of null (reading 'toFixed').
 * 2. Return appropriate academic and semantic indicators ('—', '0.0%', etc.) rather than fabricating fake data.
 */

describe('Reports & Metric Number Formatting Regression Tests', () => {
  describe('formatNumber', () => {
    test('formats valid positive floating number', () => {
      expect(formatNumber(12.345, 1)).toBe('12.3');
      expect(formatNumber(12.345, 2)).toBe('12.35');
    });

    test('formats zero correctly', () => {
      expect(formatNumber(0, 1)).toBe('0.0');
      expect(formatNumber(0, 2)).toBe('0.00');
    });

    test('safely handles null value without throwing', () => {
      expect(() => formatNumber(null)).not.toThrow();
      expect(formatNumber(null)).toBe('—');
      expect(formatNumber(null, 1, 'N/A')).toBe('N/A');
    });

    test('safely handles undefined value without throwing', () => {
      expect(() => formatNumber(undefined)).not.toThrow();
      expect(formatNumber(undefined)).toBe('—');
    });

    test('safely handles NaN without throwing', () => {
      expect(() => formatNumber(NaN)).not.toThrow();
      expect(formatNumber(NaN)).toBe('—');
    });
  });

  describe('formatMs', () => {
    test('formats valid latency value with units', () => {
      expect(formatMs(45.26)).toBe('45.3 ms');
      expect(formatMs(0)).toBe('0.0 ms');
    });

    test('safely returns placeholder for null/undefined/NaN without crashing', () => {
      expect(formatMs(null)).toBe('—');
      expect(formatMs(undefined)).toBe('—');
      expect(formatMs(NaN)).toBe('—');
    });
  });

  describe('formatPct', () => {
    test('formats valid loss percentages', () => {
      expect(formatPct(0)).toBe('0.0%');
      expect(formatPct(2.5)).toBe('2.5%');
      expect(formatPct(100)).toBe('100.0%');
    });

    test('safely returns placeholder for null/undefined/NaN without crashing', () => {
      expect(formatPct(null)).toBe('—');
      expect(formatPct(undefined)).toBe('—');
      expect(formatPct(NaN)).toBe('—');
    });
  });

  describe('Reports Page Subtitle Evaluation Logic', () => {
    function generateLatencySubtitle(stats: {
      min_rtt_ms?: number | null;
      max_rtt_ms?: number | null;
      total_probes?: number;
    } | null | undefined): string {
      if (
        stats?.min_rtt_ms !== null &&
        stats?.min_rtt_ms !== undefined &&
        stats?.max_rtt_ms !== null &&
        stats?.max_rtt_ms !== undefined
      ) {
        return `Min: ${formatNumber(stats.min_rtt_ms, 1)}ms · Max: ${formatNumber(stats.max_rtt_ms, 1)}ms`;
      }
      if (stats?.total_probes === 0) {
        return 'No probe samples recorded';
      }
      return 'Telemetry pending';
    }

    test('renders actual min and max for session with valid probes', () => {
      const stats = {
        min_rtt_ms: 14.2,
        max_rtt_ms: 32.8,
        total_probes: 10,
      };
      expect(generateLatencySubtitle(stats)).toBe('Min: 14.2ms · Max: 32.8ms');
    });

    test('safely handles empty session (total_probes = 0, null min/max)', () => {
      const emptySessionStats = {
        min_rtt_ms: null,
        max_rtt_ms: null,
        total_probes: 0,
      };
      expect(() => generateLatencySubtitle(emptySessionStats)).not.toThrow();
      expect(generateLatencySubtitle(emptySessionStats)).toBe('No probe samples recorded');
    });

    test('safely handles session with 100% loss (total_probes > 0 but null min/max)', () => {
      const failedSessionStats = {
        min_rtt_ms: null,
        max_rtt_ms: null,
        total_probes: 5,
      };
      expect(() => generateLatencySubtitle(failedSessionStats)).not.toThrow();
      expect(generateLatencySubtitle(failedSessionStats)).toBe('Telemetry pending');
    });

    test('safely handles completely null stats response from API', () => {
      expect(() => generateLatencySubtitle(null)).not.toThrow();
      expect(generateLatencySubtitle(null)).toBe('Telemetry pending');
    });
  });
});
