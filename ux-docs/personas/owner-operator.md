# 👤 Persona: Dilan, the Owner-Operator (primary)

> _"After the plucker leaves, I just want the counts, the photos and the money in one place. Not scattered through WhatsApp."_

Role in the product: **Tenant OWNER**. This persona is based on the validation tenant, the product owner's one-acre farm (SRS §1).

---

## 📋 Profile

| Field                | Detail                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------- |
| **Name**             | Dilan (fictional)                                                                             |
| **Age**              | 35–50                                                                                         |
| **Occupation**       | Professional with a full-time job who runs a one-acre farm on the side                        |
| **Location**         | Sri Lanka (rural / peri-urban)                                                                |
| **Farm**             | About 50 coconut trees (30–40 producing), a polytunnel being built, pepper and banana planned |
| **Devices**          | Android phone outdoors (sun glare, one hand, often patchy 4G); laptop at home                 |
| **Tech Proficiency** | ⭐⭐⭐⭐☆ (4/5): comfortable with apps; impatient with long forms                             |

---

## 🎯 Goals

### Primary Goal

> Record each plucking round completely (counts, photos, samples and sales) **faster than the current WhatsApp habit** (PR-002, §1.4).

### Secondary Goals

- Open any tree months later and immediately see its harvests, sample sizes and the date it is next due (§1.4).
- Know when to call the plucker and which 8–10 trees are likely ready (§10.3).
- Match coconut sizes to buyers (restaurant → Medium, shop → Large, street food → Small) without relying on memory (§13.2).
- Trust the stock numbers: what was harvested, sold, used at home or damaged (§11).
- Bring the polytunnel and backyard crops into the same app as they start producing (§14, §41).

---

## 😤 Frustrations & Pain Points

- **History buried in chat:** photos and counts are scattered across a private WhatsApp chat and impossible to query.
- **Mental arithmetic:** sale totals by size are calculated by hand, and the negotiated final amount differs from the arithmetic (§13.4).
- **No timing signal:** it's unclear which trees are due, so plucker visits are planned by feel.
- **Field conditions:** standing at a tree with one hand busy, gloves on, sun on the screen, and the connection dropping.
- **Fear of false data:** the owner distrusts apps that "guess". A missing record must not show up as zero (PR-007, DQ-001).

---

## 💡 Motivations

| Motivation                                   | Strength                                                    |
| -------------------------------------------- | ----------------------------------------------------------- |
| Reliable farm memory (stop losing records)   | ██████████ Very high                                        |
| Saving time during and after plucking rounds | █████████░ High                                             |
| Better income from size-aware selling        | ███████░░░ Medium–High                                      |
| Planning (plucker visits, crops for spaces)  | ██████░░░░ Medium                                           |
| Analytics & charts                           | ████░░░░░░ Low–Medium (only once there is trustworthy data) |

---

## 🧠 Behaviors & Habits

- Takes a photo of each tree's coconut pile, then types the count into WhatsApp.
- After a round, dehusks **one** coconut per harvested tree to judge its size.
- Negotiates the final sale amount; sometimes rounds it or gives a discount.
- Checks the phone in short bursts outdoors and does reviews and backfill at night on a laptop.

**Tools used daily:** WhatsApp, phone camera, a calculator, Google Sheets (occasionally).

---

## 📖 Scenario

> The plucker arrives at 7 a.m. Dilan opens the app and taps **New Plucking Round**; the date is already today. At Tree 12 Dilan taps the large camera button, shoots the pile, types **13** on the number pad and hits **Save & Next**, then walks on. Nine trees take less time than one WhatsApp message thread used to. That evening Dilan dehusks one coconut from each tree, taps a size for each, and sees that Tree 18 has now been Medium in 4 of its last 5 samples. The next morning a restaurant buyer asks for 40 Medium coconuts. Dilan filters the trees by recent Medium samples, dehusks the right stock, and records the sale. The app keeps both the calculated LKR 4,800 and the LKR 4,600 actually received.

---

## 🧭 Design implications

| Need                 | Design response                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| One-handed, outdoors | Bottom navigation, a primary action within thumb reach, 48px targets, high contrast                                |
| Faster than WhatsApp | Save & Next without going back to Home; numeric keypad; camera button prominent (§8.3)                             |
| Patchy network       | Saving never waits on the photo upload; uploads that are pending or failed are visible and can be retried (§41.12) |
| Distrust of guesses  | Show "Not enough history" and "Not sampled"; explain every estimate (PR-006/007)                                   |
| Short sessions       | The Home screen answers "what's happening now?" with quick actions, not charts (§16)                               |

---

## 🔗 Linked Artifacts

| Artifact           | Link                                             |
| ------------------ | ------------------------------------------------ |
| IA                 | `ux-docs/information-architecture/ia-diagram.md` |
| Sitemap            | `ux-docs/sitemaps/sitemap.md`                    |
| Plucking prototype | #26                                              |

---

_Last updated: 2026-10-03 | Created by: Aria (UX Agent) | Source: SRS v1.1 §1, §8–§13, §25_
