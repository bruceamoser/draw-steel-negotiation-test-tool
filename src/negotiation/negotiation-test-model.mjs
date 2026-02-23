/**
 * Negotiation Test Item Data Model
 * Foundry VTT v13+ TypeDataModel for Item type: "draw-steel-negotiation.negotiationTest".
 */

import { NEGOTIATION_TEST_ITEM_TYPE } from "../config.mjs";
import { getRulesProfile } from "./negotiation-state.mjs";
import { createDefaultNegotiationState } from "./negotiation-engine.mjs";

export { NEGOTIATION_TEST_ITEM_TYPE };

export class NegotiationTestDataModel extends foundry.abstract.TypeDataModel {
  static metadata = {
    packOnly: false,
    invalidActorTypes: [],
  };

  static defineSchema() {
    const fields = foundry.data.fields;

    const segmentSchema = new fields.SchemaField({
      id: new fields.StringField({ required: true, blank: false, initial: "_" }),
      index: new fields.NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      label: new fields.StringField({ required: true, blank: true, initial: "" }),
      entries: new fields.ArrayField(new fields.ObjectField({ required: true, initial: {} }), { required: true, initial: [] }),
    });

    const participantSchema = new fields.SchemaField({
      id: new fields.StringField({ required: true, blank: false, initial: "_" }),
      actorUuid: new fields.StringField({ required: false, blank: true, initial: "" }),
      displayName: new fields.StringField({ required: true, blank: true, initial: "" }),
      kind: new fields.StringField({ required: true, initial: "npc", choices: ["pc", "npc"] }),
      role: new fields.StringField({ required: false, blank: true, initial: "" }),
      isActive: new fields.BooleanField({ required: true, initial: true }),
      notesGM: new fields.StringField({ required: false, blank: true, initial: "" }),
    });

    return {
      schemaVersion: new fields.NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      title: new fields.StringField({ required: false, blank: true, initial: "" }),
      createdAtIso: new fields.StringField({ required: false, blank: true, initial: "" }),
      createdByUserId: new fields.StringField({ required: false, blank: true, initial: "" }),

      setup: new fields.SchemaField({
        overview: new fields.StringField({ required: false, blank: true, initial: "" }),
        outcomes: new fields.SchemaField({
          success: new fields.StringField({ required: false, blank: true, initial: "" }),
          partialSuccess: new fields.StringField({ required: false, blank: true, initial: "" }),
          failure: new fields.StringField({ required: false, blank: true, initial: "" }),
        }),
        rulesProfileId: new fields.StringField({ required: true, blank: false, initial: "draw-steel-v1.01b" }),
        structure: new fields.SchemaField({
          kind: new fields.StringField({ required: true, initial: "freeform", choices: ["rounds", "stages", "freeform"] }),
          maxRounds: new fields.NumberField({ required: false, nullable: true, integer: true, min: 1, initial: null }),
          stages: new fields.ArrayField(
            new fields.SchemaField({
            id: new fields.StringField({ required: true, blank: false, initial: "_" }),
              label: new fields.StringField({ required: true, blank: true, initial: "" }),
            }),
            { required: false, initial: [] },
          ),
        }),
        visibility: new fields.SchemaField({
          showNpcNames: new fields.BooleanField({ required: true, initial: true }),
          showInterest: new fields.StringField({ required: true, initial: "value", choices: ["hidden", "value", "range"] }),
          showPatience: new fields.StringField({ required: true, initial: "value", choices: ["hidden", "value", "range"] }),
          showArgumentDetails: new fields.BooleanField({ required: true, initial: true }),
          showRollTotals: new fields.BooleanField({ required: true, initial: true }),
        }),
        allowEditingPreviousEntries: new fields.BooleanField({ required: true, initial: false }),
      }),

      participants: new fields.ArrayField(participantSchema, { required: true, initial: [] }),
      npcStateByParticipantId: new fields.ObjectField({ required: true, initial: {} }),
      timeline: new fields.ArrayField(segmentSchema, { required: true, initial: [] }),

      resolution: new fields.SchemaField({
        status: new fields.StringField({ required: true, initial: "notStarted", choices: ["notStarted", "inProgress", "success", "failure", "ended"] }),
        outcomeId: new fields.StringField({ required: false, blank: true, initial: "" }),
        summaryPublic: new fields.StringField({ required: false, blank: true, initial: "" }),
        summaryGM: new fields.StringField({ required: false, blank: true, initial: "" }),
        resolvedAtIso: new fields.StringField({ required: false, blank: true, initial: "" }),
      }),
    };
  }

  /**
   * Ensure newly-created items have a fully initialized state.
   */
  prepareBaseData() {
    super.prepareBaseData();

    // If this is a fresh item (no participants, no createdAt), seed defaults.
    if (!this.createdAtIso) {
      const rules = getRulesProfile(this.setup?.rulesProfileId);
      const seeded = createDefaultNegotiationState(rules, {
        title: this.title ?? "",
        createdByUserId: game.user?.id ?? "",
      });
      Object.assign(this, seeded);
    }

    // Ensure NPC state exists for every NPC participant.
    const rules = getRulesProfile(this.setup?.rulesProfileId);
    this.npcStateByParticipantId ??= {};
    const interestDefaults = rules?.npcDefaults?.interest ?? { min: 0, max: 5, start: 2 };
    const patienceDefaults = rules?.npcDefaults?.patience ?? { min: 0, max: 5, start: 3 };
    for (const p of (this.participants ?? [])) {
      if (!p?.id) continue;
      if (p.kind !== "npc") continue;
      if (this.npcStateByParticipantId[p.id]) continue;
      this.npcStateByParticipantId[p.id] = {
        interest: {
          value: Math.max(interestDefaults.min, Math.min(interestDefaults.max, interestDefaults.start)),
          min: interestDefaults.min,
          max: interestDefaults.max,
        },
        patience: {
          value: Math.max(patienceDefaults.min, Math.min(patienceDefaults.max, patienceDefaults.start)),
          min: patienceDefaults.min,
          max: patienceDefaults.max,
        },
        motivations: [],
        pitfalls: [],
        discovered: { motivations: [], pitfalls: [] },
      };
    }
  }
}
