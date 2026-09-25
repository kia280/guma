import { isAxiosError } from 'axios';

export const GrpcCode = {
  InvalidArgument: 'InvalidArgument',
  NotFound: 'NotFound',
  AlreadyExists: 'AlreadyExists',
  PermissionDenied: 'PermissionDenied',
  FailedPrecondition: 'FailedPrecondition',
} as const;

export const apiErrorCode = (err: unknown): string | undefined => {
  if (!isAxiosError(err)) return undefined;
  const code = (err.response?.data as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' ? code : undefined;
};

export const isNotFoundError = (err: unknown): boolean => {
  if (isAxiosError(err)) {
    return err.response?.status === 404 || apiErrorCode(err) === GrpcCode.NotFound;
  }
  return err instanceof Error && /not found/i.test(err.message);
};
