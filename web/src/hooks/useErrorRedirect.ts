import { useRouter } from 'next/navigation';
import { getErrorPageUrl, type ErrorCode } from '@/lib/error-handler';

/**
 * Hook to redirect to error page
 */
export function useErrorRedirect() {
  const router = useRouter();

  const redirectToError = (errorId: ErrorCode | string, returnUrl?: string) => {
    const errorPageUrl = getErrorPageUrl(errorId, returnUrl);
    router.push(errorPageUrl);
  };

  return { redirectToError };
}
