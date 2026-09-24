import { isAxiosError } from 'axios';

export const GrpcCode = {
  InvalidArgument: 3,
  NotFound: 5,
  AlreadyExists: 6,
  PermissionDenied: 7,
  FailedPrecondition: 9,
} as const;

export const apiErrorCode = (err: unknown): number | undefined => {
  if (!isAxiosError(err)) return undefined;
  const code = (err.response?.data as { code?: unknown } | undefined)?.code;
  return typeof code === 'number' ? code : undefined;
};
