/**
 * Error handler utilities for redirecting to error page
 */

export interface ErrorPageOptions {
  errorId: string;
  returnUrl?: string;
}

/**
 * Generate error page URL with error code and optional return URL
 * @param errorId - The error identifier (e.g., '404', '500', 'session_inactive')
 * @param returnUrl - Optional URL to return to after error is dismissed
 * @returns The error page URL
 */
export function getErrorPageUrl(
  errorId: string,
  returnUrl?: string
): string {
  const params = new URLSearchParams();
  params.set('id', errorId);

  if (returnUrl) {
    params.set('return', returnUrl);
  }

  return `/error?${params.toString()}`;
}

/**
 * Common error identifiers
 */
export const ErrorIds = {
  UNAUTHORIZED: '401',
  FORBIDDEN: '403',
  NOT_FOUND: '404',
  TOO_MANY_REQUESTS: '429',
  SERVER_ERROR: '500',
  SERVICE_UNAVAILABLE: '503',
  SESSION_INACTIVE: 'session_inactive',
  INVALID_SESSION: 'invalid_session',
} as const;

/**
 * Error code type
 */
export type ErrorCode = typeof ErrorIds[keyof typeof ErrorIds];
