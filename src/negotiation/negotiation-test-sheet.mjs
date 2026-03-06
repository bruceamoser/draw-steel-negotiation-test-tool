/**
 * Negotiation Test Item Sheet — ApplicationV2 (Foundry v13+)
 */

import { MODULE_ID } from "../config.mjs";
import { negotiationRules_v101b } from "./rules/draw-steel-v1.01b.mjs";
import {
  addParticipant,
  addArgumentEntry,
  addDiscoveryEntry,
  addAdjustmentEntry,
  addNoteEntry,
  startNegotiation,
  evaluateEndConditions,
  renderPublicSummary,
  renderGmSummary,
  redactForViewer,
} from "./negotiation-engine.mjs";
import { getRulesProfile } from "./negotiation-state.mjs";

const _TextEditor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;

/** Safely convert a value to a plain Array — handles real arrays, Foundry ObjectField
 *  plain-object representations ({0: x, 1: y, ...}), and null/undefined. */
function _toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.slice();
  if (typeof val === "object") return Object.values(val);
  return [];
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

export class NegotiationTestSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {

  // ── ApplicationV2 static config ────────────────────────────────────────────

  static DEFAULT_OPTIONS = {
    classes: ["negotiation-app", "negotiation-test-sheet"],
    window: { width: 1230, height: 1400, resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/items/negotiation-test/negotiation-test-sheet.hbs`,
      scrollable: [".tab-content"],
    },
  };

  // ── Instance state ─────────────────────────────────────────────────────────

  /** Currently active primary tab */
  _activeTab = "overview";

  /** Cached NPC participant id */
  _selectedNpcId = null;

  // ── Context preparation ────────────────────────────────────────────────────

  async _prepareContext(options) {
    const isGM = game.user.isGM;
    const doc = this.document;

    if (!isGM && this._activeTab === "outcomes") this._activeTab = "overview";

    // Migrate: participants with blank IDs (created by old code). Fire-and-forget.
    // Use { render: false } so the silent data patch does not trigger a re-render
    // of open sheets — without it the update → re-render → _prepareContext →
    // update cycle loops indefinitely while any participant id is falsy.
    if (isGM) {
      const raw = doc.system?.participants ?? [];
      if (raw.some((p) => !p?.id)) {
        const fixed = raw.map((p) => ({ ...p, id: p.id || foundry.utils.randomID() }));
        doc.update({ "system.participants": fixed }, { render: false });
      }
    }

    const rules = getRulesProfile(doc.system?.setup?.rulesProfileId);
    const system = redactForViewer(doc.system, { isGM });

    const enrichedOverview = await _TextEditor.enrichHTML(system?.setup?.overview ?? "", { async: true });
    const enrichedOutcomeSuccess = await _TextEditor.enrichHTML(system?.setup?.outcomes?.success ?? "", { async: true });
    const enrichedOutcomePartialSuccess = await _TextEditor.enrichHTML(system?.setup?.outcomes?.partialSuccess ?? "", { async: true });
    const enrichedOutcomeFailure = await _TextEditor.enrichHTML(system?.setup?.outcomes?.failure ?? "", { async: true });

    const statusKey = system.resolution?.status ?? "notStarted";
    const statusLabel = game.i18n.localize(
      `NEGOTIATION.Status.${statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}`
    );

    const participants = (system.participants ?? []).map((p, index) => ({ ...p, index }));
    const pcOptions = participants.filter((p) => p.kind === "pc").map((p) => ({ id: p.id, label: p.displayName }));

    const npcParticipants = participants.filter((p) => p.kind === "npc");
    if (!this._selectedNpcId) this._selectedNpcId = npcParticipants[0]?.id ?? null;
    const selectedNpcId = this._selectedNpcId;

    const selectedNpcState = selectedNpcId ? (system.npcStateByParticipantId ?? {})[selectedNpcId] : null;
    const selectedNpcParticipant = selectedNpcId ? (participants.find((p) => p.id === selectedNpcId) ?? null) : null;
    const selectedNpcIndex = (selectedNpcParticipant && Number.isInteger(selectedNpcParticipant.index))
      ? selectedNpcParticipant.index : null;

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
        const effectsText = (e.effects ?? [])
          .map((x) => `${x.stat} ${x.delta > 0 ? "+" : ""}${x.delta}`).join(", ");
        let summary = "";
        if (e.entryType === "argument") summary = e.argument?.summary ?? "";
        else if (e.entryType === "reveal") {
          const k = e.reveal?.kind;
          const lbl = e.reveal?.label;
          summary = (k && lbl) ? `Revealed ${k}: ${lbl}` : "Discovery attempt";
        }
        else if (e.entryType === "adjustment") summary = e.adjustment?.summary ?? game.i18n.localize("NEGOTIATION.Dialog.Adjust.DefaultReason");
        else if (e.entryType === "note") summary = e.note?.summary ?? "";
        else if (e.entryType === "test") summary = e.test?.summary ?? "";
        return { ...e, actorName: a?.displayName ?? "", summary, rollTier: e.roll?.tier ?? null, effectsText };
      }),
    }));

    const outcome = evaluateEndConditions(doc.system, rules);
    const outcomeLabel = outcome?.outcomeId
      ? (rules?.offersByInterest?.[
          Number(((doc.system.npcStateByParticipantId ?? {})[outcome.npcId]?.interest?.value) ?? 0)
        ]?.label ?? outcome.outcomeId)
      : "";

    const motivationOptions = (rules?.motivations ?? negotiationRules_v101b.motivations)
      .map((m) => ({ id: m.id, label: m.label }));
    const pitfallOptions = (rules?.pitfalls ?? negotiationRules_v101b.pitfalls)
      .map((p) => ({ id: p.id, label: p.label }));
    const argumentTypeOptions = (rules?.argumentTypes ?? negotiationRules_v101b.argumentTypes)
      .map((t) => ({ id: t.id, label: t.label }));

    const isInProgress = statusKey === "inProgress";

    return {
      item: doc,
      isGM,
      isOwner: doc.isOwner,
      isInProgress,
      system,
      enrichedOverview,
      enrichedOutcomeSuccess,
      enrichedOutcomePartialSuccess,
      enrichedOutcomeFailure,
      statusLabel,
      activeTab: this._activeTab,
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

  // ── Rendering / listeners ──────────────────────────────────────────────────

  _onRender(context, options) {
    const root = this.element;

    // Apply tab visibility BEFORE super — ProseMirror requires the host element
    // to be in the visible DOM (not display:none) when it initialises. Without
    // this, editors in the active tab are hidden at activation time and never
    // become editable.
    this.#applyTabState(root);

    // Activate ProseMirror editors and other V2 built-ins.
    super._onRender(context, options);

    // Mount <prose-mirror> custom elements for GM editors.
    // The {{editor}} Handlebars helper is a V1 mechanism and does not work in
    // ApplicationV2. We use HTMLProseMirrorElement.create() directly so the
    // element self-initialises when appended to the DOM.
    if (game.user.isGM) {
      const ProseMirrorEl = foundry.applications.elements.HTMLProseMirrorElement;
      for (const wrap of root.querySelectorAll(".neg-editor-wrap[data-field]")) {
        const fieldName = wrap.dataset.field;
        const value = foundry.utils.getProperty(this.document, fieldName) ?? "";
        // No `name` attribute — saves go through the "save" event below.
        // Giving the element a name= causes ApplicationV2 submitOnChange to
        // serialise it on every ProseMirror init event, creating an infinite
        // update → re-render → init → update loop.
        const el = ProseMirrorEl.create({ value, editable: true });
        wrap.appendChild(el);
        // Save on ProseMirror blur/save event → direct document update.
        el.addEventListener("save", async () => {
          await this.document.update({ [fieldName]: el.value });
        });
      }
    }

    for (const link of root.querySelectorAll(".tabs .item[data-tab]")) {
      link.addEventListener("click", (ev) => {
        ev.preventDefault();
        this._activeTab = ev.currentTarget.dataset.tab;
        this.#applyTabState(root);
      });
    }

    // Button action dispatch.
    for (const btn of root.querySelectorAll("button[data-action]")) {
      btn.addEventListener("click", this.#onAction.bind(this));
    }

    // Participant kind constraint (single NPC).
    for (const sel of root.querySelectorAll(".neg-participant-kind")) {
      sel.addEventListener("change", this.#onKindChange.bind(this));
    }

    // isRevealed checkboxes — handled directly, not via form submission, to
    // avoid the V2 serializer stripping id+label from npcStateByParticipantId.
    for (const cb of root.querySelectorAll('input[type="checkbox"][data-npc-id]')) {
      cb.addEventListener("change", this.#onRevealedChange.bind(this));
    }

    // Actor drag/drop.
    root.addEventListener("dragover", (ev) => ev.preventDefault());
    root.addEventListener("drop", this.#onDrop.bind(this));
  }

  #applyTabState(root) {
    for (const link of root.querySelectorAll(".tabs .item[data-tab]")) {
      link.classList.toggle("active", link.dataset.tab === this._activeTab);
    }
    for (const pane of root.querySelectorAll(".tab-content .tab[data-tab]")) {
      pane.classList.toggle("active", pane.dataset.tab === this._activeTab);
    }
  }

  // ── Form submit override ──────────────────────────────────────────────────
  // All action-only inputs (neg-add-motivation, neg-arg-actor, etc.) use
  // data-key= instead of name=, so FormData only ever contains valid system.*
  // paths. isRevealed checkboxes are also nameless (handled by #onRevealedChange).
  // We keep this override only to avoid Foundry trying to save the name field
  // at the top level in some V13 builds; otherwise it's a transparent passthrough.
  async _processSubmitData(event, form, formData) {
    // formData.object has the collected form values. Some keys may be flat
    // dot-paths (e.g. "system.setup.overview" from the prose-mirror element);
    // document.update() accepts both flat dot-paths and nested objects.
    const obj = formData?.object ?? {};
    if (Object.keys(obj).length) await this.document.update(obj);
  }

  // ── isRevealed direct handler ─────────────────────────────────────────────

  async #onRevealedChange(ev) {
    const cb = ev.currentTarget;
    const npcId  = cb.dataset.npcId;
    const listKey = cb.dataset.list;
    const idx    = Number(cb.dataset.idx);
    if (!npcId || !listKey || !Number.isInteger(idx)) return;
    const npcState = this.#cloneNpcState();
    npcState[npcId] ??= {};
    const list = _toArray(npcState[npcId][listKey]);
    if (list[idx]) list[idx].isRevealed = cb.checked;
    npcState[npcId][listKey] = list;
    await this.document.update({ "system.npcStateByParticipantId": npcState });
  }

  // ── Drag/drop ──────────────────────────────────────────────────────────────

  async #onDrop(event) {
    if (!game.user.isGM) return;
    event.preventDefault();
    const data = _TextEditor.getDragEventData(event);
    if (!data || data.type !== "Actor") return;
    const actor = await fromUuid(data.uuid);
    if (!actor) return;

    const kind = ["character", "hero", "pc"].includes(String(actor.type ?? "")) ? "pc" : "npc";
    if (kind === "npc") {
      const existingNpc = (this.document.system?.participants ?? []).filter((p) => p.kind === "npc").length;
      if (existingNpc >= 1) {
        ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.OnlyOneNPC"));
        return;
      }
    }

    const rules = getRulesProfile(this.document.system?.setup?.rulesProfileId);
    const updated = addParticipant(this.document.system, {
      actorUuid: data.uuid,
      displayName: actor.name,
      kind,
      role: "",
      isActive: true,
    }, rules, { idFn: () => foundry.utils.randomID() });
    await this.document.update({ system: updated });
  }

  // ── NPC kind constraint ────────────────────────────────────────────────────

  #onKindChange(ev) {
    if (!game.user.isGM) return;
    const el = ev.currentTarget;
    if (el.value !== "npc") return;
    const selects = this.element.querySelectorAll(".neg-participant-kind");
    let npcCount = 0;
    for (const s of selects) if (s.value === "npc") npcCount++;
    if (npcCount > 1) {
      el.value = "pc";
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.OnlyOneNPC"));
    }
  }

  // ── Action dispatch ────────────────────────────────────────────────────────

  async #onAction(ev) {
    ev.preventDefault();
    const action = ev.currentTarget?.dataset?.action;
    if (!action) return;

    if (action === "copySummary") return this.#copySummary();

    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.OnlyGM"));
      return;
    }

    switch (action) {
      case "addPcNoActor":        return this.#addPcNoActor();
      case "addNpcNoActor":       return this.#addNpcNoActor();
      case "removeParticipant":   return this.#removeParticipant(ev.currentTarget.dataset.participantId);
      case "startNegotiation":    return this.#start();
      case "stopNegotiation":     return this.#stop();
      case "addArgumentEntry":    return this.#addArgument();
      case "addRevealEntry":      return this.#addReveal();
      case "addManualAdjustment": return this.#addManualAdjustment();
      case "addNpcMotivation":    return this.#addNpcMotivation();
      case "removeNpcMotivation": return this.#removeNpcMotivation(ev.currentTarget.dataset.index);
      case "addNpcPitfall":       return this.#addNpcPitfall();
      case "removeNpcPitfall":    return this.#removeNpcPitfall(ev.currentTarget.dataset.index);
      case "resolveNegotiation":  return this.#resolve();
    }
  }

  // ── Participant actions ────────────────────────────────────────────────────

  async #addPcNoActor() {
    const rules = getRulesProfile(this.document.system?.setup?.rulesProfileId);
    const updated = addParticipant(this.document.system, {
      displayName: "PC", kind: "pc", role: "", isActive: true,
    }, rules, { idFn: () => foundry.utils.randomID() });
    await this.document.update({ system: updated });
  }

  async #addNpcNoActor() {
    const existing = (this.document.system?.participants ?? []).filter((p) => p.kind === "npc").length;
    if (existing >= 1) {
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.OnlyOneNPC"));
      return;
    }
    const rules = getRulesProfile(this.document.system?.setup?.rulesProfileId);
    const updated = addParticipant(this.document.system, {
      displayName: "NPC", kind: "npc", role: "", isActive: true,
    }, rules, { idFn: () => foundry.utils.randomID() });
    await this.document.update({ system: updated });
  }

  async #removeParticipant(participantId) {
    const system = foundry.utils.deepClone(this.document.system);
    system.participants = (system.participants ?? []).filter((p) => p.id !== participantId);
    if (system.npcStateByParticipantId) delete system.npcStateByParticipantId[participantId];
    await this.document.update({ system });
  }

  // ── Negotiation flow ───────────────────────────────────────────────────────

  async #start() {
    const rules = getRulesProfile(this.document.system?.setup?.rulesProfileId);
    const next = startNegotiation(this.document.system, rules, { idFn: () => foundry.utils.randomID() });
    await this.document.update({ system: next });
  }

  async #stop() {
    await this.document.update({ "system.resolution.status": "notStarted" });
  }

  async #resolve() {
    const confirmed = await this.#confirmDialog(
      game.i18n.localize("NEGOTIATION.Dialog.Resolve.Title"),
      game.i18n.localize("NEGOTIATION.Dialog.Resolve.Confirm")
    );
    if (!confirmed) return;

    const rules = getRulesProfile(this.document.system?.setup?.rulesProfileId);
    const outcome = evaluateEndConditions(this.document.system, rules);
    const system = foundry.utils.deepClone(this.document.system);
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

    const statusLabel = String(system.resolution.status ?? "ended").replace(/([A-Z])/g, " $1");
    const offerLabel = system.resolution.outcomeId
      ? (rules?.offersByInterest?.[
        Number(((system.npcStateByParticipantId ?? {})[outcome?.npcId]?.interest?.value) ?? 0)
      ]?.label ?? system.resolution.outcomeId)
      : "";
    const summary = offerLabel
      ? `Negotiation resolved (${statusLabel.trim()}): ${offerLabel}`
      : `Negotiation resolved (${statusLabel.trim()}).`;

    const { nextState } = addNoteEntry(system, {
      actorParticipantId: "",
      targetNpcParticipantId: outcome?.npcId ?? this.#resolveNpcId() ?? "",
      summary,
      detailsGM: "",
      isRevealedToPlayers: true,
    }, { idFn: () => foundry.utils.randomID() });

    await this.document.update({ system: nextState });
  }

  async #copySummary() {
    const rules = getRulesProfile(this.document.system?.setup?.rulesProfileId);
    const publicSummary = renderPublicSummary(redactForViewer(this.document.system, { isGM: false }), rules);
    await navigator.clipboard.writeText(publicSummary);
  }

  // ── Argument entry ─────────────────────────────────────────────────────────

  async #addArgument() {
    if (!this.#isNegotiationInProgress()) {
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.StartFirst"));
      return;
    }

    const root = this.element;
    const actorId      = root.querySelector('[data-key="neg-arg-actor"]')?.value;
    const tier         = Number(root.querySelector('[data-key="neg-arg-tier"]')?.value ?? 2);
    const argTypeId    = root.querySelector('[data-key="neg-arg-type"]')?.value ?? "custom";
    const motivationId = root.querySelector('[data-key="neg-arg-motivation"]')?.value ?? "";
    const pitfallId    = root.querySelector('[data-key="neg-arg-pitfall"]')?.value ?? "";
    const reveal       = !!root.querySelector('[data-key="neg-arg-reveal"]')?.checked;

    const targetId = this.#resolveNpcId();
    if (!targetId) { ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.NeedNPC")); return; }
    if (!actorId)  { ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.NeedPC")); return; }

    const rules = getRulesProfile(this.document.system?.setup?.rulesProfileId);
    const { nextState } = addArgumentEntry(this.document.system, rules, {
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
    await this.document.update({ system: nextState });
  }

  // ── Discovery entry ────────────────────────────────────────────────────────

  async #addReveal() {
    if (!this.#isNegotiationInProgress()) {
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.StartFirst"));
      return;
    }

    const root = this.element;
    const actorId         = root.querySelector('[data-key="neg-reveal-actor"]')?.value;
    const tier            = Number(root.querySelector('[data-key="neg-reveal-tier"]')?.value ?? 2);
    const revealToPlayers = !!root.querySelector('[data-key="neg-reveal-to-players"]')?.checked;

    const targetId = this.#resolveNpcId();
    if (!targetId) { ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.NeedNPC")); return; }
    if (!actorId)  { ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.NeedPC")); return; }

    const rules = getRulesProfile(this.document.system?.setup?.rulesProfileId);

    const learns = rules?.discoveryTest?.byTier?.[tier]?.learns ?? "none";
    let pick = null;
    if (learns === "one") {
      pick = await this.#promptDiscoveryChoice(targetId);
      if (!pick) return;
    }

    const forceReveal = learns === "one" && !!pick;
    const { nextState } = addDiscoveryEntry(this.document.system, rules, {
      actorParticipantId: actorId,
      targetNpcParticipantId: targetId,
      tier,
      rollTotal: null,
      detailsGM: "",
      revealToPlayers: forceReveal || revealToPlayers,
      isRevealedToPlayers: forceReveal || revealToPlayers,
      kind: pick?.kind ?? "",
      detailId: pick?.id ?? "",
      label: pick?.label ?? "",
    }, { idFn: () => foundry.utils.randomID() });
    await this.document.update({ system: nextState });
  }

  async #addManualAdjustment() {
    if (!this.#isNegotiationInProgress()) {
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.StartFirst"));
      return;
    }

    const targetId = this.#resolveNpcId();
    if (!targetId) { ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.NeedNPC")); return; }

    const data = await this.#promptAdjustment();
    if (!data) return;

    const rules = getRulesProfile(this.document.system?.setup?.rulesProfileId);
    const { nextState } = addAdjustmentEntry(this.document.system, rules, {
      actorParticipantId: "",
      targetNpcParticipantId: targetId,
      summary: data.summary,
      detailsGM: "",
      interestDelta: data.interestDelta,
      patienceDelta: data.patienceDelta,
      isRevealedToPlayers: data.isRevealedToPlayers,
    }, { idFn: () => foundry.utils.randomID() });

    await this.document.update({ system: nextState });
  }

  // ── NPC motivations / pitfalls ─────────────────────────────────────────────

  #resolveNpcId() {
    if (this._selectedNpcId) return this._selectedNpcId;
    const p = (this.document.system?.participants ?? []).find((p) => p.kind === "npc" && p.id);
    if (p?.id) { this._selectedNpcId = p.id; return p.id; }
    return null;
  }

  #cloneNpcState() {
    return foundry.utils.deepClone(this.document.system?.npcStateByParticipantId ?? {});
  }

  #isNegotiationInProgress() {
    return (this.document.system?.resolution?.status ?? "notStarted") === "inProgress";
  }

  async #confirmDialog(title, content) {
    const DialogV2 = foundry.applications?.api?.DialogV2;
    if (DialogV2?.confirm) {
      return !!(await DialogV2.confirm({
        window: { title },
        content: `<p>${content}</p>`,
      }));
    }
    if (globalThis.Dialog?.confirm) {
      return !!(await globalThis.Dialog.confirm({ title, content: `<p>${content}</p>` }));
    }
    return false;
  }

  async #showLegacyFormDialog(title, content, okLabel = game.i18n.localize("NEGOTIATION.Dialog.Common.Confirm")) {
    if (!globalThis.Dialog) return null;

    return new Promise((resolve) => {
      let settled = false;
      const settle = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      new globalThis.Dialog({
        title,
        content,
        buttons: {
          ok: {
            label: okLabel,
            callback: (html) => {
              const root = html?.[0] ?? html;
              settle(root);
            },
          },
          cancel: {
            label: game.i18n.localize("NEGOTIATION.Dialog.Common.Cancel"),
            callback: () => settle(null),
          },
        },
        default: "ok",
        close: () => settle(null),
      }).render(true);
    });
  }

  async #promptDiscoveryChoice(npcId) {
    const npcState = this.#cloneNpcState()[npcId] ?? {};
    const options = [];

    for (const m of _toArray(npcState.motivations)) {
      if (m?.id && m?.label && !m?.isRevealed) {
        options.push({ kind: "motivation", id: m.id, label: m.label, text: `Motivation — ${m.label}` });
      }
    }
    for (const p of _toArray(npcState.pitfalls)) {
      if (p?.id && p?.label && !p?.isRevealed) {
        options.push({ kind: "pitfall", id: p.id, label: p.label, text: `Pitfall — ${p.label}` });
      }
    }

    if (!options.length) {
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.NoUnrevealedDetails"));
      return null;
    }

    const selectOptions = options
      .map((opt, idx) => `<option value="${idx}">${foundry.utils.escapeHTML(opt.text)}</option>`)
      .join("");
    const root = await this.#showLegacyFormDialog(
      game.i18n.localize("NEGOTIATION.Dialog.Discovery.Title"),
      `<form class="neg-dialog-form">
        <p>${game.i18n.localize("NEGOTIATION.Dialog.Discovery.SelectPrompt")}</p>
        <div class="form-group">
          <label>${game.i18n.localize("NEGOTIATION.Dialog.Discovery.RevealedDetail")}</label>
          <select name="discoveryChoice">${selectOptions}</select>
        </div>
      </form>`,
      game.i18n.localize("NEGOTIATION.Dialog.Discovery.Submit")
    );
    if (!root) return null;

    const idx = Number(root.querySelector('[name="discoveryChoice"]')?.value ?? 0);
    return options[idx] ?? null;
  }

  async #promptAdjustment() {
    const root = await this.#showLegacyFormDialog(
      game.i18n.localize("NEGOTIATION.Dialog.Adjust.Title"),
      `<form class="neg-dialog-form">
        <p>${game.i18n.localize("NEGOTIATION.Dialog.Adjust.Description")}</p>
        <div class="form-group">
          <label>${game.i18n.localize("NEGOTIATION.Dialog.Adjust.InterestDelta")}</label>
          <input type="number" name="interestDelta" value="0" step="1" />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("NEGOTIATION.Dialog.Adjust.PatienceDelta")}</label>
          <input type="number" name="patienceDelta" value="0" step="1" />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("NEGOTIATION.Dialog.Adjust.Reason")}</label>
          <input type="text" name="summary" value="${game.i18n.localize("NEGOTIATION.Dialog.Adjust.DefaultReason")}" />
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" name="isRevealedToPlayers" checked />
            ${game.i18n.localize("NEGOTIATION.Dialog.Adjust.RevealInPlayerLog")}
          </label>
        </div>
      </form>`,
      game.i18n.localize("NEGOTIATION.Dialog.Adjust.Submit")
    );
    if (!root) return null;

    const interestDelta = Number(root.querySelector('[name="interestDelta"]')?.value ?? 0);
    const patienceDelta = Number(root.querySelector('[name="patienceDelta"]')?.value ?? 0);
    const defaultSummary = game.i18n.localize("NEGOTIATION.Dialog.Adjust.DefaultReason");
    const summary = String(root.querySelector('[name="summary"]')?.value ?? defaultSummary).trim() || defaultSummary;
    const isRevealedToPlayers = !!root.querySelector('[name="isRevealedToPlayers"]')?.checked;

    if (!Number.isFinite(interestDelta) || !Number.isFinite(patienceDelta)) {
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.AdjustmentDeltaNumbers"));
      return null;
    }

    if (interestDelta === 0 && patienceDelta === 0) {
      ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.AdjustmentNoDelta"));
      return null;
    }

    return { interestDelta, patienceDelta, summary, isRevealedToPlayers };
  }

  async #addNpcMotivation() {
    const id = this.element.querySelector('[data-key="neg-add-motivation"]')?.value;
    if (!id) return;
    const rules = getRulesProfile(this.document.system?.setup?.rulesProfileId);
    const def = (rules.motivations ?? []).find((m) => m.id === id);
    if (!def) return;
    const npcId = this.#resolveNpcId();
    if (!npcId) { ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.NeedNPC")); return; }
    const npcState = this.#cloneNpcState();
    npcState[npcId] ??= {};
    const motivations = _toArray(npcState[npcId].motivations);
    if (motivations.some((m) => m.id === id)) return;
    motivations.push({ id: def.id, label: def.label, isRevealed: false });
    npcState[npcId].motivations = motivations;
    await this.document.update({ "system.npcStateByParticipantId": npcState });
  }

  async #removeNpcMotivation(indexStr) {
    const npcId = this.#resolveNpcId();
    const idx = Number(indexStr);
    if (!npcId || !Number.isInteger(idx)) return;
    const npcState = this.#cloneNpcState();
    const motivations = _toArray(npcState[npcId]?.motivations);
    motivations.splice(idx, 1);
    npcState[npcId].motivations = motivations;
    await this.document.update({ "system.npcStateByParticipantId": npcState });
  }

  async #addNpcPitfall() {
    const id = this.element.querySelector('[data-key="neg-add-pitfall"]')?.value;
    if (!id) return;
    const rules = getRulesProfile(this.document.system?.setup?.rulesProfileId);
    const def = (rules.pitfalls ?? []).find((p) => p.id === id);
    if (!def) return;
    const npcId = this.#resolveNpcId();
    if (!npcId) { ui.notifications.warn(game.i18n.localize("NEGOTIATION.Notify.NeedNPC")); return; }
    const npcState = this.#cloneNpcState();
    npcState[npcId] ??= {};
    const pitfalls = _toArray(npcState[npcId].pitfalls);
    if (pitfalls.some((p) => p.id === id)) return;
    pitfalls.push({ id: def.id, label: def.label, isRevealed: false });
    npcState[npcId].pitfalls = pitfalls;
    await this.document.update({ "system.npcStateByParticipantId": npcState });
  }

  async #removeNpcPitfall(indexStr) {
    const npcId = this.#resolveNpcId();
    const idx = Number(indexStr);
    if (!npcId || !Number.isInteger(idx)) return;
    const npcState = this.#cloneNpcState();
    const pitfalls = _toArray(npcState[npcId]?.pitfalls);
    pitfalls.splice(idx, 1);
    npcState[npcId].pitfalls = pitfalls;
    await this.document.update({ "system.npcStateByParticipantId": npcState });
  }
}
