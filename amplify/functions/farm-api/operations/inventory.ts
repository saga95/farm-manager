/**
 * Produce inventory reads (#76 groundwork, SRS §11). Writes happen only through
 * cause-specific operations (round completion, sales, adjustments) so every
 * change has a deterministic transaction (ADR-0004).
 */

import { z } from 'zod';
import { isUlid, keys } from '../../../../src/domain/keys';
import { queryPrefix, toView } from '../lib/crud';
import { tenantOperation } from '../lib/operation';

export const listProduceBatches = tenantOperation({
  name: 'listProduceBatches',
  entitlement: 'farm.view',
  input: z.object({
    tenantId: z.string().min(1),
    farmId: z.string().refine(isUlid, 'must be a ULID'),
    cropCode: z.string().max(40).nullish(),
    availableOnly: z.boolean().nullish(),
  }),
  handler: async (input, ctx) => {
    const prefix = `${keys.prefix.batches}${input.cropCode ? `${input.cropCode}#` : ''}`;
    const items = await queryPrefix(
      keys.farmPk(ctx.access.tenantId, input.farmId),
      prefix
    );
    return items
      .filter(i => !input.availableOnly || Number(i['available']) > 0)
      .sort((a, b) => String(b['SK']).localeCompare(String(a['SK'])))
      .map(i => toView(i));
  },
});
