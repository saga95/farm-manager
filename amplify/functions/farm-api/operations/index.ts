import type { Operation } from '../lib/operation';
import { createTenant } from './createTenant';
import {
  createSpace,
  createZone,
  listFarms,
  listSpaces,
  listZones,
  updateFarm,
  updateSpace,
  updateZone,
} from './farm';
import { me } from './me';

/** Every AppSync field handled by farm-api. Field name → operation. */
export const OPERATIONS: Readonly<Record<string, Operation>> =
  Object.fromEntries(
    [
      me,
      createTenant,
      listFarms,
      updateFarm,
      listZones,
      createZone,
      updateZone,
      listSpaces,
      createSpace,
      updateSpace,
    ].map(op => [op.name, op])
  );
