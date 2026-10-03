import { DEV_MOCK_ROLES, type DevMockRole } from '@/lib/mock-roles';

const ROLE_STORAGE_KEY = 'guma-demo-role';

let fallbackRole: DevMockRole | null = null;

const isDemoRole = (value: unknown): value is DevMockRole =>
  (DEV_MOCK_ROLES as readonly unknown[]).includes(value);

export function readDemoRole(): DevMockRole | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(ROLE_STORAGE_KEY);
    return isDemoRole(stored) ? stored : null;
  } catch {
    return fallbackRole;
  }
}

export function saveDemoRole(role: DevMockRole | null): void {
  fallbackRole = role;
  try {
    if (role) localStorage.setItem(ROLE_STORAGE_KEY, role);
    else localStorage.removeItem(ROLE_STORAGE_KEY);
  } catch {
    return;
  }
}
