/**
 * Pure negotiation engine functions.
 * No Foundry dependencies (so these can be unit-tested under Node).
 */

function _nowIso() {
  return new Date().toISOString();
}

function _clone(obj) {
  if (globalThis.structuredClone) return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

function _safeId(idFn) {
  if (typeof idFn === "function") return idFn();
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // Low-collision fallback
  return `id_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function _clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function _first(arr, pred) {
  for (const x of (arr ?? [])) if (pred(x)) return x;
  return null;
}

function _normText(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function createDefaultNegotiationState(rules, options = {}) {
  const profileId = rules?.id ?? "draw-steel-v1.01b";
  const nowIso = options.createdAtIso ?? _nowIso();
  return {
    schemaVersion: 1,
    title: options.title ?? "",
    createdAtIso: nowIso,
    createdByUserId: options.createdByUserId ?? "",

    setup: {
      overview: "",
      outcomes: {
        success: "",
        partialSuccess: "",
        failure: "",
      },
      rulesProfileId: profileId,
      structure: {
        kind: rules?.structure?.kind ?? "freeform",
        maxRounds: rules?.structure?.maxRounds ?? null,
        stages: rules?.structure?.stages ?? null,
      },
      visibility: {
        showNpcNames: true,
        showInterest: "value",
        showPatience: "value",
        showArgumentDetails: true,
        showRollTotals: true,
      },
      allowEditingPreviousEntries: false,
    },

    participants: [],
    npcStateByParticipantId: {},
    timeline: [],

    resolution: {
      status: "notStarted",
      outcomeId: "",
      summaryPublic: "",
      summaryGM: "",
      resolvedAtIso: "",
    },
  };
}

export function addParticipant(state, participant, rules, options = {}) {
  const next = _clone(state);
  const id = participant?.id ?? _safeId(options.idFn);
  const kind = participant?.kind ?? "npc";
  const displayName = participant?.displayName ?? (kind === "npc" ? "NPC" : "PC");

  next.participants ??= [];
  next.npcStateByParticipantId ??= {};
  next.timeline ??= [];

  next.participants.push({
    id,
    actorUuid: participant?.actorUuid ?? "",
    displayName,
    kind,
    role: participant?.role ?? "",
    isActive: participant?.isActive ?? true,
    notesGM: participant?.notesGM ?? "",
  });

  if (kind === "npc" && !next.npcStateByParticipantId[id]) {
    const interestDefaults = rules?.npcDefaults?.interest ?? { min: 0, max: 5, start: 2 };
    const patienceDefaults = rules?.npcDefaults?.patience ?? { min: 0, max: 5, start: 3 };

    next.npcStateByParticipantId[id] = {
      interest: {
        value: _clamp(interestDefaults.start, interestDefaults.min, interestDefaults.max),
        min: interestDefaults.min,
        max: interestDefaults.max,
      },
      patience: {
        value: _clamp(patienceDefaults.start, patienceDefaults.min, patienceDefaults.max),
        min: patienceDefaults.min,
        max: patienceDefaults.max,
      },
      motivations: [],
      pitfalls: [],
      discovered: {
        motivations: [],
        pitfalls: [],
      },
    };
  }

  return next;
}

export function startNegotiation(state, rules, options = {}) {
  const next = _clone(state);
  next.resolution ??= {};
  if (next.resolution.status === "notStarted") next.resolution.status = "inProgress";

  next.timeline ??= [];
  if (next.timeline.length === 0) {
    next.timeline.push({
      id: _safeId(options.idFn),
      index: 1,
      label: "Negotiation",
      entries: [],
    });
  }

  return next;
}

export function advanceStructure(state, rules, options = {}) {
  const kind = state?.setup?.structure?.kind ?? rules?.structure?.kind ?? "freeform";
  if (kind === "freeform") return _clone(state);

  const next = _clone(state);
  next.timeline ??= [];
  const nextIndex = next.timeline.length + 1;

  if (kind === "rounds") {
    const max = Number(next?.setup?.structure?.maxRounds ?? rules?.structure?.maxRounds ?? 0);
    if (max > 0 && nextIndex > max) return next;
    next.timeline.push({ id: _safeId(options.idFn), index: nextIndex, label: `Round ${nextIndex}`, entries: [] });
  } else if (kind === "stages") {
    const stages = next?.setup?.structure?.stages ?? rules?.structure?.stages ?? [];
    const stage = stages[nextIndex - 1];
    const label = stage?.label ?? `Stage ${nextIndex}`;
    next.timeline.push({ id: _safeId(options.idFn), index: nextIndex, label, entries: [] });
  }

  return next;
}

export function computeTier(rules, rollTotal) {
  const total = Number(rollTotal);
  if (!Number.isFinite(total)) return null;

  const tiering = rules?.argumentResolution?.tiering;
  if (tiering?.method !== "totalBands") return null;

  for (const band of (tiering.bands ?? [])) {
    const min = Number(band.minTotal);
    const max = (band.maxTotal === null || band.maxTotal === undefined) ? null : Number(band.maxTotal);
    if (!Number.isFinite(min)) continue;
    if (max === null) {
      if (total >= min) return Number(band.tier);
    } else if (total >= min && total <= max) {
      return Number(band.tier);
    }
  }
  return null;
}

export function applyEffects(state, effects = []) {
  const next = _clone(state);
  next.npcStateByParticipantId ??= {};

  for (const eff of effects) {
    const npcId = eff.appliedToNpcParticipantId;
    const npc = next.npcStateByParticipantId[npcId];
    if (!npc) continue;
    if (eff.stat === "interest") {
      const min = Number(npc.interest?.min ?? 0);
      const max = Number(npc.interest?.max ?? 5);
      npc.interest.value = _clamp(Number(npc.interest.value ?? 0) + Number(eff.delta ?? 0), min, max);
    }
    if (eff.stat === "patience") {
      const min = Number(npc.patience?.min ?? 0);
      const max = Number(npc.patience?.max ?? 5);
      npc.patience.value = _clamp(Number(npc.patience.value ?? 0) + Number(eff.delta ?? 0), min, max);
    }
  }

  return next;
}

function _currentSegment(state) {
  const segments = state.timeline ?? [];
  return segments.length ? segments[segments.length - 1] : null;
}

function _getParticipant(state, id) {
  return _first(state.participants ?? [], (p) => p.id === id);
}

function _getNpcState(state, npcId) {
  return (state.npcStateByParticipantId ?? {})[npcId] ?? null;
}

function _getMotivationUsedIds(state, npcId) {
  const used = new Set();
  for (const seg of (state.timeline ?? [])) {
    for (const entry of (seg.entries ?? [])) {
      if (entry.entryType !== "argument") continue;
      if (entry.targetNpcParticipantId !== npcId) continue;
      const mid = entry.argument?.claimedMotivationId;
      if (!mid) continue;
      const interestEff = (entry.effects ?? []).find((e) => e.stat === "interest" && e.appliedToNpcParticipantId === npcId);
      if (interestEff && Number(interestEff.delta) > 0) used.add(mid);
    }
  }
  return used;
}

function _getPriorNoMotivationSummaries(state, npcId) {
  const set = new Set();
  for (const seg of (state.timeline ?? [])) {
    for (const entry of (seg.entries ?? [])) {
      if (entry.entryType !== "argument") continue;
      if (entry.targetNpcParticipantId !== npcId) continue;
      if (entry.argument?.argumentTypeId !== "noMotivation") continue;
      const txt = _normText(entry.argument?.summary);
      if (txt) set.add(txt);
    }
  }
  return set;
}

/**
 * Add an argument entry.
 * @param {object} state
 * @param {object} rules
 * @param {object} payload
 * @returns {{ nextState: object, entry: object, effectsApplied: Array<object> }}
 */
export function addArgumentEntry(state, rules, payload, options = {}) {
  const next = _clone(state);
  next.timeline ??= [];
  next.npcStateByParticipantId ??= {};
  next.resolution ??= {};

  // Ensure at least one segment.
  if (next.timeline.length === 0) {
    next.timeline.push({ id: _safeId(options.idFn), index: 1, label: "Negotiation", entries: [] });
  }
  const seg = _currentSegment(next);
  seg.entries ??= [];

  const actorId = payload.actorParticipantId;
  const targetId = payload.targetNpcParticipantId;

  const actor = _getParticipant(next, actorId);
  const target = _getParticipant(next, targetId);
  const npc = _getNpcState(next, targetId);
  if (!actor || !target || target.kind !== "npc" || !npc) {
    return { nextState: next, entry: null, effectsApplied: [] };
  }

  const argTypeId = payload.argumentTypeId ?? "custom";
  const summary = String(payload.summary ?? "");
  const detailsGM = String(payload.detailsGM ?? "");
  const rawMotivationId = payload.claimedMotivationId ?? null;
  const rawPitfallId = payload.triggeredPitfallId ?? null;
  const npcMotivationIds = new Set((npc.motivations ?? []).map((m) => m?.id).filter(Boolean));
  const npcPitfallIds = new Set((npc.pitfalls ?? []).map((p) => p?.id).filter(Boolean));
  const claimedMotivationId = rawMotivationId && npcMotivationIds.has(rawMotivationId) ? rawMotivationId : null;
  const triggeredPitfallId = rawPitfallId && npcPitfallIds.has(rawPitfallId) ? rawPitfallId : null;
  const caughtInLie = !!payload.caughtInLie;
  const natural19or20 = !!payload.natural19or20;

  const rollMode = payload.roll?.mode ?? "none";
  const rollTotal = (rollMode === "none") ? null : (payload.roll?.total ?? null);

  const usedMotivations = _getMotivationUsedIds(next, targetId);
  const priorNoMotivation = _getPriorNoMotivationSummaries(next, targetId);

  let profileKey = "custom";
  if (triggeredPitfallId || argTypeId === "pitfallUsed") profileKey = "pitfallUsed";
  else if (argTypeId === "appealMotivation" && claimedMotivationId) {
    profileKey = usedMotivations.has(claimedMotivationId) ? "appealUsedMotivation" : "appealNewMotivation";
  } else if (argTypeId === "noMotivation") profileKey = "noMotivationOrPitfall";

  const profiles = rules?.argumentResolution?.profiles ?? {};
  const profile = profiles[profileKey] ?? null;

  let tier;
  const explicitTier = Number(payload?.tier ?? payload?.roll?.tier);
  if (profile?.automaticTier) tier = Number(profile.automaticTier);
  else if (Number.isFinite(explicitTier) && explicitTier >= 1) tier = explicitTier;
  else tier = computeTier(rules, rollTotal);

  // Repeating a no-motivation argument forces tier 1.
  if (profileKey === "noMotivationOrPitfall" && profile?.repeatSameArgumentForcesTier1) {
    const key = _normText(summary);
    if (key && priorNoMotivation.has(key)) tier = 1;
  }

  // Default tier if we can't compute.
  if (!tier) tier = 2;

  let interestDelta = Number(profile?.byTier?.[tier]?.interestDelta ?? 0);
  let patienceDelta = Number(profile?.byTier?.[tier]?.patienceDelta ?? 0);

  // Natural 19/20 rider for no-motivation profile (optional input).
  if (profileKey === "noMotivationOrPitfall" && profile?.natural19or20PatienceNoLoss && natural19or20) {
    patienceDelta = 0;
  }

  // Caught in a lie rider.
  if (caughtInLie) {
    if (interestDelta <= 0) {
      interestDelta += Number(rules?.argumentResolution?.caughtInLie?.extraInterestPenalty ?? -1);
    }
  }

  const effectsApplied = [];
  const vis = next?.setup?.visibility ?? {};
  const showInterest = vis.showInterest ?? "value";
  const showPatience = vis.showPatience ?? "value";
  const entryVisible = !!payload.isRevealedToPlayers;

  if (interestDelta !== 0) {
    effectsApplied.push({
      stat: "interest",
      delta: interestDelta,
      appliedToNpcParticipantId: targetId,
      reason: profileKey,
      visibleToPlayers: entryVisible && showInterest !== "hidden",
    });
  }
  if (patienceDelta !== 0) {
    effectsApplied.push({
      stat: "patience",
      delta: patienceDelta,
      appliedToNpcParticipantId: targetId,
      reason: profileKey,
      visibleToPlayers: entryVisible && showPatience !== "hidden",
    });
  }

  const entry = {
    id: _safeId(options.idFn),
    timestampIso: _nowIso(),
    actorParticipantId: actorId,
    targetNpcParticipantId: targetId,
    entryType: "argument",
    argument: {
      argumentTypeId: argTypeId,
      summary,
      detailsGM,
      claimedMotivationId,
      triggeredPitfallId,
    },
    roll: {
      mode: rollMode,
      formula: payload.roll?.formula ?? "",
      total: rollTotal,
      tier,
      visibleToPlayers: !!payload.roll?.visibleToPlayers,
    },
    effects: effectsApplied,
    isRevealedToPlayers: entryVisible,
  };

  seg.entries.push(entry);

  // Apply effects to state.
  const afterEffects = applyEffects(next, effectsApplied);
  return { nextState: afterEffects, entry, effectsApplied };
}

/**
 * Evaluate end conditions for a particular NPC.
 * If npcParticipantId is omitted, uses the first active NPC.
 */
export function evaluateEndConditions(state, rules, npcParticipantId = null) {
  const npcId = npcParticipantId
    ?? _first(state.participants ?? [], (p) => p.kind === "npc" && p.isActive)?.id
    ?? _first(state.participants ?? [], (p) => p.kind === "npc")?.id;
  if (!npcId) return null;

  const npc = _getNpcState(state, npcId);
  if (!npc) return null;

  const interest = Number(npc.interest?.value ?? 0);
  const patience = Number(npc.patience?.value ?? 0);

  if (interest <= 0) return { status: "failure", outcomeId: "offer0", npcId };
  if (interest >= 5) return { status: "success", outcomeId: "offer5", npcId };
  if (patience <= 0) {
    const offer = rules?.offersByInterest?.[_clamp(interest, 0, 5)]?.id ?? "";
    return { status: "ended", outcomeId: offer, npcId };
  }
  return null;
}

function _formatOfferLabel(rules, interestValue) {
  const v = _clamp(Number(interestValue ?? 0), 0, 5);
  return rules?.offersByInterest?.[v]?.label ?? "";
}

export function renderPublicSummary(state, rules) {
  const title = state.title || "Negotiation";
  const lines = [];

  for (const p of (state.participants ?? [])) {
    if (p.kind !== "npc") continue;
    const npc = _getNpcState(state, p.id);
    if (!npc) continue;
    const offer = _formatOfferLabel(rules, npc.interest?.value);
    lines.push(`${p.displayName}: ${offer}`);
  }

  if (lines.length === 0) return `${title}`;
  return `${title}\n${lines.join("\n")}`;
}

export function renderGmSummary(state, rules) {
  const base = renderPublicSummary(state, rules);
  const gmBits = [];

  const gmContext = String(state.setup?.contextGM ?? "").trim();
  if (gmContext) gmBits.push(`GM: ${gmContext}`);

  for (const p of (state.participants ?? [])) {
    if (p.kind !== "npc") continue;
    const npc = _getNpcState(state, p.id);
    if (!npc) continue;
    const hiddenM = (npc.motivations ?? []).filter((m) => !m.isRevealed).map((m) => m.label).filter(Boolean);
    const hiddenP = (npc.pitfalls ?? []).filter((x) => !x.isRevealed).map((x) => x.label).filter(Boolean);
    if (hiddenM.length) gmBits.push(`${p.displayName} hidden motivations: ${hiddenM.join(", ")}`);
    if (hiddenP.length) gmBits.push(`${p.displayName} hidden pitfalls: ${hiddenP.join(", ")}`);
  }

  if (!gmBits.length) return base;
  return `${base}\n\n${gmBits.join("\n")}`;
}

function _rangeLabel(value) {
  const v = Number(value ?? 0);
  if (v <= 1) return "Low";
  if (v <= 3) return "Mid";
  return "High";
}

/**
 * Redact state for a non-GM viewer (visibility + reveal controls).
 * @param {object} state
 * @param {{isGM: boolean}} viewer
 */
export function redactForViewer(state, viewer) {
  if (viewer?.isGM) return _clone(state);

  const redacted = _clone(state);
  const vis = redacted?.setup?.visibility ?? {};

  // GM-only setup
  if (redacted.setup) redacted.setup.contextGM = "";

  // GM-only participant fields
  for (const p of (redacted.participants ?? [])) {
    if (p) p.notesGM = "";
  }

  // NPC visibility
  const showNpcNames = !!vis.showNpcNames;
  const showInterest = vis.showInterest ?? "hidden";
  const showPatience = vis.showPatience ?? "hidden";

  for (const p of (redacted.participants ?? [])) {
    if (p.kind !== "npc") continue;
    if (!showNpcNames) p.displayName = "NPC";

    const npc = (redacted.npcStateByParticipantId ?? {})[p.id];
    if (!npc) continue;

    // Hide unrevealed motivations/pitfalls
    npc.motivations = (npc.motivations ?? []).filter((m) => !!m.isRevealed);
    npc.pitfalls = (npc.pitfalls ?? []).filter((x) => !!x.isRevealed);

    // Hide or coarsen track values
    if (showInterest === "hidden") npc.interest = null;
    else if (showInterest === "range" && npc.interest) {
      npc.interest = { ...npc.interest, display: _rangeLabel(npc.interest.value) };
    }

    if (showPatience === "hidden") npc.patience = null;
    else if (showPatience === "range" && npc.patience) {
      npc.patience = { ...npc.patience, display: _rangeLabel(npc.patience.value) };
    }
  }

  // Timeline: only revealed entries; strip GM-only details and roll totals if hidden.
  const showArgumentDetails = !!vis.showArgumentDetails;
  const showRollTotals = !!vis.showRollTotals;

  for (const seg of (redacted.timeline ?? [])) {
    seg.entries = (seg.entries ?? []).filter((e) => !!e.isRevealedToPlayers).map((e) => {
      const ne = { ...e };

      if (ne.test) {
        ne.test = { ...ne.test, detailsGM: "" };
        if (!showArgumentDetails) ne.test.summary = "";
      }

      if (ne.argument) {
        ne.argument = { ...ne.argument, detailsGM: "" };
        if (!showArgumentDetails) {
          ne.argument.summary = "";
          ne.argument.argumentTypeId = "";
          ne.argument.claimedMotivationId = null;
          ne.argument.triggeredPitfallId = null;
        }
      }

      if (ne.note) {
        ne.note = { ...ne.note, detailsGM: "" };
        if (!showArgumentDetails) ne.note.summary = "";
      }

      if (ne.adjustment) {
        ne.adjustment = { ...ne.adjustment, detailsGM: "" };
        if (!showArgumentDetails) ne.adjustment.summary = "";
      }

      if (ne.reveal) {
        ne.reveal = { ...ne.reveal, detailsGM: "" };
        if (!showArgumentDetails) {
          ne.reveal.label = "";
          ne.reveal.id = "";
          ne.reveal.kind = "";
        }
      }

      if (ne.roll) {
        const visible = !!ne.roll.visibleToPlayers;
        if (!showRollTotals || !visible) {
          ne.roll = { ...ne.roll, formula: "", total: null };
        }
      }

      ne.effects = (ne.effects ?? []).filter((x) => !!x.visibleToPlayers);
      return ne;
    });
  }

  // Resolution: no GM summary
  if (redacted.resolution) redacted.resolution.summaryGM = "";
  return redacted;
}

/**
 * Compute tier + effects for an argument without mutating the provided state.
 * Useful for UI previews.
 */
export function previewArgumentEntry(state, rules, payload, options = {}) {
  const { entry, effectsApplied } = addArgumentEntry(_clone(state), rules, payload, options);
  return {
    tier: entry?.roll?.tier ?? null,
    effectsApplied: effectsApplied ?? [],
    profileKey: entry?.effects?.[0]?.reason ?? "",
  };
}

function _ensureSegment(next, options = {}) {
  next.timeline ??= [];
  if (next.timeline.length === 0) {
    next.timeline.push({ id: _safeId(options.idFn), index: 1, label: "Negotiation", entries: [] });
  }
  const seg = _currentSegment(next);
  seg.entries ??= [];
  return seg;
}

/**
 * Add a test result entry (manual tracking).
 * This is intentionally lightweight: the GM records a summary, optional total, and manual deltas.
 */
export function addTestEntry(state, payload, options = {}) {
  const next = _clone(state);
  next.npcStateByParticipantId ??= {};
  const seg = _ensureSegment(next, options);

  const actorId = payload.actorParticipantId ?? "";
  const targetId = payload.targetNpcParticipantId ?? "";
  const target = _getParticipant(next, targetId);
  const npc = _getNpcState(next, targetId);
  if (!target || target.kind !== "npc" || !npc) {
    return { nextState: next, entry: null, effectsApplied: [] };
  }

  const entryVisible = !!payload.isRevealedToPlayers;
  const vis = next?.setup?.visibility ?? {};
  const showInterest = vis.showInterest ?? "value";
  const showPatience = vis.showPatience ?? "value";

  const interestDelta = Number(payload.interestDelta ?? 0);
  const patienceDelta = Number(payload.patienceDelta ?? 0);

  const effectsApplied = [];
  if (Number.isFinite(interestDelta) && interestDelta !== 0) {
    effectsApplied.push({
      stat: "interest",
      delta: interestDelta,
      appliedToNpcParticipantId: targetId,
      reason: "test",
      visibleToPlayers: entryVisible && showInterest !== "hidden",
    });
  }
  if (Number.isFinite(patienceDelta) && patienceDelta !== 0) {
    effectsApplied.push({
      stat: "patience",
      delta: patienceDelta,
      appliedToNpcParticipantId: targetId,
      reason: "test",
      visibleToPlayers: entryVisible && showPatience !== "hidden",
    });
  }

  const totalRaw = payload.rollTotal;
  const rollTotal = (totalRaw === "" || totalRaw === undefined || totalRaw === null) ? null : Number(totalRaw);
  const rollVisible = !!payload.rollVisibleToPlayers;

  const entry = {
    id: _safeId(options.idFn),
    timestampIso: _nowIso(),
    actorParticipantId: actorId,
    targetNpcParticipantId: targetId,
    entryType: "test",
    test: {
      summary: String(payload.summary ?? ""),
      detailsGM: String(payload.detailsGM ?? ""),
    },
    roll: (rollTotal === null)
      ? null
      : {
        mode: "manualTotal",
        formula: "",
        total: rollTotal,
        tier: null,
        visibleToPlayers: rollVisible,
      },
    effects: effectsApplied,
    isRevealedToPlayers: entryVisible,
  };

  seg.entries.push(entry);
  const after = applyEffects(next, effectsApplied);
  return { nextState: after, entry, effectsApplied };
}

/**
 * Add a note entry (no mechanical effects).
 */
export function addNoteEntry(state, payload, options = {}) {
  const next = _clone(state);
  const seg = _ensureSegment(next, options);

  const entry = {
    id: _safeId(options.idFn),
    timestampIso: _nowIso(),
    actorParticipantId: payload.actorParticipantId ?? "",
    targetNpcParticipantId: payload.targetNpcParticipantId ?? "",
    entryType: "note",
    note: {
      summary: String(payload.summary ?? ""),
      detailsGM: String(payload.detailsGM ?? ""),
    },
    roll: null,
    effects: [],
    isRevealedToPlayers: !!payload.isRevealedToPlayers,
  };

  seg.entries.push(entry);
  return { nextState: next, entry, effectsApplied: [] };
}

/**
 * Add an adjustment entry (manual deltas applied to a target NPC).
 */
export function addAdjustmentEntry(state, rules, payload, options = {}) {
  const next = _clone(state);
  next.npcStateByParticipantId ??= {};
  const seg = _ensureSegment(next, options);

  const targetId = payload.targetNpcParticipantId;
  const target = _getParticipant(next, targetId);
  const npc = _getNpcState(next, targetId);
  if (!target || target.kind !== "npc" || !npc) {
    return { nextState: next, entry: null, effectsApplied: [] };
  }

  const interestDelta = Number(payload.interestDelta ?? 0);
  const patienceDelta = Number(payload.patienceDelta ?? 0);
  const entryVisible = !!payload.isRevealedToPlayers;
  const vis = next?.setup?.visibility ?? {};
  const showInterest = vis.showInterest ?? "value";
  const showPatience = vis.showPatience ?? "value";

  const effectsApplied = [];
  if (Number.isFinite(interestDelta) && interestDelta !== 0) {
    effectsApplied.push({
      stat: "interest",
      delta: interestDelta,
      appliedToNpcParticipantId: targetId,
      reason: "adjustment",
      visibleToPlayers: entryVisible && showInterest !== "hidden",
    });
  }
  if (Number.isFinite(patienceDelta) && patienceDelta !== 0) {
    effectsApplied.push({
      stat: "patience",
      delta: patienceDelta,
      appliedToNpcParticipantId: targetId,
      reason: "adjustment",
      visibleToPlayers: entryVisible && showPatience !== "hidden",
    });
  }

  const entry = {
    id: _safeId(options.idFn),
    timestampIso: _nowIso(),
    actorParticipantId: payload.actorParticipantId ?? "",
    targetNpcParticipantId: targetId,
    entryType: "adjustment",
    adjustment: {
      summary: String(payload.summary ?? ""),
      detailsGM: String(payload.detailsGM ?? ""),
    },
    roll: null,
    effects: effectsApplied,
    isRevealedToPlayers: entryVisible,
  };

  seg.entries.push(entry);
  const after = applyEffects(next, effectsApplied);
  return { nextState: after, entry, effectsApplied };
}

/**
 * Add a reveal entry, optionally driven by a discovery test roll.
 * - If roll is provided, patience delta is applied per rules.discoveryTest.byTier.
 * - If tier learns "one", reveals the first unrevealed motivation, else pitfall.
 */
export function addDiscoveryEntry(state, rules, payload, options = {}) {
  const next = _clone(state);
  next.npcStateByParticipantId ??= {};
  const seg = _ensureSegment(next, options);

  const actorId = payload.actorParticipantId;
  const targetId = payload.targetNpcParticipantId;
  const actor = _getParticipant(next, actorId);
  const target = _getParticipant(next, targetId);
  const npc = _getNpcState(next, targetId);
  if (!actor || !target || target.kind !== "npc" || !npc) {
    return { nextState: next, entry: null, effectsApplied: [] };
  }

  const entryVisible = !!payload.isRevealedToPlayers;
  const revealToPlayers = !!payload.revealToPlayers;

  const totalRaw = payload.rollTotal;
  const rollTotal = (totalRaw === "" || totalRaw === undefined || totalRaw === null) ? null : Number(totalRaw);
  let discoveryTier = rollTotal === null ? null : computeTier(rules, rollTotal);
  if (!discoveryTier) discoveryTier = rollTotal === null ? null : 2;

  let kind = String(payload.kind ?? "").trim();
  let detailId = String(payload.detailId ?? "").trim();

  let label = String(payload.label ?? "").trim();
  if (!label && detailId) {
    if (kind === "motivation") {
      label = (rules?.motivations ?? []).find((m) => m?.id === detailId)?.label ?? "";
    } else if (kind === "pitfall") {
      label = (rules?.pitfalls ?? []).find((p) => p?.id === detailId)?.label ?? "";
    }
  }

  // Optionally attach the revealed detail to the NPC profile if it's not already present.
  npc.motivations ??= [];
  npc.pitfalls ??= [];
  npc.discovered ??= { motivations: [], pitfalls: [] };

  // If this is a discovery roll (no explicit detail requested), learn one detail on tier 3.
  if ((!kind || !detailId) && discoveryTier !== null) {
    const learns = rules?.discoveryTest?.byTier?.[discoveryTier]?.learns ?? "none";
    if (learns === "one") {
      const unrevealedMotivation = (npc.motivations ?? []).find((m) => m && !m.isRevealed);
      const unrevealedPitfall = (npc.pitfalls ?? []).find((p) => p && !p.isRevealed);
      const pick = unrevealedMotivation ? { kind: "motivation", id: unrevealedMotivation.id, label: unrevealedMotivation.label }
        : unrevealedPitfall ? { kind: "pitfall", id: unrevealedPitfall.id, label: unrevealedPitfall.label }
          : null;
      if (pick) {
        kind = pick.kind;
        detailId = pick.id;
        if (!label) label = pick.label;
      }
    }
  }

  if (kind === "motivation" && detailId) {
    let m = npc.motivations.find((x) => x?.id === detailId);
    if (!m) {
      m = { id: detailId, label, isRevealed: false };
      npc.motivations.push(m);
    }
    m.label = m.label || label;
    m.isRevealed = revealToPlayers;
    if (!npc.discovered.motivations.includes(detailId)) npc.discovered.motivations.push(detailId);
  }
  if (kind === "pitfall" && detailId) {
    let p = npc.pitfalls.find((x) => x?.id === detailId);
    if (!p) {
      p = { id: detailId, label, isRevealed: false };
      npc.pitfalls.push(p);
    }
    p.label = p.label || label;
    p.isRevealed = revealToPlayers;
    if (!npc.discovered.pitfalls.includes(detailId)) npc.discovered.pitfalls.push(detailId);
  }

  const effectsApplied = [];

  // Apply patience delta for discovery rolls.
  if (discoveryTier !== null) {
    const patienceDelta = Number(rules?.discoveryTest?.byTier?.[discoveryTier]?.patienceDelta ?? 0);
    const vis = next?.setup?.visibility ?? {};
    const showPatience = vis.showPatience ?? "value";
    if (Number.isFinite(patienceDelta) && patienceDelta !== 0) {
      effectsApplied.push({
        stat: "patience",
        delta: patienceDelta,
        appliedToNpcParticipantId: targetId,
        reason: rules?.discoveryTest?.id ?? "discover",
        visibleToPlayers: entryVisible && showPatience !== "hidden",
      });
    }
  }

  const entry = {
    id: _safeId(options.idFn),
    timestampIso: _nowIso(),
    actorParticipantId: actorId,
    targetNpcParticipantId: targetId,
    entryType: "reveal",
    reveal: {
      kind,
      id: detailId,
      label,
      detailsGM: String(payload.detailsGM ?? ""),
    },
    roll: (rollTotal === null)
      ? null
      : {
        mode: "manualTotal",
        formula: "",
        total: rollTotal,
        tier: discoveryTier,
        visibleToPlayers: false,
      },
    effects: effectsApplied,
    isRevealedToPlayers: entryVisible,
  };

  seg.entries.push(entry);
  const after = applyEffects(next, effectsApplied);
  return { nextState: after, entry, effectsApplied };
}
