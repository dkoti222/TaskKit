export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** "Ravi Kumar" -> "RK" */
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
