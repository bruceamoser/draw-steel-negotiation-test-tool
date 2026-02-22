/**
 * Draw Steel negotiation rules (v1.01b) — parameterized mechanics.
 * Derived from this repo's reference docs.
 * Keep labels short; avoid embedding long rule text.
 */

export const negotiationRules_v101b = {
  id: "draw-steel-v1.01b",

  structure: {
    kind: "freeform",
    maxRounds: null,
    stages: null,
  },

  npcDefaults: {
    interest: { min: 0, max: 5, start: 2 },
    patience: { min: 0, max: 5, start: 3 },
  },

  startingAttitudes: [
    { id: "hostile", label: "Hostile", interestStart: 1, patienceStart: 2 },
    { id: "suspicious", label: "Suspicious", interestStart: 2, patienceStart: 2 },
    { id: "neutral", label: "Neutral", interestStart: 2, patienceStart: 3 },
    { id: "open", label: "Open", interestStart: 3, patienceStart: 3 },
    { id: "friendly", label: "Friendly", interestStart: 3, patienceStart: 4 },
    { id: "trusting", label: "Trusting", interestStart: 3, patienceStart: 5 },
  ],

  motivations: [
    { id: "benevolence", label: "Benevolence" },
    { id: "discovery", label: "Discovery" },
    { id: "freedom", label: "Freedom" },
    { id: "greed", label: "Greed" },
    { id: "higherAuthority", label: "Higher Authority" },
    { id: "justice", label: "Justice" },
    { id: "legacy", label: "Legacy" },
    { id: "peace", label: "Peace" },
    { id: "power", label: "Power" },
    { id: "protection", label: "Protection" },
    { id: "revelry", label: "Revelry" },
    { id: "vengeance", label: "Vengeance" },
  ],

  // Same canonical list; whether an entry is a motivation or pitfall is NPC-specific.
  pitfalls: [
    { id: "benevolence", label: "Benevolence" },
    { id: "discovery", label: "Discovery" },
    { id: "freedom", label: "Freedom" },
    { id: "greed", label: "Greed" },
    { id: "higherAuthority", label: "Higher Authority" },
    { id: "justice", label: "Justice" },
    { id: "legacy", label: "Legacy" },
    { id: "peace", label: "Peace" },
    { id: "power", label: "Power" },
    { id: "protection", label: "Protection" },
    { id: "revelry", label: "Revelry" },
    { id: "vengeance", label: "Vengeance" },
  ],

  argumentTypes: [
    { id: "appealMotivation", label: "Appeal to motivation" },
    { id: "noMotivation", label: "No motivation/pitfall" },
    { id: "pitfallUsed", label: "Pitfall used" },
    { id: "custom", label: "Custom" },
  ],

  argumentResolution: {
    tiering: {
      method: "totalBands",
      bands: [
        { tier: 1, minTotal: -999, maxTotal: 11 },
        { tier: 2, minTotal: 12, maxTotal: 16 },
        { tier: 3, minTotal: 17, maxTotal: null },
      ],
    },

    profiles: {
      /**
       * Appeal to a not-yet-used motivation (and no pitfall).
       */
      appealNewMotivation: {
        byTier: {
          1: { interestDelta: 0, patienceDelta: -1 },
          2: { interestDelta: 1, patienceDelta: -1 },
          3: { interestDelta: 1, patienceDelta: 0 },
        },
      },

      /**
       * Appeal to a motivation that was already successfully appealed to.
       */
      appealUsedMotivation: {
        byTier: {
          1: { interestDelta: 0, patienceDelta: -1 },
          2: { interestDelta: 0, patienceDelta: -1 },
          3: { interestDelta: 0, patienceDelta: -1 },
        },
      },

      /**
       * No motivation or pitfall mentioned.
       */
      noMotivationOrPitfall: {
        byTier: {
          1: { interestDelta: -1, patienceDelta: -1 },
          2: { interestDelta: 0, patienceDelta: -1 },
          3: { interestDelta: 1, patienceDelta: -1 },
        },
        natural19or20PatienceNoLoss: true,
        repeatSameArgumentForcesTier1: true,
      },

      /**
       * Using a pitfall.
       */
      pitfallUsed: {
        automaticTier: 1,
        byTier: {
          1: { interestDelta: -1, patienceDelta: -1 },
          2: { interestDelta: -1, patienceDelta: -1 },
          3: { interestDelta: -1, patienceDelta: -1 },
        },
      },
    },

    caughtInLie: {
      // If a lie fails to increase interest, Director may impose additional interest -1.
      extraInterestPenalty: -1,
    },
  },

  discoveryTest: {
    id: "discoverMotivationOrPitfall",
    label: "Uncover motivations/pitfalls",
    byTier: {
      1: { patienceDelta: -1, learns: "none" },
      2: { patienceDelta: 0, learns: "none" },
      3: { patienceDelta: 0, learns: "one" },
    },
  },

  // Offer mapping based on current Interest.
  offersByInterest: {
    0: { id: "offer0", label: "No, and…" },
    1: { id: "offer1", label: "No." },
    2: { id: "offer2", label: "No, but…" },
    3: { id: "offer3", label: "Yes, but…" },
    4: { id: "offer4", label: "Yes." },
    5: { id: "offer5", label: "Yes, and…" },
  },

  endConditions: [
    { id: "interest0", label: "Interest 0", predicate: "interestAtOrBelow", trackKey: "interest", threshold: 0 },
    { id: "interest5", label: "Interest 5", predicate: "interestAtOrAbove", trackKey: "interest", threshold: 5 },
    { id: "patience0", label: "Patience 0", predicate: "patienceAtOrBelow", trackKey: "patience", threshold: 0 },
  ],

  outcomes: [
    {
      id: "offer0",
      label: "No, and…",
      publicTemplate: "{npcName}: No deal.",
      gmTemplate: "{npcName}: Interest 0 — negotiation ends.",
    },
    {
      id: "offer5",
      label: "Yes, and…",
      publicTemplate: "{npcName}: Best possible offer.",
      gmTemplate: "{npcName}: Interest 5 — final offer.",
    },
  ],
};
