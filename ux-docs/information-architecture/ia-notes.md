# IA Notes: V1

## Decisions

1. **Five tabs, the SRS's own wording** (§20): Home / Farm / Inventory / Sales / More. Five fits a phone bottom bar with 48px targets at 320px width.
2. **Coconut lives under Farm**, beside zones, spaces and production cycles. It is not a separate tab. The platform is "farm-aware, crop-aware, not crop-locked" (PR-004). Coconut gets **shortcuts** instead: the Home quick action and the due-soon card.
3. **The plucking flow is a focused sub-flow.** The bottom navigation is hidden during active capture (SCR-009) to maximise space and prevent accidental exits. A persistent "Round in progress" banner lets the user return to it from anywhere.
4. **Quick actions**: New Plucking Round, Record Harvest, Record Sale, Inventory Movement (§16, §20). On **Home** they appear as large tiles at the top of the dashboard. On every other tab they appear as a floating speed-dial button above the bottom navigation.
5. **Analytics goes under More.** The mobile Home stays light on charts (§16 "avoid overloading mobile dashboard with charts").
6. **Desktop (≥ md):** the bottom bar becomes a side navigation rail with the same five destinations, so the IA doesn't change between devices.
7. **Deep links are stable and ID-based** (`/coconut/trees/[treeId]`), so a future mobile app and shared links can address the same records.

## Depth check

| Path                                           | Depth                |
| ---------------------------------------------- | -------------------- |
| Home → New round → Capture                     | 2 (via quick action) |
| Farm → Coconut → Tree profile → Harvest detail | 3                    |
| Sales → Buyers → Buyer → matching trees        | 3                    |

No V1 screen is more than 3 levels below a tab.

## Gaps / open questions

- Q-008 (#27): if helpers enter data, the capture flow may need a "planned round" handed over from the owner.
- Search (SCR-029) is reachable from More in V1. Consider a header search icon once there's enough data.
- Members and roles affect visibility: VIEWER sees no quick actions, and MEMBER sees no tenant settings (§4.3).
