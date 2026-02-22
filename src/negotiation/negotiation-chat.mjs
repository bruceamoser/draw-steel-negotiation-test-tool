import { MODULE_ID } from "../config.mjs";
import { redactForViewer, renderPublicSummary, renderGmSummary } from "./negotiation-engine.mjs";
import { getRulesProfile } from "./negotiation-state.mjs";

export async function postArgumentToChat(item, entry) {
  const rules = getRulesProfile(item.system?.setup?.rulesProfileId);
  const state = redactForViewer(item.system, { isGM: false });

  const actor = (state.participants ?? []).find((p) => p.id === entry.actorParticipantId);
  const target = (state.participants ?? []).find((p) => p.id === entry.targetNpcParticipantId);
  const rollText = (entry.roll?.total != null) ? `${entry.roll.total} (T${entry.roll.tier ?? "?"})` : "";
  const effectsText = (entry.effects ?? [])
    .filter((e) => e.visibleToPlayers)
    .map((e) => `${e.stat} ${e.delta > 0 ? "+" : ""}${e.delta}`)
    .join(", ");

  const html = await renderTemplate(`modules/${MODULE_ID}/templates/chat/negotiation-argument.hbs`, {
    title: item.name,
    actorName: actor?.displayName ?? "",
    targetName: target?.displayName ?? "",
    summary: entry.argument?.summary ?? "",
    roll: rollText,
    effects: effectsText,
  });

  await ChatMessage.create({
    content: html,
    speaker: ChatMessage.getSpeaker({}),
  });
}

export async function postSummaryToChat(item) {
  const rules = getRulesProfile(item.system?.setup?.rulesProfileId);
  const publicText = renderPublicSummary(redactForViewer(item.system, { isGM: false }), rules);
  const gmText = renderGmSummary(item.system, rules);

  const publicHtml = await renderTemplate(`modules/${MODULE_ID}/templates/chat/negotiation-summary.hbs`, {
    title: item.name,
    summary: publicText.replaceAll("\n", "<br />"),
  });
  await ChatMessage.create({ content: publicHtml, speaker: ChatMessage.getSpeaker({}) });

  // GM whisper with details
  const gmHtml = await renderTemplate(`modules/${MODULE_ID}/templates/chat/negotiation-summary.hbs`, {
    title: `${item.name} (GM)`,
    summary: gmText.replaceAll("\n", "<br />"),
  });
  const gmIds = game.users.filter((u) => u.isGM).map((u) => u.id);
  if (gmIds.length) {
    await ChatMessage.create({
      content: gmHtml,
      speaker: ChatMessage.getSpeaker({}),
      whisper: gmIds,
    });
  }
}
