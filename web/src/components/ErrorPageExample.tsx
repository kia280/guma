/**
 * Example component showing how to use the error page
 *
 * Usage:
 * 1. Import the error handler utilities and hook
 * 2. Use getErrorPageUrl() to generate error URLs
 * 3. Use useErrorRedirect() hook in client components to redirect to error page
 */

'use client';

import { useRouter } from 'next/navigation';
import { Button, Card, CardBody, CardHeader, Divider } from '@heroui/react';
import { ErrorIds, getErrorPageUrl } from '@/lib/error-handler';
import { useErrorRedirect } from '@/hooks/useErrorRedirect';

/**
 * Example 1: Direct URL generation for links
 */
export function ErrorLinkExample() {
  const notFoundUrl = getErrorPageUrl(ErrorIds.NOT_FOUND);
  const unauthorizedUrl = getErrorPageUrl(ErrorIds.UNAUTHORIZED, '/dashboard');

  return (
    <Card>
      <CardHeader>
        <h3>Error Links Example</h3>
      </CardHeader>
      <Divider />
      <CardBody className="gap-4">
        <p>You can generate error page URLs directly:</p>
        <ul className="text-sm space-y-2">
          <li>Not Found: <code className="bg-default-100 px-2 py-1 rounded">{notFoundUrl}</code></li>
          <li>Unauthorized: <code className="bg-default-100 px-2 py-1 rounded">{unauthorizedUrl}</code></li>
        </ul>
      </CardBody>
    </Card>
  );
}

/**
 * Example 2: Using useErrorRedirect hook in client component
 */
export function ErrorRedirectExample() {
  const { redirectToError } = useErrorRedirect();

  const handleUnauthorized = () => {
    redirectToError(ErrorIds.UNAUTHORIZED, '/dashboard');
  };

  const handleServerError = () => {
    redirectToError(ErrorIds.SERVER_ERROR);
  };

  const handleSessionInactive = () => {
    redirectToError(ErrorIds.SESSION_INACTIVE, '/login');
  };

  return (
    <Card>
      <CardHeader>
        <h3>Error Redirect Examples</h3>
      </CardHeader>
      <Divider />
      <CardBody className="gap-3">
        <Button
          onPress={handleUnauthorized}
          color="warning"
          variant="flat"
        >
          Redirect to 401 Error
        </Button>
        <Button
          onPress={handleServerError}
          color="danger"
          variant="flat"
        >
          Redirect to 500 Error
        </Button>
        <Button
          onPress={handleSessionInactive}
          color="danger"
          variant="flat"
        >
          Redirect to Session Inactive
        </Button>
      </CardBody>
    </Card>
  );
}

/**
 * Example 3: Programmatic usage in server actions or API handlers
 */
export function ErrorServerActionExample() {
  return (
    <Card>
      <CardHeader>
        <h3>Server-Side Usage Example</h3>
      </CardHeader>
      <Divider />
      <CardBody className="gap-2 text-sm">
        <p>In a server action or API route:</p>
        <pre className="bg-default-100 p-3 rounded overflow-auto text-xs">
{`import { getErrorPageUrl, ErrorIds } from '@/lib/error-handler';
import { redirect } from 'next/navigation';

export async function myServerAction() {
  try {
    // ... your logic
  } catch (error) {
    // Redirect to error page with custom error ID
    redirect(getErrorPageUrl(ErrorIds.SERVER_ERROR));
  }
}`}
        </pre>
      </CardBody>
    </Card>
  );
}

/**
 * Example 4: All available error codes
 */
export function ErrorCodesReference() {
  const errorCodes = [
    { code: '401', name: 'UNAUTHORIZED', desc: 'User not authenticated' },
    { code: '403', name: 'FORBIDDEN', desc: 'User lacks permission' },
    { code: '404', name: 'NOT_FOUND', desc: 'Resource not found' },
    { code: '429', name: 'TOO_MANY_REQUESTS', desc: 'Rate limit exceeded' },
    { code: '500', name: 'SERVER_ERROR', desc: 'Internal server error' },
    { code: '503', name: 'SERVICE_UNAVAILABLE', desc: 'Service unavailable' },
    { code: 'session_inactive', name: 'SESSION_INACTIVE', desc: 'Session expired' },
    { code: 'invalid_session', name: 'INVALID_SESSION', desc: 'Session invalid' },
  ];

  return (
    <Card>
      <CardHeader>
        <h3>Available Error Codes</h3>
      </CardHeader>
      <Divider />
      <CardBody>
        <div className="space-y-2 text-sm">
          {errorCodes.map(({ code, name, desc }) => (
            <div key={code} className="flex justify-between items-start p-2 bg-default-100 rounded">
              <div>
                <code className="font-semibold">{code}</code>
                <p className="text-default-600 text-xs">{desc}</p>
              </div>
              <code className="text-xs text-default-600">ErrorIds.{name}</code>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
