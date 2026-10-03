import type { Operation } from '../lib/operation';
import { createTenant } from './createTenant';
import { me } from './me';

/** Every AppSync field handled by farm-api. Field name → operation. */
export const OPERATIONS: Readonly<Record<string, Operation>> =
  Object.fromEntries([me, createTenant].map(op => [op.name, op]));
