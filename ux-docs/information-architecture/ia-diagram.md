# Information Architecture: V1

Source: SRS v1.1 §20 (recommended mobile navigation), §21 (key screens), §41.15 (four pillars).

## Primary navigation (mobile bottom bar; side rail on ≥ md)

| Tab           | Answers                                       | Pillar                             |
| ------------- | --------------------------------------------- | ---------------------------------- |
| **Home**      | "What is happening on this farm now?"         | All                                |
| **Farm**      | "What do I grow, and where?"                  | Farm & Space · Crops & Maintenance |
| **Inventory** | "What do I have?"                             | Harvest & Inventory                |
| **Sales**     | "Who buys what, and what did I earn?"         | Buyers & Sales                     |
| **More**      | Analytics, settings, members, export, account | —                                  |

There is also a **persistent quick-action button** (FAB, §20) on Home, Farm, Inventory and Sales:
New Plucking Round · Record Harvest · Record Sale · Add Inventory Movement.

## Diagram

```mermaid
flowchart TD
  auth[Sign in SCR-001] --> setup{Tenant & farm exist?}
  setup -- no --> onboarding[Initial setup SCR-002]
  setup -- yes --> home
  onboarding --> home

  subgraph shell[App shell: bottom nav + quick actions]
    home[Home / Dashboard SCR-003]
    farm[Farm]
    inv[Inventory]
    sales[Sales]
    more[More]
  end

  home --> due[Next plucking / planning SCR-013]
  home --> activity[Recent activity]

  farm --> zones[Zones SCR-004]
  farm --> spaces[Growing spaces §41.2]
  farm --> coconut[Coconut trees SCR-005]
  farm --> rounds[Plucking rounds]
  farm --> cycles[Production cycles SCR-024/025]
  coconut --> bulk[Bulk registration SCR-006]
  coconut --> tree[Tree profile SCR-007]
  rounds --> newround[New round SCR-008]
  newround --> capture[Active capture SCR-009]
  capture --> review[Review & complete SCR-010]
  review --> samples[Record samples SCR-012]
  tree --> harvest[Tree harvest detail SCR-011]
  cycles --> gharvest[Record harvest SCR-026]
  cycles --> activities[Maintenance activities §41.4]

  inv --> produce[Produce SCR-015]
  produce --> batch[Batch detail SCR-016]
  inv --> inputs[Farm inputs SCR-017]
  inputs --> item[Item detail SCR-018]

  sales --> history[Sales history SCR-023]
  sales --> recordsale[Record sale SCR-021]
  history --> sale[Sale detail SCR-022]
  sales --> buyers[Buyers SCR-019]
  buyers --> buyer[Buyer & preferences SCR-020]
  buyer -. size match .-> coconut

  more --> analytics[Analytics SCR-014 / SCR-027]
  more --> settings[Tenant / farm / members SCR-030]
  more --> search[Search SCR-029]
  more --> export[Export]
  more --> account[Account]

  tree -. photos .-> media[Media viewer SCR-028]
  batch -. photos .-> media
  sale -. photos .-> media
```
