import test from "node:test";
import assert from "node:assert/strict";

import { negotiationRules_v101b as rules } from "../src/negotiation/rules/draw-steel-v1.01b.mjs";
import {
  computeTier,
  createDefaultNegotiationState,
  addParticipant,
  addArgumentEntry,
  addDiscoveryEntry,
  redactForViewer,
} from "../src/negotiation/negotiation-engine.mjs";

function idFnFactory() {
  let n = 0;
  return () => `id_${++n}`;
}

test("computeTier uses v1.01b bands", () => {
  assert.equal(computeTier(rules, 11), 1);
  assert.equal(computeTier(rules, 12), 2);
  assert.equal(computeTier(rules, 16), 2);
  assert.equal(computeTier(rules, 17), 3);
});

test("addArgumentEntry applies no-motivation tier deltas", () => {
  const idFn = idFnFactory();
  let state = createDefaultNegotiationState(rules, { title: "T" });

  state = addParticipant(state, { id: "pc1", displayName: "PC", kind: "pc" }, rules, { idFn });
  state = addParticipant(state, { id: "npc1", displayName: "NPC", kind: "npc" }, rules, { idFn });

  const beforeInterest = state.npcStateByParticipantId.npc1.interest.value;
  const beforePatience = state.npcStateByParticipantId.npc1.patience.value;

  const { nextState, entry } = addArgumentEntry(
    state,
    rules,
    {
      actorParticipantId: "pc1",
      targetNpcParticipantId: "npc1",
      argumentTypeId: "noMotivation",
      summary: "Bargain",
      roll: { mode: "manualTotal", total: 10, visibleToPlayers: true }, // tier 1
      isRevealedToPlayers: true,
    },
    { idFn },
  );

  assert.ok(entry);
  assert.equal(entry.roll.tier, 1);
  assert.equal(nextState.npcStateByParticipantId.npc1.interest.value, beforeInterest - 1);
  assert.equal(nextState.npcStateByParticipantId.npc1.patience.value, beforePatience - 1);
});

test("repeat no-motivation summary forces tier 1", () => {
  const idFn = idFnFactory();
  let state = createDefaultNegotiationState(rules, { title: "T" });

  state = addParticipant(state, { id: "pc1", displayName: "PC", kind: "pc" }, rules, { idFn });
  state = addParticipant(state, { id: "npc1", displayName: "NPC", kind: "npc" }, rules, { idFn });

  const first = addArgumentEntry(
    state,
    rules,
    {
      actorParticipantId: "pc1",
      targetNpcParticipantId: "npc1",
      argumentTypeId: "noMotivation",
      summary: "Same pitch",
      roll: { mode: "manualTotal", total: 12, visibleToPlayers: true }, // tier 2
      isRevealedToPlayers: false,
    },
    { idFn },
  );

  const second = addArgumentEntry(
    first.nextState,
    rules,
    {
      actorParticipantId: "pc1",
      targetNpcParticipantId: "npc1",
      argumentTypeId: "noMotivation",
      summary: "Same pitch",
      roll: { mode: "manualTotal", total: 17, visibleToPlayers: true }, // would be tier 3
      isRevealedToPlayers: false,
    },
    { idFn },
  );

  assert.equal(second.entry.roll.tier, 1);
});

test("redactForViewer strips GM-only fields and unrevealed NPC details", () => {
  const idFn = idFnFactory();
  let state = createDefaultNegotiationState(rules, { title: "T" });
  state.setup.contextGM = "secret";
  state.setup.visibility.showInterest = "range";
  state.setup.visibility.showPatience = "hidden";

  state = addParticipant(state, { id: "npc1", displayName: "Countess", kind: "npc", notesGM: "gm" }, rules, { idFn });
  state.npcStateByParticipantId.npc1.motivations = [
    { id: "power", label: "Power", isRevealed: false },
    { id: "justice", label: "Justice", isRevealed: true },
  ];
  state.npcStateByParticipantId.npc1.pitfalls = [{ id: "greed", label: "Greed", isRevealed: false }];

  const redacted = redactForViewer(state, { isGM: false });

  assert.equal(redacted.setup.contextGM, "");
  assert.equal(redacted.participants[0].notesGM, "");
  assert.equal(redacted.npcStateByParticipantId.npc1.patience, null);
  assert.equal(redacted.npcStateByParticipantId.npc1.motivations.length, 1);
  assert.equal(redacted.npcStateByParticipantId.npc1.motivations[0].id, "justice");
});

test("addDiscoveryEntry applies patience delta and can reveal one motivation", () => {
  const idFn = idFnFactory();
  let state = createDefaultNegotiationState(rules, { title: "T" });
  state = addParticipant(state, { id: "pc1", displayName: "PC", kind: "pc" }, rules, { idFn });
  state = addParticipant(state, { id: "npc1", displayName: "NPC", kind: "npc" }, rules, { idFn });

  state.npcStateByParticipantId.npc1.motivations = [
    { id: "power", label: "Power", isRevealed: false },
  ];

  const beforePatience = state.npcStateByParticipantId.npc1.patience.value;

  const { nextState, entry } = addDiscoveryEntry(
    state,
    rules,
    {
      actorParticipantId: "pc1",
      targetNpcParticipantId: "npc1",
      revealToPlayers: true,
      roll: { mode: "manualTotal", total: 17, visibleToPlayers: true }, // tier 3
      isRevealedToPlayers: true,
    },
    { idFn },
  );

  assert.ok(entry);
  assert.equal(entry.entryType, "reveal");
  assert.equal(entry.roll.tier, 3);
  assert.equal(entry.reveal.kind, "motivation");
  assert.equal(entry.reveal.id, "power");
  assert.equal(nextState.npcStateByParticipantId.npc1.motivations[0].isRevealed, true);
  assert.equal(nextState.npcStateByParticipantId.npc1.patience.value, beforePatience);
});
