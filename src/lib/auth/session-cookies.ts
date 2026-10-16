import type { CookieOptions } from "@supabase/ssr";

/** Chrome caps persistent cookies around 400 days. Match @supabase/ssr defaults. */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/**
 * Ensure Supabase auth cookies are stored as persistent cookies so installed
 * FloBama Screens PWAs stay signed in across app closes and computer restarts.
 */
export function withPersistentAuthCookieOptions(
  options?: CookieOptions,
): CookieOptions {
  const maxAge =
    typeof options?.maxAge === "number" && options.maxAge > 0
      ? options.maxAge
      : AUTH_COOKIE_MAX_AGE_SECONDS;

  return {
    ...options,
    path: options?.path ?? "/",
    sameSite: options?.sameSite ?? "lax",
    maxAge,
  };
}
