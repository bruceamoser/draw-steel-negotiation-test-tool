# Draw Steel – Negotiation Test Tool (Design + Implementation Spec)

> Architecture note: Use the existing Montage Test Tool implementation **only** as a pattern for Foundry module wiring, Item type registration, sheet/templates, localization, and visibility handling.  
> Rules note: **All mechanics must be derived from the rules in this repo’s `reference/` docs**. Do not copy-paste large verbatim rule text into code or docs; encode mechanics as **parameters and short labels**.

---

## 1) Goal / Success Criteria

### 1.1 Goal
Add a new Foundry VTT (v13) Item type for the Draw Steel system that allows a GM to **run, track, and resolve Negotiation tests** with:
- participants (PCs + NPCs)
- rule-driven state tracking (including *Interest* and *Patience*, plus any other rule-defined elements)
- argument/action logging
- controlled player visibility (reveal timing)
- a final result summary (public + GM)

### 1.2 Non-goals (hard constraints)
- No automated application of outcomes to Actors (no conditions/items/resources changes).
- Rolls must be optional: the tool must function with **manual totals**.
- No system/rules changes; only implement the negotiation subsystem as specified by the rules doc(s).

---

## 2) Rule Source of Truth & Extraction Requirements (must be completed before coding)

### 2.1 Rule sources in this repo
- `reference/draw-steel-docs/_extracted/draw_steel_heroes_v1.01b.md`
- `reference/draw-steel-docs/DRAW-STEEL-SCHEMA-REFERENCE.md` (if it defines structured meanings relevant to negotiation)

### 2.2 Extraction checklist (agent must fill these from the docs)
Search the extracted markdown for headings/keywords (case-insensitive):
- `Negotiation`
- `Interest`
- `Patience`
- `Motivation`
- `Pitfall`
- `Argument`

From those sections, extract and record (in code constants; see §4):
1. **Structure**: rounds/stages/freeform; how progression happens; any caps (e.g., max rounds)
2. **Participants**: required NPC count, whether multiple NPCs/factions are allowed, roles (lead/support), any limits
3. **State variables / tracks**: which tracks exist; min/max/start; display guidance (if any)
4. **Argument mechanics**:
   - what defines an argument
   - success tiers or other outcome bands
   - how each tier affects tracks (Interest/Patience etc.)
   - how motivations/pitfalls modify outcomes
5. **Discovery**:
   - how motivations/pitfalls are selected for NPCs
   - how they are discovered/revealed (tests, thresholds, actions)
6. **End conditions**: success/failure/degree of success and what they depend on
7. **Visibility**: anything explicitly stated as hidden or revealable

> If any of the above are ambiguous or have optional variants in the rules, implement them as **explicit Settings** on the Item, with rule-correct defaults.

---

## 3) Functional Requirements (table workflow)

### 3.1 GM workflow
1. Create a `negotiationTest` Item.
2. Add participants (drag/drop Actors; add NPCs with or without Actor linkage).
3. Configure negotiation setup (stakes, visibility, structure per rules).
4. Run negotiation:
   - advance round/stage (if applicable)
   - add Arguments (entries) and record outcomes
   - apply track changes (rule-driven default deltas; GM can override)
   - reveal motivations/pitfalls and/or entries as needed
5. Resolve and post summary:
   - compute outcome per end conditions
   - post **public** summary to chat
   - optionally whisper **GM** details to GM

### 3.2 Player workflow
- View the item sheet (redacted) and see only:
  - public stakes/context
  - revealed tracks (as configured)
  - revealed motivations/pitfalls
  - revealed entries and any visible roll totals

---

## 4) Rules Configuration (single source of mechanics)

### 4.1 Requirement
All mechanics must live in a single module (or JSON) consumed by the engine. No “magic numbers” in UI code.

### 4.2 File and export (required)
Create:
- `src/negotiation/rules/draw-steel-v1.01b.mjs`

Export an object shaped like:

