/**
 * API errors. AppSync surfaces a thrown Lambda error's message to the client;
 * messages are `<CODE>: <detail>` so clients can branch on the code
 * (ADR-0004 client contract). Never put internal details in `detail`.
 */

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'INTERNAL';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    detail: string
  ) {
    super(`${code}: ${detail}`);
    this.name = 'ApiError';
  }
}

export const forbidden = (detail = 'Not allowed') =>
  new ApiError('FORBIDDEN', detail);
export const notFound = (detail = 'Not found') =>
  new ApiError('NOT_FOUND', detail);
