export const CoreErrorCodes = {
  CORE_ENCRYPTION_INVALID_FORMAT: 'CORE_ENCRYPTION_INVALID_FORMAT',
  CORE_ENCRYPTION_KEY_NOT_FOUND: 'CORE_ENCRYPTION_KEY_NOT_FOUND',
  CORE_VALIDATION_FAILED: 'CORE_VALIDATION_FAILED',
} as const;

export type CoreErrorCode = (typeof CoreErrorCodes)[keyof typeof CoreErrorCodes];
