# Draw Steel — Negotiation Test Tool

[![Foundry VTT](https://img.shields.io/badge/Foundry_VTT-v13-orange?style=flat-square)](https://foundryvtt.com)
[![System](https://img.shields.io/badge/System-Draw_Steel-blue?style=flat-square)](https://github.com/MetaMorphic-Digital/draw-steel)
[![Version](https://img.shields.io/badge/version-0.3.0-brightgreen?style=flat-square)](https://github.com/bruceamoser/draw-steel-negotiation-test-tool/releases/latest)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

A [Foundry VTT](https://foundryvtt.com) module for the [Draw Steel](https://mcdmproductions.com) RPG system that adds a dedicated **Negotiation Test Item** — a persistent sheet for tracking participants, NPC Interest/Patience, arguments, discoveries, and resolution.

Negotiation Test Items live in the World Items directory, so they benefit from Foundry's built-in duplication, folder organization, compendium storage, and permission controls.

---

## Features

| Feature | Detail |
|---|---|
| **Negotiation Test Item type** | Custom `Item` sub-type registered against the Draw Steel system; appears in the Create Item dialog |
| **4-tab ApplicationV2 sheet** | Overview, Participants, NPC Profile, and Actions tabs -- built on Foundry v13 `HandlebarsApplicationMixin(ItemSheetV2)` |
| **Rich text editors** | Overview, Success, Partial Success, and Failure outcome fields use live ProseMirror editors that save on blur |
| **Participants** | Add PCs/NPCs by drag & drop of Actors; or create placeholder participants without an Actor link |
| **NPC Profile** | Track Interest and Patience (with min/max range), manage Motivations and Pitfalls, reveal each to players individually |
| **Arguments & Discoveries** | Log argument entries (PC, tier, type, motivation/pitfall claimed) and discovery entries with full timeline display |
| **Player redaction** | Players see a redacted view; motivations/pitfalls and action log entries are only shown once revealed |
| **Outcome & summaries** | Start, Stop, and Resolve the negotiation; copy the formatted summary to clipboard |

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

### Manual

1. Download the zip from the [latest release](https://github.com/bruceamoser/draw-steel-negotiation-test-tool/releases/latest).
2. Extract into your Foundry `Data/modules/` directory (folder name: `draw-steel-negotiation/`).
3. Restart Foundry VTT and enable the module.

---

## How to Use

### 1 — Create a Negotiation Test

As GM, open the **Items** sidebar tab and click **Create Item**. Choose the type **Negotiation Test** and give it a name.

### 2 — Add Participants (Participants tab)

- **Drag & drop** PC and NPC Actors from the Actor sidebar onto the sheet.
- Or click **Add PC** / **Add NPC** to create a participant manually (without an Actor link).
- Participants appear in a table showing Name, Kind (PC/NPC), Role, and Active status.
- Use the remove button to delete a participant row.

> Only one NPC participant is supported per negotiation.

### 3 — Write the Overview (Overview tab)

Click into any of the four rich-text editor fields:

| Field | Purpose |
|---|---|
| **Overview** | Scene-setting narrative visible to the GM |
| **Success** | What happens on a full success |
| **Partial Success** | What happens on a partial success |
| **Failure** | What happens on a failure |

Content saves automatically when the editor loses focus. Players without GM access see read-only enriched HTML.

### 4 — Configure the NPC Profile (NPC Profile tab)

- Set **Interest** and **Patience** values (shown with min/max range for context).
- Use the dropdowns to **Add Motivations** and **Pitfalls** from the configured lists.
- Toggle **Revealed** on each motivation or pitfall to control what players can see.
- Use the remove button to delete individual entries.

### 5 — Run the Negotiation (Actions tab)

**GM controls (top of tab):**

| Button | Effect |
|---|---|
| **Start** | Marks the negotiation as active |
| **Stop** | Pauses the negotiation |
| **Resolve** | Computes the final outcome based on Interest/Patience |
| **Copy Summary** | Copies the formatted outcome summary to clipboard |

**Add Argument form:**

- Choose the arguing **PC**, the **Tier** of the roll (1/2/3), **Argument Type**, **Motivation Used**, and **Pitfall Triggered**.
- Check **Reveal to Players** to immediately show the entry in the player's action log.
- Click **Add** to append the entry to the timeline.

**Add Discovery form:**

- Choose the discovering **PC** and **Tier**.
- Check **Reveal to Players** to show the entry.
- Click **Add** to log the discovery.

**Action Log:**

- GM sees all entries; players see only entries marked as revealed.
- Each entry shows the actor name, entry type, tier badge, and effects.

---

## Player Visibility

Players can open a Negotiation Test sheet if given **Observer** (or higher) permission on the item.

When a player opens the sheet:

- **Overview tab**: editors render as enriched rich text (not editable).
- **NPC Profile tab**: motivations and pitfalls are hidden unless the GM has toggled **Revealed**.
- **Actions tab**: only argument/discovery entries with **Reveal to Players** checked are shown.
- The NPC's Interest and Patience values are always visible to players.

---

## Development

```bash
npm install
```

### Build a Foundry zip

```bash
npm run build
npm run build:clean
```

### Publish via GitHub Releases

Requires the [GitHub CLI](https://cli.github.com/) authenticated with `gh auth login`.

```bash
npm run build:clean
npm run release
```

Or create a draft release:

```bash
npm run release:draft
```

---

## License

This module is released under the [MIT License](LICENSE).

**Draw Steel** is a trademark of MCDM Productions, LLC. This module is an independent community project and is not affiliated with or endorsed by MCDM Productions, LLC.