```js
export const negotiationRules_v101b = {
  id: "draw-steel-v1.01b",

  structure: {
    kind: "rounds" | "stages" | "freeform",
    maxRounds: null | number,
    stages: null | Array<{ id: string, label: string }>
  },

  npcDefaults: {
    interest: { min: number, max: number, start: number },
    patience: { min: number, max: number, start: number }
  },

  // Short labels only; do not paste long rule text.
  motivations: Array<{ id: string, label: string }>,
  pitfalls: Array<{ id: string, label: string }>,

  argumentTypes: Array<{
    id: string,
    label: string,
    notes?: string
  }>,

  // How arguments translate into deltas, discovery, and end checks.
  argumentResolution: {
    tiering: {
      method: "totalBands" | "other",
      // If totalBands, fill with rule-defined bands.
      bands?: Array<{ tier: number, minTotal: number, maxTotal: number | null }>
    },

    byTier: Record<number, {
      interestDelta: number,
      patienceDelta: number,
      // Optional: discovery/reveal effects per tier if rules specify.
      discovery?: {
        revealMotivationChance?: number,
        revealPitfallChance?: number
      }
    }>,

    motivationBonus?: {
      // rule-defined behavior; can be deltas or tier shifts
      interestDelta?: number,
      patienceDelta?: number
    },

    pitfallPenalty?: {
      interestDelta?: number,
      patienceDelta?: number
    }
  },

  endConditions: Array<{
    id: string,
    label: string,
    // Implemented in engine as named predicates.
    predicate: "interestAtOrAbove" | "patienceAtOrBelow" | "custom",
    trackKey?: "interest" | "patience" | string,
    threshold?: number,
    outcomeId: string
  }>,

  outcomes: Array<{
    id: string,
    label: string,
    // Short templates; engine fills placeholders.
    publicTemplate: string,
    gmTemplate: string
  }>
};
```

---

## 5) Item Data Model (schema v1)

> Store under the same location the Montage tool uses for custom state (either `item.system.*` if the system allows, or module flags). Use `schemaVersion` and migration support.

### 5.1 Root
- `schemaVersion: 1`
- `title: string`
- `createdAtIso: string`
- `createdByUserId: string`

### 5.2 Setup
- `setup.stakes.success: string`
- `setup.stakes.failure: string`
- `setup.contextPublic: string`
- `setup.contextGM: string` (GM-only)
- `setup.rulesProfileId: "draw-steel-v1.01b"`
- `setup.structure.kind: "rounds" | "stages" | "freeform"`
- `setup.structure.maxRounds?: number`
- `setup.structure.stages?: Array<{id,label}>`
- `setup.visibility`:
  - `showNpcNames: boolean`
  - `showInterest: "hidden" | "value" | "range"`
  - `showPatience: "hidden" | "value" | "range"`
  - `showArgumentDetails: boolean`
  - `showRollTotals: boolean`

### 5.3 Participants
`participants[]`:
- `id: string` (generated stable id)
- `actorUuid?: string`
- `displayName: string`
- `kind: "pc" | "npc"`
- `role: string` (rule-defined default + editable)
- `isActive: boolean`
- `notesGM?: string` (GM-only)

### 5.4 NPC State (per NPC participant)
`npcStateByParticipantId[participantId]`:
- `interest: { value, min, max }`
- `patience: { value, min, max }`
- `motivations[]: { id, label, isRevealed, notesGM? }`
- `pitfalls[]: { id, label, isRevealed, notesGM? }`
- `discovered: { motivations: string[], pitfalls: string[] }`

### 5.5 Timeline / Entries
`timeline[]` (rounds/stages/freeform segments):
- `id, index, label`
- `entries[]`:
  - `id, timestampIso`
  - `actorParticipantId`
  - `targetNpcParticipantId`
  - `entryType: "argument" | "reveal" | "note" | "adjustment"`
  - `argument?`:
    - `argumentTypeId`
    - `summary` (public)
    - `detailsGM` (GM-only)
    - `claimedMotivationId?`
    - `triggeredPitfallId?`
  - `roll?`:
    - `mode: "none" | "manualTotal" | "foundryRoll"`
    - `formula?`
    - `total?`
    - `tier?`
    - `visibleToPlayers: boolean`
  - `effects[]`:
    - `stat: "interest" | "patience" | string`
    - `delta: number`
    - `appliedToNpcParticipantId: string`
    - `reason: string`
    - `visibleToPlayers: boolean`
  - `isRevealedToPlayers: boolean`

