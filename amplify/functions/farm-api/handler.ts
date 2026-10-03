import type { AppSyncResolverEvent } from 'aws-lambda';
import { ApiError } from './lib/errors';
import { OPERATIONS } from './operations';

/**
 * AppSync → farm-api router. Unknown fields fail closed. Unexpected errors are
 * logged with context and returned to clients as INTERNAL without details.
 */
export const handler = async (
  event: AppSyncResolverEvent<Record<string, unknown>>
) => {
  const field = event.info?.fieldName;
  const op = field ? OPERATIONS[field] : undefined;
  if (!op) throw new ApiError('NOT_FOUND', `Unknown operation`);

  try {
    return await op.run(event, new Date().toISOString());
  } catch (e) {
    if (e instanceof ApiError) throw e;
    console.error(
      JSON.stringify({
        level: 'error',
        op: field,
        message: (e as Error).message,
        stack: (e as Error).stack,
      })
    );
    throw new ApiError('INTERNAL', 'Unexpected error');
  }
};
