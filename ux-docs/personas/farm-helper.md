# 👤 Persona: Saman, the Farm Helper (secondary)

> _"Show me which tree and where to type the number. I don't want to break anything."_

Role in the product: **Tenant MEMBER**. Whether helpers or pluckers will enter data themselves is still an open question (SRS Q-008, #27). This persona keeps that option designed for.

---

## 📋 Profile

| Field                | Detail                                                              |
| -------------------- | ------------------------------------------------------------------- |
| **Name**             | Saman (fictional)                                                   |
| **Age**              | 25–60                                                               |
| **Occupation**       | Part-time farm helper or coconut plucker                            |
| **Location**         | Near the farm                                                       |
| **Devices**          | Entry-level Android phone, often a shared device; limited data plan |
| **Language**         | Sinhala first; reads basic English (Sinhala UI planned, §25.6)      |
| **Tech Proficiency** | ⭐⭐☆☆☆ (2/5): WhatsApp and the camera, little else                 |

---

## 🎯 Goals

### Primary Goal

> Record the trees harvested today (tree, photo, count) correctly with as little reading as possible.

### Secondary Goals

- See the trees to harvest today (the owner's planned round).
- Record household use or damaged coconuts when asked.

---

## 😤 Frustrations & Pain Points

- **Text-heavy screens** and English-only labels.
- **Fear of mistakes:** worried about deleting or changing something important.
- **Small buttons** with wet or dirty hands.

---

## 💡 Motivations

| Motivation                            | Strength        |
| ------------------------------------- | --------------- |
| Doing the job correctly for the owner | █████████░ High |
| Finishing quickly                     | ████████░░ High |
| Learning a new app                    | ███░░░░░░░ Low  |

---

## 🧠 Behaviors & Habits

- Sends photos and voice notes on WhatsApp rather than typing.
- Follows instructions step by step and rarely explores menus.

---

## 📖 Scenario

> The owner starts the round and hands Saman the phone. The capture screen shows a large tree number, a camera button and a number pad. Saman photographs each pile, types the count and taps **Save & Next**. Saman cannot archive trees, change members or delete the tenant, because the MEMBER role blocks those actions on the server (§4.3, US-027).

---

## 🧭 Design implications

- The capture flow relies on icons, large numbers and short labels, and is translation-ready.
- Destructive actions are hidden from MEMBER/VIEWER and enforced on the server.
- Confirmations are kept for irreversible actions only. Everyday saves are instant and can be undone where practical.

---

_Last updated: 2026-10-03 | Created by: Aria (UX Agent) | Source: SRS v1.1 §4.3, §25, Q-008_
