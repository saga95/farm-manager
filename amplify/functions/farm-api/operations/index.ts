import type { Operation } from '../lib/operation';
import {
  bulkCreateTrees,
  createTree,
  getTree,
  listTrees,
  updateTree,
} from './coconut';
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
import {
  createPluckingRound,
  getPluckingRound,
  listPluckingRounds,
  recordTreeHarvest,
  updateRoundPlan,
} from './plucking';

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
      listTrees,
      getTree,
      createTree,
      bulkCreateTrees,
      updateTree,
      createPluckingRound,
      listPluckingRounds,
      getPluckingRound,
      updateRoundPlan,
      recordTreeHarvest,
    ].map(op => [op.name, op])
  );
