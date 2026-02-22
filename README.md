# Draw Steel — Negotiation Test Tool

[![Foundry VTT](https://img.shields.io/badge/Foundry_VTT-v13-orange?style=flat-square)](https://foundryvtt.com)
[![System](https://img.shields.io/badge/System-Draw_Steel-blue?style=flat-square)](https://github.com/MetaMorphic-Digital/draw-steel)
[![Version](https://img.shields.io/badge/version-0.1.1-brightgreen?style=flat-square)](https://github.com/bruceamoser/draw-steel-negotiation-test-tool/releases/latest)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

A [Foundry VTT](https://foundryvtt.com) module for the [Draw Steel](https://mcdmproductions.com) RPG system that adds a dedicated **Negotiation Test Item** — a persistent sheet for tracking participants, NPC Interest/Patience, arguments, discoveries, and resolution.

Negotiation Test Items live in the World Items directory, so they benefit from Foundry's built-in duplication, folder organization, compendium storage, and permission controls.

---

## Features

| Feature | Detail |
|---|---|
| **Negotiation Test Item type** | Custom `Item` sub-type registered against the Draw Steel system; appears in the Create Item dialog with the label “Negotiation Test” |
| **Participants** | Add PCs/NPCs by **drag & drop** of Actors; or create an NPC participant without an Actor |
| **NPC Profile** | Track **Interest** and **Patience**, manage NPC **Motivations** and **Pitfalls**, and reveal individual motivations/pitfalls over time |
| **Timeline / entries** | Log **Arguments**, **Notes**, **Adjustments**, and **Discovery** reveals; entries support controlled player visibility |
| **Optional rolls** | Record no roll, a manual total, or have Foundry evaluate a roll formula; tiers and effects compute from totals |
| **Chat cards** | Post individual argument entries and post a negotiation summary to chat (public + GM whisper) |
| **Player redaction** | Players viewing the item sheet see a redacted view based on the visibility settings and what you’ve revealed |
| **Outcome & summaries** | Resolve the negotiation, compute an outcome label, and generate both public and GM summary text |

---

## Requirements

| Requirement | Version |
|---|---|
| [Foundry VTT](https://foundryvtt.com/) | v13 (13.351+) |
| [Draw Steel System](https://github.com/MetaMorphic-Digital/draw-steel) | 0.9.0+ |

This module only initialises in worlds using the Draw Steel game system.

---

## Installation

### Manifest URL (Recommended)

1. In Foundry VTT, go to **Add-on Modules → Install Module**.
2. Paste the manifest URL into the **Manifest URL** field:
	 ```
	 https://github.com/bruceamoser/draw-steel-negotiation-test-tool/releases/latest/download/module.json
	 ```
3. Click **Install**.
4. Enable **Draw Steel — Negotiation Test Tool** in your world under **Settings → Manage Modules**.

> Note: GitHub Releases must include `module.json` as a release asset for this install method. If your release only includes the zip, use the Manual install below.

### Manual

1. Download the zip from the [latest release](https://github.com/bruceamoser/draw-steel-negotiation-test-tool/releases/latest).
2. Extract the zip into your Foundry `Data/modules/` directory.
	 - The folder should be named `draw-steel-negotiation/`.
3. Restart Foundry VTT (or reload) and enable the module.

---

## How to Use

### 1 — Create a Negotiation Test

As GM, open the **Items** sidebar tab and click **Create Item**. Choose the type **Negotiation Test** and give it a name.

You can also create one via macro:

```js
game.modules.get("draw-steel-negotiation").api.createNegotiationTest({
	name: "My Negotiation",
	renderSheet: true,
});
```

### 2 — Add participants

- Drag & drop PC and NPC Actors onto the item sheet.
- Or click **Add NPC (no Actor)** to create a standalone NPC participant.

### 3 — Configure stakes and context

In the **Overview** tab:

- Set **Success Stakes**, **Failure Stakes**, and **Public Context**.
- (GM-only) Set **GM Context**.
- Use **Start** to begin, **Next** to advance rounds/stages (if enabled), and **Resolve** to generate summaries.
- Use **Post Summary** to send the result to chat.

### 4 — Maintain NPC profiles

In the **NPC Profile** tab (GM):

- Adjust **Interest** and **Patience**.
- Add **Motivations** and **Pitfalls** from the configured lists.
- Toggle **Revealed** per motivation/pitfall to control what players can see.

### 5 — Log the negotiation in the Timeline

In the **Arguments / Timeline** tab (GM):

- **Add Argument**
	- Choose an actor (PC), target (NPC), and argument type.
	- Optionally record a claimed motivation or triggered pitfall.
	- Choose a roll mode:
		- **None** (no total recorded)
		- **Manual total** (you type the total)
		- **Foundry roll** (you provide a formula like `2d10+Presence` and Foundry evaluates it)
	- Toggle **Roll visible to players** and **Reveal entry to players**.
	- Optionally **Post to Chat** to create a public argument card.

- **Add Reveal (Discovery test)**
	- Records a discovery attempt against an NPC and can reveal a motivation/pitfall.
	- Roll totals can be public or hidden, and the discovered detail can be immediately revealed or kept GM-only.

- **Add Note**
	- Records a general note (public summary + GM details).

- **Add Adjustment**
	- Applies manual Interest/Patience deltas (useful for edge cases or director overrides) with an optional player-facing summary.

### 6 — Resolve and share

In the **Result** tab:

- Review the computed outcome label.
- Edit the generated **Public Summary** (and **GM Summary**, GM-only) if desired.

Use **Post Summary** in the Overview tab to send:

- A public summary to chat.
- A GM-only whisper with extra details.

---

## Player Visibility & Ownership

- Players can open the Negotiation Test item sheet if you grant them **Observer** (or higher) permission.
- The **Settings → Visibility** options control what players see (NPC names, Interest/Patience display, argument details, roll totals).
- Individual motivations/pitfalls and timeline entries also have **reveal** toggles.

---

## Development

```bash
npm install
npm test
```

### Build a Foundry zip

Creates a zip in `dist/` containing a top-level module folder matching `module.json` → `id`.

```bash
npm run build
npm run build:clean
```

### Publish via GitHub Releases (gh CLI)

Prereqs:

- Install GitHub CLI: `gh`
- Authenticate locally: `gh auth login`

Then:

```bash
npm run build
npm run release
```

Or create a draft release:

```bash
npm run release:draft
```

You can pass a custom tag explicitly:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 -Tag v0.1.0 -Draft
```

---

## License

This module is released under the [MIT License](LICENSE).

**Draw Steel** is a trademark of MCDM Productions, LLC. This module is an independent community project and is not affiliated with or endorsed by MCDM Productions, LLC.
