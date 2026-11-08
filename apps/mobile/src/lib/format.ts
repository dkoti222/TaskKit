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
