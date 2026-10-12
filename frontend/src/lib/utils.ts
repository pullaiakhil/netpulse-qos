import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return `${value.toFixed(1)} ms`;
}

export function formatNumber(value: number | null | undefined, decimals = 1, fallback = '—'): string {
  if (value === null || value === undefined || isNaN(value)) return fallback;
  return value.toFixed(decimals);
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return `${value.toFixed(1)}%`;
}

export function formatKbps(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)} Gbps`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} Mbps`;
  }
  return `${value.toFixed(1)} Kbps`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '—';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export function formatTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoString;
  }
}

export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return isoString;
  }
}

/**
 * Safely extract and capitalize target probe protocol with semantic fallback.
 * Prevents runtime TypeError when backend target_type vs type property mismatch occurs.
 */
export function getTargetProtocol(target?: { type?: string; target_type?: string } | null): string {
  if (!target) return 'ICMP';
  const rawType = target.type ?? target.target_type;
  return String(rawType || 'icmp').toUpperCase();
}

/**
 * Safely format a session identifier for UI display.
 * Handles numbers (e.g. 1 -> "#1"), UUID strings (e.g. "a1b2c3d4-..." -> "a1b2c3d4..."),
 * or invalid/missing values without throwing TypeError.
 */
export function formatSessionId(id: string | number | null | undefined): string {
  if (id === null || id === undefined || id === '') {
    return 'Unknown';
  }
  if (typeof id === 'number') {
    return `#${id}`;
  }
  const str = String(id).trim();
  if (/^\d+$/.test(str)) {
    return `#${str}`;
  }
  return str.length > 8 ? `${str.slice(0, 8)}...` : str;
}