### 5.6 Resolution
`resolution`:
- `status: "notStarted" | "inProgress" | "success" | "failure" | "ended"`
- `outcomeId?: string`
- `summaryPublic: string`
- `summaryGM: string`
- `resolvedAtIso?: string`

---

## 6) Engine API (pure functions + document updates)

### 6.1 Required pure functions
- `createDefaultNegotiationState(rules)`
- `addParticipant(state, participant)`
- `startNegotiation(state, rules)`
- `advanceStructure(state, rules)` (next round/stage if applicable)
- `computeTier(rules, rollTotal)` (uses rules-configured tiering)
- `addArgumentEntry(state, rules, payload)` → `{ nextState, entry, effectsApplied }`
- `applyEffects(state, effects)` (track adjustments)
- `evaluateEndConditions(state, rules)` → `{ status, outcomeId } | null`
- `renderPublicSummary(state, rules)` → `string`
- `renderGmSummary(state, rules)` → `string`
- `redactForViewer(state, viewer)` (optional helper for UI rendering)

### 6.2 Update model
- Use `Item.update()` to persist the entire state changes atomically.
- Avoid frequent micro-updates; apply batched updates per user action.

---

## 7) UI Specification (Negotiation Test Item Sheet)

### 7.1 Tabs (required)
1. **Overview**
   - status, current round/stage label
   - stakes, public context
   - NPC track displays (Interest/Patience) respecting visibility
   - actions: Start / Next / Resolve / Post Summary / Copy Summary
2. **Participants**
   - drag/drop Actors to add
   - “Add NPC (no Actor)” button
   - role, active toggle, remove
3. **NPC Profile** (GM-only content; players see only revealed)
   - Interest/Patience editing (GM)
   - motivations/pitfalls lists with reveal toggles
   - GM notes
4. **Arguments / Timeline**
   - timeline grouped by segment (round/stage)
   - add argument:
     - actor (PC) select
     - target NPC select
     - argument type select + custom
     - roll entry (none/manual total/formula)
     - computed tier + preview deltas
     - set “matches motivation” / “triggers pitfall” if rules call for it
     - create entry; optionally reveal; optionally post to chat
5. **Result**
   - computed outcome + editable summaries
6. **Settings**
   - rules profile id (if future profiles)
   - visibility options
   - “allow editing previous entries” toggle

### 7.2 Chat cards
- Post argument entry (public-safe)
- Post final summary (public-safe)
- GM whisper includes GM-only details

---

## 8) Visibility / Security Rules (must enforce)
- GM-only fields never render for non-GM users.
- Unrevealed motivations/pitfalls are hidden to players.
- Roll totals/details are shown only if configured visible.
- Public chat messages must be sanitized (no GM-only fields).

---

## 9) Module Integration Requirements

### 9.1 module.json changes
- Add `documentTypes.Item.negotiationTest`
- Add `styles/negotiation.css`

### 9.2 Suggested file layout
- `src/negotiation/negotiation-test-sheet.mjs`
- `src/negotiation/negotiation-engine.mjs`
- `src/negotiation/negotiation-state.mjs` (defaults + migrations)
- `src/negotiation/negotiation-chat.mjs`
- `src/negotiation/rules/draw-steel-v1.01b.mjs`
- `templates/items/negotiation-test/*.hbs`
- `styles/negotiation.css`
- `lang/en.json` additions

---

## 10) Testing Requirements

### 10.1 Unit tests (engine)
- tier computation (rule bands)
- argument tier → delta mapping
- end condition evaluation success and failure
- redaction/visibility helper behavior

### 10.2 Manual Foundry test script
- GM creates negotiation, adds PC and NPC, sets motivations/pitfalls, adds three arguments, advances structure, resolves, posts summary.
- Player views same item: verify redaction and reveal toggles.

---

## 11) Acceptance Criteria (definition of done)
- Creating and using `negotiationTest` works without console errors.
- All state persists via the Item; reload-safe.
- Outcome evaluation matches the parameterized rules config.
- No actor state changes occur.
- Player view and chat output are correctly redacted.

---

## 12) Implementation Notes (guardrails)
- Keep logs compact; avoid storing large text blobs repeatedly.
- Store only short labels for motivations/pitfalls/argument types; do not embed long rule text.
- If any rule detail is uncertain, implement as a visible configurable setting with a safe default and a warning banner indicating it is configurable.

---