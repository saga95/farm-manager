import type { Operation } from '../lib/operation';
import {
  bulkCreateTrees,
  createTree,
  getTree,
  listTrees,
  updateTree,
} from './coconut';
import {
  archivePluckingRound,
  archiveTreeHarvest,
  correctTreeHarvest,
  restorePluckingRound,
  restoreTreeHarvest,
} from './corrections';
import { createBuyer, getBuyer, listBuyers, updateBuyer } from './buyers';
import {
  archiveActivity,
  createCycle,
  getCycle,
  listActivities,
  listCycles,
  recordActivity,
  recordCycleHarvest,
  updateCycle,
} from './cycles';
import { createTenant } from './createTenant';
import {
  createInputItem,
  getInputItem,
  listInputItems,
  recordInputMovement,
  updateInputItem,
} from './inputs';
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
import { getTreeHistory, listDueTrees } from './history';
import {
  archiveMedia,
  completeMediaUpload,
  getMediaOriginalUrl,
  initiateMediaUpload,
  listMedia,
} from './media';
import {
  archiveSale,
  getSale,
  listSales,
  recordSale,
  restoreSale,
  updateSale,
} from './sales';
import { recordCoconutSample } from './samples';
import {
  acceptInvite,
  getTeam,
  inviteMember,
  myInvites,
  revokeInvite,
  saveProfile,
  saveRole,
  updateMember,
} from './team';
import {
  dehuskProduce,
  getProduceBatch,
  listProduceBatches,
  recordProduceMovement,
} from './inventory';
import {
  completePluckingRound,
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
      completePluckingRound,
      listProduceBatches,
      getProduceBatch,
      recordProduceMovement,
      dehuskProduce,
      listInputItems,
      getInputItem,
      createInputItem,
      updateInputItem,
      recordInputMovement,
      listBuyers,
      getBuyer,
      createBuyer,
      updateBuyer,
      recordSale,
      updateSale,
      archiveSale,
      restoreSale,
      getSale,
      listSales,
      listCycles,
      getCycle,
      createCycle,
      updateCycle,
      recordActivity,
      listActivities,
      archiveActivity,
      recordCycleHarvest,
      getTeam,
      myInvites,
      inviteMember,
      revokeInvite,
      acceptInvite,
      updateMember,
      saveRole,
      saveProfile,
      getTreeHistory,
      listDueTrees,
      recordCoconutSample,
      initiateMediaUpload,
      completeMediaUpload,
      listMedia,
      getMediaOriginalUrl,
      archiveMedia,
      correctTreeHarvest,
      archiveTreeHarvest,
      restoreTreeHarvest,
      archivePluckingRound,
      restorePluckingRound,
    ].map(op => [op.name, op])
  );
