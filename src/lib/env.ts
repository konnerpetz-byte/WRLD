/**
 * Partner settings from Vercel. Names are matched without regard to case
 * ("Viator_API_Key" works the same as "VIATOR_API_KEY") and trimmed, so a
 * value pasted with a stray space still works.
 */
export function env(name: string): string | undefined {
  const direct = process.env[name];
  if (direct?.trim()) return direct.trim();
  const upper = name.toUpperCase();
  for (const [key, value] of Object.entries(process.env)) {
    if (key.toUpperCase() === upper && value?.trim()) return value.trim();
  }
  return undefined;
}
