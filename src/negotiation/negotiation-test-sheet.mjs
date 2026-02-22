/**
 * Negotiation Test Item Sheet
 */

import { MODULE_ID } from "../config.mjs";
import { negotiationRules_v101b } from "./rules/draw-steel-v1.01b.mjs";
import {
  addParticipant,
  addTestEntry,
  addNoteEntry,
  addDiscoveryEntry,
  advanceStructure,
  startNegotiation,
  evaluateEndConditions,
  renderPublicSummary,
  renderGmSummary,
  redactForViewer,
} from "./negotiation-engine.mjs";
import { getRulesProfile } from "./negotiation-state.mjs";

const ItemSheetV1 = foundry.appv1?.sheets?.ItemSheet ?? ItemSheet;

function _currentSegment(system) {
  const t = system.timeline ?? [];
  return t.length ? t[t.length - 1] : null;
}

function _interestDisplay(system, npcState) {
  const show = system?.setup?.visibility?.showInterest ?? "hidden";
  if (!npcState?.interest) return null;
  if (show === "hidden") return null;
  if (show === "range") return npcState.interest.display ?? "";
  return String(npcState.interest.value ?? "");
}

function _patienceDisplay(system, npcState) {
  const show = system?.setup?.visibility?.showPatience ?? "hidden";
  if (!npcState?.patience) return null;
  if (show === "hidden") return null;
  if (show === "range") return npcState.patience.display ?? "";
  return String(npcState.patience.value ?? "");
}

