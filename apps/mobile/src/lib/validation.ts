// Client-side checks that mirror the API's rules, so users get instant feedback.

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** Same rule as the API: at least 8 characters with a number (max 72). */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 72) return 'Password must be 72 characters or fewer.';
  if (!/\d/.test(password)) return 'Password must include a number.';
  return null;
}

/** 0 = empty, 1 = too weak, 2 = meets the rules, 3 = strong. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0;
  if (passwordProblem(password)) return 1;
  const variety = [/[a-z]/, /[A-Z]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  return password.length >= 12 || variety === 3 ? 3 : 2;
}
