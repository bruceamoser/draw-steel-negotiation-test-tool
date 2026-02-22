import test from "node:test";
import assert from "node:assert/strict";

import { negotiationRules_v101b as rules } from "../src/negotiation/rules/draw-steel-v1.01b.mjs";
import {
  computeTier,
  createDefaultNegotiationState,
  addParticipant,
  addTestEntry,
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

test("addTestEntry applies manual deltas", () => {
  const idFn = idFnFactory();
  let state = createDefaultNegotiationState(rules, { title: "T" });

  state = addParticipant(state, { id: "pc1", displayName: "PC", kind: "pc" }, rules, { idFn });
  state = addParticipant(state, { id: "npc1", displayName: "NPC", kind: "npc" }, rules, { idFn });

  const beforeInterest = state.npcStateByParticipantId.npc1.interest.value;
  const beforePatience = state.npcStateByParticipantId.npc1.patience.value;

  const { nextState, entry } = addTestEntry(state, {
    actorParticipantId: "pc1",
    targetNpcParticipantId: "npc1",
    summary: "Bargain",
    detailsGM: "",
    rollTotal: 10,
    rollVisibleToPlayers: true,
    interestDelta: -1,
    patienceDelta: -1,
    isRevealedToPlayers: true,
  }, { idFn });

  assert.ok(entry);
  assert.equal(entry.entryType, "test");
  assert.equal(entry.roll.total, 10);
  assert.equal(nextState.npcStateByParticipantId.npc1.interest.value, beforeInterest - 1);
  assert.equal(nextState.npcStateByParticipantId.npc1.patience.value, beforePatience - 1);
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

test("addDiscoveryEntry reveals chosen motivation", () => {
  const idFn = idFnFactory();
  let state = createDefaultNegotiationState(rules, { title: "T" });
  state = addParticipant(state, { id: "pc1", displayName: "PC", kind: "pc" }, rules, { idFn });
  state = addParticipant(state, { id: "npc1", displayName: "NPC", kind: "npc" }, rules, { idFn });

  state.npcStateByParticipantId.npc1.motivations = [
    { id: "power", label: "Power", isRevealed: false },
  ];

  const { nextState, entry } = addDiscoveryEntry(
    state,
    rules,
    {
      actorParticipantId: "pc1",
      targetNpcParticipantId: "npc1",
      kind: "motivation",
      detailId: "power",
      label: "",
      detailsGM: "",
      revealToPlayers: true,
      isRevealedToPlayers: true,
    },
    { idFn },
  );

  assert.ok(entry);
  assert.equal(entry.entryType, "reveal");
  assert.equal(entry.reveal.kind, "motivation");
  assert.equal(entry.reveal.id, "power");
  assert.equal(nextState.npcStateByParticipantId.npc1.motivations[0].isRevealed, true);
  assert.equal(entry.roll, null);
});
