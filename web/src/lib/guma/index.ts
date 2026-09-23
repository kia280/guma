import { env } from '@/lib/env';
import { isDevMockEnabled } from '@/lib/dev-mock';
import { mockApiClient } from './mock';
import { gumaApiClient } from './client';
import type { ApiClient } from './types';

function activeClient(): ApiClient {
  return env.useMock || isDevMockEnabled() ? mockApiClient : gumaApiClient;
}

/**
 * The single entry point for data access from the frontend.
 *
 * - When `NEXT_PUBLIC_USE_MOCK=true`, or mock data is toggled on in the dev
 *   tools panel → uses the in-memory `mockApiClient`.
 * - Otherwise → talks to the guma grpc-gateway at `env.api.url` via `gumaApiClient`.
 *
 * Both implementations satisfy the same `ApiClient` interface (see `./types`),
 * so the selection is transparent to callers.
 */
export const apiClient: ApiClient = new Proxy({} as ApiClient, {
  get: (_, key) => activeClient()[key as keyof ApiClient],
});

export { mockApiClient, gumaApiClient };
export type { ApiClient } from './types';
export type { AuctionFilters } from './types';
