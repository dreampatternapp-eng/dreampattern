export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Dreams happen overnight, so default the date to "last night" = yesterday before noon, today after. */
export function lastNight(now = new Date()): string {
  const d = new Date(now);
  if (d.getHours() < 12) d.setDate(d.getDate() - 1);
  return toISODate(d);
}

export function daysAgo(n: number, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

export function formatLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function monthKey(now = new Date()): string {
  return toISODate(now).slice(0, 7);
}
