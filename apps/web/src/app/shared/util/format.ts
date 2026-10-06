export function formatStatus(status: string): string {
  return status.replaceAll('_', ' ');
}

export function shortSha(sha: string | null | undefined): string {
  if (!sha) {
    return '—';
  }
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) {
    return '—';
  }
  const delta = Date.now() - d;
  const sec = Math.round(delta / 1000);
  if (sec < 60) {
    return `${sec}s ago`;
  }
  const min = Math.round(sec / 60);
  if (min < 60) {
    return `${min}m ago`;
  }
  const hr = Math.round(min / 60);
  if (hr < 48) {
    return `${hr}h ago`;
  }
  return formatWhen(iso);
}
