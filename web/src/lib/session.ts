import type { Session } from '@ory/client';
import { devLogout } from '@/lib/dev-auth';
import { env } from '@/lib/env';
import { kratos } from '@/lib/kratos';

const LOGIN_PATH = '/login';

// checkSession validates the current Kratos session. Returns the session
// object if authenticated, or null for any failure (no cookie, expired,
// network error). Never throws — callers can treat the return value as a
// plain boolean.
export async function checkSession(): Promise<Session | null> {
  try {
    const { data } = await kratos.toSession();
    return data;
  } catch {
    return null;
  }
}

// clearSession invalidates the session and redirects to /login. Tries the
// Kratos logout flow first (which deletes the session cookie server-side);
// falls back to a hard redirect if Kratos is unreachable. Always clears
// the localStorage bearer-token fallback.
export async function clearSession(): Promise<void> {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('auth_token');

  if (env.devTools) {
    await devLogout().catch(() => undefined);
  }

  try {
    const { data } = await kratos.createBrowserLogoutFlow();
    window.location.replace(data.logout_url);
    return;
  } catch {
    // Kratos unavailable or no active session — just bounce to login.
  }
  window.location.replace(LOGIN_PATH);
}
