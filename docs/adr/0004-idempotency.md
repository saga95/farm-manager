# ADR-0004: Idempotent field and inventory mutations

- **Status:** Accepted (2026-10-03)
- **Issue:** #21 · **SRS:** §25.3, §30, DQ-006, CALC-015, AC-PR-006, AC-SL-006, AC-DH-004

## Context

Field use means flaky 4G and retries. Retrying an operation must never:

- create a second TreeHarvest for the same capture;
- add a round's coconuts to stock twice (AC-PR-006, CALC-015);
- reduce stock twice for one sale (AC-SL-006);
- apply an operational dehusking twice (AC-DH-004);
- create duplicate media (§41.12).

## Decision

1. **The client generates IDs for every created record** (ULID, made on the device at capture time). Creates use a conditional put: `attribute_not_exists(PK)`.
   - If the item already exists, compare it with the request. If it's the **same payload**, return the stored item as **success** (an idempotent replay). If it's **different**, return `CONFLICT`.
   - This covers TreeHarvest, CoconutSample, FarmActivity, GenericHarvest, Media, Buyer, Sale drafts and similar records.
2. **Inventory transactions use deterministic IDs taken from their cause**, never random ones:

   | Cause                                      | Transaction ID                        |
   | ------------------------------------------ | ------------------------------------- |
   | Round completion                           | `HARVEST_IN#ROUND#<roundId>`          |
   | Generic harvest                            | `HARVEST_IN#GH#<genericHarvestId>`    |
   | Sale completion                            | `SALE_OUT#<saleId>#<batchId>#<state>` |
   | Operational dehusking                      | `DEHUSK#<clientOpId>`                 |
   | Adjustment (household use, damage, waste…) | `ADJ#<clientOpId>`                    |
   | Edit reconciliation                        | `RECON#<entityId>#v<version>`         |

   Each transaction is written with `attribute_not_exists(SK)`, so the same cause can be applied at most once.

3. **State transitions are atomic and conditional.** `completePluckingRound` is a single `TransactWriteItems`:

   - **Round:** `status IN_PROGRESS → COMPLETE`, with the condition `status = IN_PROGRESS AND version = :v`.
   - **ProduceBatch:** put with `attribute_not_exists`, and `quantityReceived` set to the round total.
   - **InventoryTxn:** `HARVEST_IN#ROUND#<roundId>`, with `attribute_not_exists`.
   - **Batch counters:** `available += total`.

   A retry after success fails the condition, and the handler then returns the **already-completed round** as success. `completeSale`, operational dehusking and adjustments follow the same pattern. `TransactWriteItems` also accepts a `ClientRequestToken` (the client op ID), which deduplicates exact retries for 10 minutes.

4. **Optimistic locking.** Mutable aggregates (Round, Sale, Batch, Tree prediction snapshot) carry `version`. Updates require `version = :expected`, and on mismatch the client gets `CONFLICT` with the latest state.
5. **Editing completed records** (AC-PR-007, §31) writes a **delta** reconciliation transaction, e.g. `RECON#<roundId>#v3` with `+2` or `-1`. It never rewrites history, so stock stays explainable as the sum of transactions.
6. **The client contract:**
   - Every mutation carries `clientOpId` (ULID), plus client IDs for any created records. The offline queue (§30) persists and replays them unchanged.
   - `IDEMPOTENT_REPLAY` is treated as success.
   - `CONFLICT` makes the client refetch and show what changed.
7. **Tests for each operation:**
   - Call it twice with the same `clientOpId` and assert that stock and records are unchanged by the second call.
   - Run concurrent duplicate calls, and assert that exactly one is applied.

## Consequences

- ✅ Exactly-once effects on stock (CALC-015) without a separate idempotency table.
- ✅ Works naturally with the PWA offline queue and the future mobile client.
- ⚠️ `TransactWriteItems` is limited to 100 items. A sale across many batches is well under that (fewer than 10 in practice).
- ⚠️ Client clocks may be wrong. ULIDs are used for uniqueness and ordering hints only, and business dates (`harvestDate`) are explicit fields.
