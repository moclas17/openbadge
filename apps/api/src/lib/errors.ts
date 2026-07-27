/**
 * Application error classes and factory functions.
 * Every thrown error should be an AppError so the global error handler can
 * serialize it into the standard error envelope.
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    code: string,
    statusCode: number,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Error factories — mirrors the error codes from API.md section 8.2
// ---------------------------------------------------------------------------

export const errors = {
  // 401 Authentication
  authRequired: () =>
    new AppError('AUTHENTICATION_REQUIRED', 401, 'Authentication is required.'),

  invalidSession: () =>
    new AppError('INVALID_SESSION', 401, 'Your session is invalid or has expired.'),

  challengeExpired: () =>
    new AppError('CHALLENGE_EXPIRED', 401, 'The authentication challenge has expired.'),

  challengeUsed: () =>
    new AppError('CHALLENGE_ALREADY_USED', 401, 'The authentication challenge has already been used.'),

  invalidSignature: () =>
    new AppError('INVALID_SIGNATURE', 401, 'The wallet signature is invalid.'),

  // 403 Authorization
  permissionDenied: () =>
    new AppError('PERMISSION_DENIED', 403, 'You do not have permission to perform this action.'),

  insufficientRole: (required: string) =>
    new AppError(
      'INSUFFICIENT_ROLE',
      403,
      `This action requires the '${required}' role or higher.`,
    ),

  accountDisabled: () =>
    new AppError('ACCOUNT_DISABLED', 403, 'Your account has been disabled.'),

  // 404 Not Found
  notFound: (resource: string) =>
    new AppError(`${resource.toUpperCase()}_NOT_FOUND`, 404, `${resource} not found.`),

  challengeNotFound: () =>
    new AppError('CHALLENGE_NOT_FOUND', 404, 'Authentication challenge not found.'),

  // 409 Conflict
  conflict: (code: string, message: string) =>
    new AppError(code, 409, message),

  slugConflict: (resource: string) =>
    new AppError(`${resource.toUpperCase()}_SLUG_CONFLICT`, 409, `A ${resource} with that slug already exists.`),

  walletAlreadyLinked: () =>
    new AppError('WALLET_ALREADY_LINKED', 409, 'This wallet is already linked to an account.'),

  alreadyClaimed: () =>
    new AppError('ALREADY_CLAIMED', 409, 'You have already claimed this event.'),

  claimCodeUsed: () =>
    new AppError('CLAIM_CODE_USED', 409, 'This claim code has already been used.'),

  claimCodeRevoked: () =>
    new AppError('CLAIM_CODE_REVOKED', 409, 'This claim code has been revoked.'),

  maximumClaimsReached: () =>
    new AppError('MAXIMUM_CLAIMS_REACHED', 409, 'The maximum number of claims for this event has been reached.'),

  idempotencyConflict: () =>
    new AppError(
      'IDEMPOTENCY_CONFLICT',
      409,
      'An idempotent request with this key already exists but has a different request body.',
    ),

  memberAlreadyExists: () =>
    new AppError('MEMBER_ALREADY_EXISTS', 409, 'This wallet is already a member of the organization.'),

  // 410 Gone
  claimCodeExpired: () =>
    new AppError('CLAIM_CODE_EXPIRED', 410, 'This claim code has expired.'),

  // 422 Validation
  validation: (fields: unknown) =>
    new AppError('VALIDATION_ERROR', 422, 'Validation failed.', { fields }),

  // 429 Rate limit
  rateLimitExceeded: () =>
    new AppError('RATE_LIMIT_EXCEEDED', 429, 'Too many requests. Please try again later.'),

  // 500 Server errors
  internal: (message = 'An internal server error occurred.') =>
    new AppError('INTERNAL_SERVER_ERROR', 500, message),

  // Business logic
  eventNotPublished: () =>
    new AppError('EVENT_NOT_PUBLISHED', 422, 'This event is not currently accepting claims.'),

  claimWindowClosed: () =>
    new AppError('CLAIM_WINDOW_CLOSED', 422, 'The claim window for this event is not open.'),

  eventPaused: () =>
    new AppError('EVENT_PAUSED', 422, 'This event is currently paused.'),

  eventArchived: () =>
    new AppError('EVENT_ARCHIVED', 410, 'This event has been archived.'),

  invalidClaimCode: () =>
    new AppError('INVALID_CLAIM_CODE', 422, 'The claim code is invalid.'),

  mediaNotAvailable: () =>
    new AppError('MEDIA_NOT_AVAILABLE', 422, 'The referenced media is not available.'),

  cannotRemoveLastOwner: () =>
    new AppError('CANNOT_REMOVE_LAST_OWNER', 422, 'Cannot remove the last owner of an organization.'),

  cannotRemoveSelf: () =>
    new AppError('CANNOT_REMOVE_SELF', 422, 'You cannot remove yourself from the organization.'),

  idempotencyKeyRequired: () =>
    new AppError('IDEMPOTENCY_KEY_REQUIRED', 422, 'An Idempotency-Key header is required for this request.'),
};
