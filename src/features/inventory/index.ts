/**
 * Feature: inventory
 * Produce inventory (ProduceBatch, transactions, HUSKED/DEHUSKED) and farm inputs.
 * Tracked in Epic 6 (#14).
 *
 * Public API of this feature. Other features and pages import only from here.
 * Layout: types.ts → repository.ts (data access) → hooks.ts (React Query) → components/
 * Pure business rules belong in `src/domain/inventory`, not in this folder.
 */
export {};
