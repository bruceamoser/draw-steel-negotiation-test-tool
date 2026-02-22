import { negotiationRules_v101b } from "./rules/draw-steel-v1.01b.mjs";

export const RULES_PROFILES = {
  [negotiationRules_v101b.id]: negotiationRules_v101b,
};

export function getRulesProfile(profileId) {
  return RULES_PROFILES[profileId] ?? negotiationRules_v101b;
}

/**
 * Migrate a raw state object to schema v1 (best-effort, non-destructive).
 * @param {any} raw
 * @returns {object}
 */
export function migrateState(raw) {
  const state = (raw && typeof raw === "object") ? raw : {};
  const schemaVersion = Number(state.schemaVersion ?? 1);
  if (schemaVersion === 1) return state;
  // Future schema migrations would go here.
  return { ...state, schemaVersion: 1 };
}
