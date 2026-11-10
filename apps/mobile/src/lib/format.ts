export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** "Ravi Kumar" -> "RK" */
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

/** "Good morning" / "Good afternoon" / "Good evening" for the current local time. */
export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** "Acme design" -> "AD", "Mobile" -> "MO" (workspace tiles always show two letters). */
export function workspaceInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? '').slice(0, 2).toUpperCase();
}

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** "expires today" / "expires in 1 day" / "expires in 6 days" */
export function expiresIn(iso: string, now = Date.now()) {
  const days = Math.ceil((new Date(iso).getTime() - now) / 86_400_000);
  if (days <= 0) return 'expires today';
  return `expires in ${plural(days, 'day')}`;
}

/** "Oct 27" */
export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// ---------- Due dates ----------

export type DueState = 'overdue' | 'soon' | 'later';

/** Overdue once the time has passed; "soon" within the next 48 hours. */
export function dueState(iso: string, now = Date.now()): DueState {
  const ms = new Date(iso).getTime() - now;
  if (ms < 0) return 'overdue';
  if (ms < 48 * 3_600_000) return 'soon';
  return 'later';
}

/** "Nov 4, 6:00 PM" */
export const dateTime = (iso: string | Date) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

// ---------- Colours ----------

/** Mixes a #RRGGBB colour with white (amount 0–1 of white). Used for soft label/board tints. */
export function tint(hex: string, amount: number) {
  return mix(hex, '#FFFFFF', amount);
}

/** Mixes a #RRGGBB colour with black (amount 0–1 of black). Used for readable label text. */
export function shade(hex: string, amount: number) {
  return mix(hex, '#000000', amount);
}

function mix(a: string, b: string, amount: number) {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return a;
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * amount));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function parseHex(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
