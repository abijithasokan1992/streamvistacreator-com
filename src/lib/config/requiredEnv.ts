/**
 * Single source of truth for the browser-safe configuration the app needs at
 * build time. Used by:
 *  - the Vite build-time check (fails the production build early)
 *  - the runtime startup fallback page in `src/main.tsx`
 *
 * Only variable NAMES live here — never values. Nothing here is a secret.
 */
export const REQUIRED_PUBLIC_ENV = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const;

export type RequiredPublicEnv = (typeof REQUIRED_PUBLIC_ENV)[number];

/** Returns the names (never values) of any required variables that are unset. */
export function missingPublicEnv(
  read: (name: string) => string | undefined,
): RequiredPublicEnv[] {
  return REQUIRED_PUBLIC_ENV.filter((name) => {
    const value = read(name);
    return !value || value.trim().length === 0;
  });
}
