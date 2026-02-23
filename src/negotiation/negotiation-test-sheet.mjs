/**
 * Negotiation Test Item Sheet
 */

import { MODULE_ID } from "../config.mjs";
import { negotiationRules_v101b } from "./rules/draw-steel-v1.01b.mjs";
import {
  addParticipant,
  addArgumentEntry,
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

const _TextEditor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;

/** Safely convert a value to a plain Array — handles real arrays, Foundry ObjectField
 *  plain-object representations ({0: x, 1: y, ...}), and null/undefined. */
function _toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.slice();
  if (typeof val === "object") return Object.values(val);
  return [];
}

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
      width: 820,
      height: 700,
      submitOnClose: true,
      tabs: [{ navSelector: ".tabs", contentSelector: ".tab-content", initial: "overview" }],
    });
  }

  get template() {
    return `modules/${MODULE_ID}/templates/items/negotiation-test/negotiation-test-sheet.hbs`;
  }

  async getData(options = {}) {
    const data = super.getData(options);

    // Migrate: participants created by old code can have blank IDs. Fix once, fire-and-forget.
    if (game.user.isGM) {
      const rawParticipants = this.item.system?.participants ?? [];
      if (rawParticipants.some((p) => !p?.id)) {
        const fixed = rawParticipants.map((p) => ({ ...p, id: p.id || foundry.utils.randomID() }));
        this.item.update({ "system.participants": fixed }); // re-render happens automatically
      }
    }

    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);

    const viewState = redactForViewer(this.item.system, { isGM: game.user.isGM });
    const system = viewState;

    const enrichedOverview = await _TextEditor.enrichHTML(system?.setup?.overview ?? "", { async: true });
    const enrichedOutcomeSuccess = await _TextEditor.enrichHTML(system?.setup?.outcomes?.success ?? "", { async: true });
    const enrichedOutcomePartialSuccess = await _TextEditor.enrichHTML(system?.setup?.outcomes?.partialSuccess ?? "", { async: true });
    const enrichedOutcomeFailure = await _TextEditor.enrichHTML(system?.setup?.outcomes?.failure ?? "", { async: true });

    const currentSeg = _currentSegment(system);
    const statusKey = system.resolution?.status ?? "notStarted";
    const statusLabel = game.i18n.localize(`NEGOTIATION.Status.${statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}`);

    const participants = (system.participants ?? []).map((p, index) => ({ ...p, index }));
    const pcOptions = participants.filter((p) => p.kind === "pc").map((p) => ({ id: p.id, label: p.displayName }));

    const npcParticipants = participants.filter((p) => p.kind === "npc");
    if (!this._selectedNpcId) this._selectedNpcId = npcParticipants[0]?.id ?? null;
    const selectedNpcId = this._selectedNpcId;

    const selectedNpcState = selectedNpcId ? (system.npcStateByParticipantId ?? {})[selectedNpcId] : null;
    const selectedNpcParticipant = selectedNpcId ? (participants.find((p) => p.id === selectedNpcId) ?? null) : null;
    const selectedNpcIndex = (selectedNpcParticipant && Number.isInteger(selectedNpcParticipant.index)) ? selectedNpcParticipant.index : null;
    const selectedNpc = selectedNpcState ? {
      id: selectedNpcId,
      name: selectedNpcParticipant?.displayName ?? "NPC",
      participantIndex: selectedNpcIndex,
      hasParticipantIndex: selectedNpcIndex !== null,
      participantNotesGM: selectedNpcParticipant?.notesGM ?? "",
      interest: selectedNpcState.interest,
      patience: selectedNpcState.patience,
      interestDisplay: _interestDisplay(system, selectedNpcState),
      patienceDisplay: _patienceDisplay(system, selectedNpcState),
      offerLabel: rules?.offersByInterest?.[Number(selectedNpcState?.interest?.value ?? 0)]?.label ?? "",
      motivations: _toArray(selectedNpcState.motivations),
      pitfalls: _toArray(selectedNpcState.pitfalls),
    } : null;

    const timeline = (system.timeline ?? []).map((seg) => ({
      ...seg,
      entries: (seg.entries ?? []).map((e) => {
        const a = participants.find((p) => p.id === e.actorParticipantId);
        const t = participants.find((p) => p.id === e.targetNpcParticipantId);
        const effectsText = (e.effects ?? []).map((x) => `${x.stat} ${x.delta > 0 ? "+" : ""}${x.delta}`).join(", ");

        let summary = "";
        if (e.entryType === "argument") summary = e.argument?.summary ?? "";
        else if (e.entryType === "test") summary = e.test?.summary ?? "";
        else if (e.entryType === "note") summary = e.note?.summary ?? "";
        else if (e.entryType === "adjustment") summary = e.adjustment?.summary ?? "";
        else if (e.entryType === "reveal") {
          const k = e.reveal?.kind;
          const label = e.reveal?.label;
          summary = (k && label) ? `Revealed ${k}: ${label}` : "Discovery attempt";
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
    const argumentTypeOptions = (rules?.argumentTypes ?? negotiationRules_v101b.argumentTypes).map((t) => ({ id: t.id, label: t.label }));

    const isInProgress = (system.resolution?.status ?? "notStarted") === "inProgress";

    return {
      ...data,
      isGM: game.user.isGM,
      isInProgress,
      system,
      enrichedOverview,
      enrichedOutcomeSuccess,
      enrichedOutcomePartialSuccess,
      enrichedOutcomeFailure,
      statusLabel,
      currentSegmentLabel: currentSeg?.label ?? "",
      participants,
      pcOptions,
      selectedNpc,
      timeline,
      outcomeLabel,
      motivationOptions,
      pitfallOptions,
      argumentTypeOptions,
    };
  }

  /**
   * Override _getSubmitData to prevent Foundry's form serializer from writing
   * npcStateByParticipantId dot-paths that only contain `isRevealed` (stripping
   * the `id` and `label` fields not present as form inputs).
   * Instead we rebuild the full object from live item data + current checkboxes.
   */
  _getSubmitData(updateData = {}) {
    const formData = super._getSubmitData(updateData);

    // Collect and remove any keys Foundry serialised for npcStateByParticipantId
    const npcKeys = Object.keys(formData).filter((k) => k.startsWith("system.npcStateByParticipantId."));
    if (npcKeys.length === 0) return formData;
    for (const k of npcKeys) delete formData[k];

    // Rebuild from live item data, patching only isRevealed from checkboxes.
    const npcState = foundry.utils.deepClone(this.item.system?.npcStateByParticipantId ?? {});
    const root = this.element?.[0] ?? this.element;
    if (root) {
      for (const cb of root.querySelectorAll('input[type="checkbox"][name^="system.npcStateByParticipantId."]')) {
        // name format: system.npcStateByParticipantId.{npcId}.{motivations|pitfalls}.{idx}.isRevealed
        const stripped = cb.name.slice("system.npcStateByParticipantId.".length);
        const [npcId, listKey, idxStr, field] = stripped.split(".");
        const idx = Number(idxStr);
        if (!npcId || !listKey || !Number.isInteger(idx) || !field) continue;
        npcState[npcId] ??= {};
        const list = _toArray(npcState[npcId][listKey]);
        if (list[idx]) list[idx][field] = cb.checked;
        npcState[npcId][listKey] = list;
      }
    }

    formData["system.npcStateByParticipantId"] = npcState;
    return formData;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("button[data-action]").on("click", this.#onAction.bind(this));

    // Enforce the single-NPC constraint in the Participants tab.
    html.find(".neg-participant-kind").on("change", (ev) => {
      if (!game.user.isGM) return;
      const el = ev.currentTarget;
      if (!el) return;
      if (el.value !== "npc") return;

      const root = html?.[0] ?? html;
      const selects = root.querySelectorAll(".neg-participant-kind");
      let npcCount = 0;
      for (const s of selects) if (s?.value === "npc") npcCount += 1;
      if (npcCount > 1) {
        el.value = "pc";
        ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.OnlyOneNPC"));
      }
    });

    // Enable Actor drag/drop on the sheet.
    html.on("drop", this.#onDrop.bind(this));
  }

  async #onDrop(event) {
    if (!game.user.isGM) return;
    event.preventDefault();
    const dragEvent = event?.originalEvent ?? event;
    if (!dragEvent?.dataTransfer) return;
    const data = _TextEditor.getDragEventData(dragEvent);
    if (!data) return;

    if (data.type !== "Actor") return;
    const actor = await fromUuid(data.uuid);
    if (!actor) return;

    // Draw Steel doesn't necessarily use dnd5e-style actor types. Treat "hero" and "character" as PCs.
    const kind = ["character", "hero", "pc"].includes(String(actor.type ?? "")) ? "pc" : "npc";

    if (kind === "npc") {
      const existingNpcCount = (this.item.system?.participants ?? []).filter((p) => p.kind === "npc").length;
      if (existingNpcCount >= 1) {
        ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.OnlyOneNPC"));
        return;
      }
    }

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
      case "addPcNoActor":
        return this.#addPcNoActor();
      case "removeParticipant":
        return this.#removeParticipant(event.currentTarget.dataset.participantId);
      case "startNegotiation":
        return this.#start();
      case "stopNegotiation":
        return this.#stop();
      case "advanceStructure":
        return this.#advance();
      case "addArgumentEntry":
        return this.#addArgument();
      case "addRevealEntry":
        return this.#addReveal();
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
    const existingNpcCount = (this.item.system?.participants ?? []).filter((p) => p.kind === "npc").length;
    if (existingNpcCount >= 1) {
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.OnlyOneNPC"));
      return;
    }
    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);
    const updated = addParticipant(this.item.system, {
      displayName: "NPC",
      kind: "npc",
      role: "",
      isActive: true,
    }, rules, { idFn: () => foundry.utils.randomID() });
    await this.item.update({ system: updated });
  }

  async #addPcNoActor() {
    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);
    const updated = addParticipant(this.item.system, {
      displayName: "PC",
      kind: "pc",
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

  async #stop() {
    await this.item.update({ "system.resolution.status": "notStarted" });
  }

  async #advance() {
    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);
    const next = advanceStructure(this.item.system, rules, { idFn: () => foundry.utils.randomID() });
    await this.item.update({ system: next });
  }

  async #addArgument() {
    const root = this.element?.[0] ?? this.element;
    if (!root) return;

    const actorId = root.querySelector('select[name="neg-arg-actor"]')?.value;
    const tier = Number(root.querySelector('select[name="neg-arg-tier"]')?.value ?? 2);
    const argTypeId = root.querySelector('select[name="neg-arg-type"]')?.value ?? "custom";
    const motivationId = root.querySelector('select[name="neg-arg-motivation"]')?.value ?? "";
    const pitfallId = root.querySelector('select[name="neg-arg-pitfall"]')?.value ?? "";
    const reveal = !!root.querySelector('input[name="neg-arg-reveal"]')?.checked;

    const targetId = this._selectedNpcId;
    if (!targetId) {
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.NeedNPC"));
      return;
    }
    if (!actorId) {
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.NeedPC"));
      return;
    }

    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);
    const { nextState } = addArgumentEntry(this.item.system, rules, {
      actorParticipantId: actorId,
      targetNpcParticipantId: targetId,
      argumentTypeId: argTypeId,
      claimedMotivationId: motivationId || null,
      triggeredPitfallId: pitfallId || null,
      summary: "",
      detailsGM: "",
      tier,
      roll: { mode: "none", formula: "", total: null, visibleToPlayers: false },
      isRevealedToPlayers: reveal,
    }, { idFn: () => foundry.utils.randomID() });

    await this.item.update({ system: nextState });
  }

  async #addReveal() {
    const root = this.element?.[0] ?? this.element;
    if (!root) return;

    const actorId = root.querySelector('select[name="neg-reveal-actor"]')?.value;
    const tier = Number(root.querySelector('select[name="neg-reveal-tier"]')?.value ?? 2);
    const revealToPlayers = !!root.querySelector('input[name="neg-reveal-to-players"]')?.checked;

    const targetId = this.#resolveNpcId();
    if (!targetId) {
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.NeedNPC"));
      return;
    }
    if (!actorId) {
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.NeedPC"));
      return;
    }

    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);
    const { nextState } = addDiscoveryEntry(this.item.system, rules, {
      actorParticipantId: actorId,
      targetNpcParticipantId: targetId,
      tier,
      rollTotal: null,
      detailsGM: "",
      revealToPlayers,
      isRevealedToPlayers: revealToPlayers,
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

  // Resolve the current NPC participant id — never rely solely on the cached
  // _selectedNpcId because it can be stale or empty-string after migration renders.
  #resolveNpcId() {
    // First try the cached value (set during getData).
    if (this._selectedNpcId) return this._selectedNpcId;
    // Fallback: pick the first NPC directly from the live item data.
    const npcParticipant = (this.item.system?.participants ?? []).find((p) => p.kind === "npc" && p.id);
    if (npcParticipant?.id) {
      this._selectedNpcId = npcParticipant.id;
      return this._selectedNpcId;
    }
    return null;
  }

  async #addNpcMotivation() {
    const root = this.element?.[0] ?? this.element;
    if (!root) return;
    const id = root.querySelector('select[name="neg-add-motivation"]')?.value;
    if (!id) return;

    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);
    const def = (rules.motivations ?? []).find((m) => m.id === id);
    if (!def) return;

    const npcId = this.#resolveNpcId();
    if (!npcId) {
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.NeedNPC"));
      return;
    }
    const npcState = foundry.utils.deepClone(this.item.system?.npcStateByParticipantId ?? {});
    npcState[npcId] ??= {};
    const motivations = _toArray(npcState[npcId].motivations);
    if (motivations.some((m) => m.id === id)) return;
    motivations.push({ id: def.id, label: def.label, isRevealed: false });
    npcState[npcId].motivations = motivations;
    await this.item.update({ "system.npcStateByParticipantId": npcState });
  }

  async #removeNpcMotivation(indexStr) {
    const npcId = this.#resolveNpcId();
    const idx = Number(indexStr);
    if (!npcId || !Number.isInteger(idx)) return;
    const npcState = foundry.utils.deepClone(this.item.system?.npcStateByParticipantId ?? {});
    const motivations = _toArray(npcState[npcId]?.motivations);
    motivations.splice(idx, 1);
    npcState[npcId].motivations = motivations;
    await this.item.update({ "system.npcStateByParticipantId": npcState });
  }

  async #addNpcPitfall() {
    const root = this.element?.[0] ?? this.element;
    if (!root) return;
    const id = root.querySelector('select[name="neg-add-pitfall"]')?.value;
    if (!id) return;

    const rules = getRulesProfile(this.item.system?.setup?.rulesProfileId);
    const def = (rules.pitfalls ?? []).find((p) => p.id === id);
    if (!def) return;

    const npcId = this.#resolveNpcId();
    if (!npcId) {
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.NeedNPC"));
      return;
    }
    const npcState = foundry.utils.deepClone(this.item.system?.npcStateByParticipantId ?? {});
    npcState[npcId] ??= {};
    const pitfalls = _toArray(npcState[npcId].pitfalls);
    if (pitfalls.some((p) => p.id === id)) return;
    pitfalls.push({ id: def.id, label: def.label, isRevealed: false });
    npcState[npcId].pitfalls = pitfalls;
    await this.item.update({ "system.npcStateByParticipantId": npcState });
  }

  async #removeNpcPitfall(indexStr) {
    const npcId = this.#resolveNpcId();
    const idx = Number(indexStr);
    if (!npcId || !Number.isInteger(idx)) return;
    const npcState = foundry.utils.deepClone(this.item.system?.npcStateByParticipantId ?? {});
    const pitfalls = _toArray(npcState[npcId]?.pitfalls);
    pitfalls.splice(idx, 1);
    npcState[npcId].pitfalls = pitfalls;
    await this.item.update({ "system.npcStateByParticipantId": npcState });
  }
}