export class NegotiationTestSheet extends ItemSheetV1 {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["negotiation-app", "negotiation-test-sheet"],
      width: 760,
      height: 760,
      submitOnClose: true,
      tabs: [{ navSelector: ".tabs", contentSelector: ".tab-content", initial: "overview" }],
    });
  }

  get template() {
    return `modules/${MODULE_ID}/templates/items/negotiation-test/negotiation-test-sheet.hbs`;
  }

  async getData(options = {}) {
    const data = super.getData(options);

    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);

    const viewState = redactForViewer(this.item.system, { isGM: game.user.isGM });
    const system = viewState;

    const currentSeg = _currentSegment(system);
    const statusKey = system.resolution?.status ?? "notStarted";
    const statusLabel = game.i18n.localize(`NEGOTIATION.Status.${statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}`);

    const participants = (system.participants ?? []).map((p, index) => ({ ...p, index }));
    const pcOptions = participants.filter((p) => p.kind === "pc").map((p) => ({ id: p.id, label: p.displayName }));
    const npcOptions = participants.filter((p) => p.kind === "npc").map((p) => ({
      id: p.id,
      label: p.displayName,
      selected: p.id === (this._selectedNpcId ?? null),
    }));

    if (!this._selectedNpcId && npcOptions.length) this._selectedNpcId = npcOptions[0].id;
    const selectedNpcState = this._selectedNpcId ? (system.npcStateByParticipantId ?? {})[this._selectedNpcId] : null;
    const selectedNpcParticipant = participants.find((p) => p.id === this._selectedNpcId) ?? null;
    const selectedNpcIndex = (selectedNpcParticipant && Number.isInteger(selectedNpcParticipant.index)) ? selectedNpcParticipant.index : null;
    const selectedNpc = selectedNpcState ? {
      id: this._selectedNpcId,
      participantIndex: selectedNpcIndex,
      hasParticipantIndex: selectedNpcIndex !== null,
      participantNotesGM: selectedNpcParticipant?.notesGM ?? "",
      interest: selectedNpcState.interest,
      patience: selectedNpcState.patience,
      motivations: selectedNpcState.motivations ?? [],
      pitfalls: selectedNpcState.pitfalls ?? [],
    } : null;

    const npcSummaries = npcOptions.map((o) => {
      const npcState = (system.npcStateByParticipantId ?? {})[o.id];
      return {
        id: o.id,
        name: o.label,
        interestDisplay: _interestDisplay(system, npcState),
        patienceDisplay: _patienceDisplay(system, npcState),
        offerLabel: rules?.offersByInterest?.[Number(npcState?.interest?.value ?? 0)]?.label ?? "",
      };
    });

    const timeline = (system.timeline ?? []).map((seg) => ({
      ...seg,
      entries: (seg.entries ?? []).map((e) => {
        const a = participants.find((p) => p.id === e.actorParticipantId);
        const t = participants.find((p) => p.id === e.targetNpcParticipantId);
        const effectsText = (e.effects ?? []).map((x) => `${x.stat} ${x.delta > 0 ? "+" : ""}${x.delta}`).join(", ");

        let summary = "";
        if (e.entryType === "test") summary = e.test?.summary ?? "";
        else if (e.entryType === "note") summary = e.note?.summary ?? "";
        else if (e.entryType === "reveal") {
          const k = e.reveal?.kind;
          const label = e.reveal?.label;
          summary = (k && label) ? `Revealed ${k}: ${label}` : "Discovery";
        }

        return {
          ...e,
          actorName: a?.displayName ?? "",
          targetName: t?.displayName ?? "",
          summary,
          rollTier: e.roll?.tier ?? null,
          effectsText,
        };
      }),
    }));

    const outcome = evaluateEndConditions(this.item.system, rules);
    const outcomeLabel = outcome?.outcomeId
      ? (rules?.offersByInterest?.[Number(((this.item.system.npcStateByParticipantId ?? {})[outcome.npcId]?.interest?.value) ?? 0)]?.label
        ?? outcome.outcomeId)
      : "";
    const motivationOptions = (rules?.motivations ?? negotiationRules_v101b.motivations).map((m) => ({ id: m.id, label: m.label }));
    const pitfallOptions = (rules?.pitfalls ?? negotiationRules_v101b.pitfalls).map((p) => ({ id: p.id, label: p.label }));

    return {
      ...data,
      isGM: game.user.isGM,
      system,
      statusLabel,
      currentSegmentLabel: currentSeg?.label ?? "",
      participants,
      pcOptions,
      npcOptions,
      selectedNpc,
      npcSummaries,
      timeline,
      outcomeLabel,
      motivationOptions,
      pitfallOptions,
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".neg-action").on("click", this.#onAction.bind(this));
    html.find('select[name="neg-selected-npc"]').on("change", (ev) => {
      this._selectedNpcId = ev.currentTarget.value;
      this.render();
    });

    // Enable Actor drag/drop on the sheet.
    html.on("drop", this.#onDrop.bind(this));
  }

  async #onDrop(event) {
    if (!game.user.isGM) return;
    event.preventDefault();
    const data = TextEditor.getDragEventData(event);
    if (!data) return;

    if (data.type !== "Actor") return;
    const actor = await fromUuid(data.uuid);
    if (!actor) return;

    const kind = actor.type === "character" ? "pc" : "npc";

    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);
    const updated = addParticipant(this.item.system, {
      actorUuid: data.uuid,
      displayName: actor.name,
      kind,
      role: "",
      isActive: true,
    }, rules, { idFn: () => foundry.utils.randomID() });

    await this.item.update({ system: updated });
  }

  async #onAction(event) {
    event.preventDefault();
    const action = event.currentTarget?.dataset?.action;
    if (!action) return;

    if (["copySummary"].includes(action)) {
      return this.#copySummary();
    }
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.OnlyGM"));
      return;
    }

    switch (action) {
      case "addNpcNoActor":
        return this.#addNpcNoActor();
      case "removeParticipant":
        return this.#removeParticipant(event.currentTarget.dataset.participantId);
      case "startNegotiation":
        return this.#start();
      case "advanceStructure":
        return this.#advance();
      case "addTestEntry":
        return this.#addTest();
      case "addNoteEntry":
        return this.#addNote();
      case "addDiscoveryEntry":
        return this.#addDiscovery();
      case "addNpcMotivation":
        return this.#addNpcMotivation();
      case "removeNpcMotivation":
        return this.#removeNpcMotivation(event.currentTarget.dataset.index);
      case "addNpcPitfall":
        return this.#addNpcPitfall();
      case "removeNpcPitfall":
        return this.#removeNpcPitfall(event.currentTarget.dataset.index);
      case "resolveNegotiation":
        return this.#resolve();
      default:
        return;
    }
  }

  async #addNpcNoActor() {
    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);
    const updated = addParticipant(this.item.system, {
      displayName: "NPC",
      kind: "npc",
      role: "",
      isActive: true,
    }, rules, { idFn: () => foundry.utils.randomID() });
    await this.item.update({ system: updated });
  }

  async #removeParticipant(participantId) {
    const system = foundry.utils.deepClone(this.item.system);
    system.participants = (system.participants ?? []).filter((p) => p.id !== participantId);
    if (system.npcStateByParticipantId) delete system.npcStateByParticipantId[participantId];
    await this.item.update({ system });
  }

  async #start() {
    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);
    const next = startNegotiation(this.item.system, rules, { idFn: () => foundry.utils.randomID() });
    await this.item.update({ system: next });
  }

  async #advance() {
    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);
    const next = advanceStructure(this.item.system, rules, { idFn: () => foundry.utils.randomID() });
    await this.item.update({ system: next });
  }

  async #addTest() {
    const root = this.element?.[0] ?? this.element;
    if (!root) return;

    const actorId = root.querySelector('select[name="neg-test-actor"]')?.value;
    const targetId = root.querySelector('select[name="neg-test-target"]')?.value;
    const summary = root.querySelector('input[name="neg-test-summary"]')?.value ?? "";
    const detailsGM = root.querySelector('textarea[name="neg-test-details"]')?.value ?? "";
    const totalStr = root.querySelector('input[name="neg-test-total"]')?.value;
    const total = totalStr === "" || totalStr === undefined ? null : Number(totalStr);
    const rollVisible = !!root.querySelector('input[name="neg-test-roll-visible"]')?.checked;
    const interestDelta = Number(root.querySelector('input[name="neg-test-interest"]')?.value ?? 0);
    const patienceDelta = Number(root.querySelector('input[name="neg-test-patience"]')?.value ?? 0);
    const reveal = !!root.querySelector('input[name="neg-test-reveal"]')?.checked;

    const { nextState } = addTestEntry(this.item.system, {
      actorParticipantId: actorId,
      targetNpcParticipantId: targetId,
      summary,
      detailsGM,
      rollTotal: total,
      rollVisibleToPlayers: rollVisible,
      interestDelta,
      patienceDelta,
      isRevealedToPlayers: reveal,
    }, { idFn: () => foundry.utils.randomID() });

    await this.item.update({ system: nextState });
  }

  async #addNote() {
    const root = this.element?.[0] ?? this.element;
    if (!root) return;

    const summary = root.querySelector('input[name="neg-note-summary"]')?.value ?? "";
    const detailsGM = root.querySelector('textarea[name="neg-note-details"]')?.value ?? "";
    const reveal = !!root.querySelector('input[name="neg-note-reveal"]')?.checked;

    const { nextState } = addNoteEntry(this.item.system, {
      summary,
      detailsGM,
      isRevealedToPlayers: reveal,
    }, { idFn: () => foundry.utils.randomID() });

    await this.item.update({ system: nextState });
  }

  async #addDiscovery() {
    const root = this.element?.[0] ?? this.element;
    if (!root) return;

    const actorId = root.querySelector('select[name="neg-disc-actor"]')?.value;
    const targetId = root.querySelector('select[name="neg-disc-target"]')?.value;
    const kind = root.querySelector('select[name="neg-disc-kind"]')?.value ?? "";
    const motivationId = root.querySelector('select[name="neg-disc-motivation"]')?.value ?? "";
    const pitfallId = root.querySelector('select[name="neg-disc-pitfall"]')?.value ?? "";
    const detailId = kind === "pitfall" ? pitfallId : motivationId;
    const detailsGM = root.querySelector('textarea[name="neg-disc-details"]')?.value ?? "";
    const reveal = !!root.querySelector('input[name="neg-disc-reveal"]')?.checked;

    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);
    const { nextState } = addDiscoveryEntry(this.item.system, rules, {
      actorParticipantId: actorId,
      targetNpcParticipantId: targetId,
      kind,
      detailId,
      label: "",
      detailsGM,
      revealToPlayers: reveal,
      isRevealedToPlayers: reveal,
    }, { idFn: () => foundry.utils.randomID() });

    await this.item.update({ system: nextState });
  }

  async #resolve() {
    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);
    const outcome = evaluateEndConditions(this.item.system, rules);

    const system = foundry.utils.deepClone(this.item.system);
    system.resolution ??= {};

    if (outcome) {
      system.resolution.status = outcome.status;
      system.resolution.outcomeId = outcome.outcomeId;
    } else {
      system.resolution.status = "ended";
      system.resolution.outcomeId = "";
    }
    system.resolution.resolvedAtIso = new Date().toISOString();
    system.resolution.summaryPublic = renderPublicSummary(redactForViewer(system, { isGM: false }), rules);
    system.resolution.summaryGM = renderGmSummary(system, rules);

    await this.item.update({ system });
  }

  async #copySummary() {
    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);
    const publicSummary = renderPublicSummary(redactForViewer(this.item.system, { isGM: false }), rules);
    await navigator.clipboard.writeText(publicSummary);
  }

  async #addNpcMotivation() {
    const root = this.element?.[0] ?? this.element;
    if (!root) return;
    const id = root.querySelector('select[name="neg-add-motivation"]')?.value;
    if (!id) return;

    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);
    const def = (rules.motivations ?? []).find((m) => m.id === id);
    if (!def) return;

    const npcId = this._selectedNpcId;
    const system = foundry.utils.deepClone(this.item.system);
    system.npcStateByParticipantId ??= {};
    system.npcStateByParticipantId[npcId] ??= {};
    const npc = system.npcStateByParticipantId[npcId];
    npc.motivations ??= [];
    if (npc.motivations.some((m) => m.id === id)) return;
    npc.motivations.push({ id: def.id, label: def.label, isRevealed: false });
    await this.item.update({ system });
  }

  async #removeNpcMotivation(indexStr) {
    const npcId = this._selectedNpcId;
    const idx = Number(indexStr);
    if (!npcId || !Number.isInteger(idx)) return;
    const system = foundry.utils.deepClone(this.item.system);
    const npc = system.npcStateByParticipantId?.[npcId];
    if (!npc?.motivations?.length) return;
    npc.motivations.splice(idx, 1);
    await this.item.update({ system });
  }

  async #addNpcPitfall() {
    const root = this.element?.[0] ?? this.element;
    if (!root) return;
    const id = root.querySelector('select[name="neg-add-pitfall"]')?.value;
    if (!id) return;

    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);
    const def = (rules.pitfalls ?? []).find((p) => p.id === id);
    if (!def) return;

    const npcId = this._selectedNpcId;
    const system = foundry.utils.deepClone(this.item.system);
    system.npcStateByParticipantId ??= {};
    system.npcStateByParticipantId[npcId] ??= {};
    const npc = system.npcStateByParticipantId[npcId];
    npc.pitfalls ??= [];
    if (npc.pitfalls.some((p) => p.id === id)) return;
    npc.pitfalls.push({ id: def.id, label: def.label, isRevealed: false });
    await this.item.update({ system });
  }

  async #removeNpcPitfall(indexStr) {
    const npcId = this._selectedNpcId;
    const idx = Number(indexStr);
    if (!npcId || !Number.isInteger(idx)) return;
    const system = foundry.utils.deepClone(this.item.system);
    const npc = system.npcStateByParticipantId?.[npcId];
    if (!npc?.pitfalls?.length) return;
    npc.pitfalls.splice(idx, 1);
    await this.item.update({ system });
  }
}
