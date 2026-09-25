const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function safeReturnPath(value: string | null | undefined, fallback = '/'): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\') ||
    CONTROL_CHARS.test(value)
  ) {
    return fallback;
  }
  return value;
}
