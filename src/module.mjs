/**
 * Draw Steel Negotiation Test Tool
 * Main module entry point — registers hooks, Item type, sheet, and API.
 */

import { MODULE_ID, SYSTEM_ID, NEGOTIATION_TEST_ITEM_TYPE } from "./config.mjs";
import { NegotiationAPI } from "./negotiation/negotiation-api.mjs";
import { NegotiationTestDataModel } from "./negotiation/negotiation-test-model.mjs";
import { NegotiationTestSheet } from "./negotiation/negotiation-test-sheet.mjs";

const log = (...args) => console.log(`${MODULE_ID} |`, ...args);

/**
 * Register (or re-register) our data model and type label into CONFIG.Item.
 * Called in both init and setup because Draw Steel may finalize CONFIG.Item.dataModels
 * during its own init, after module init hooks run.
 */
function _registerDataModel() {
  CONFIG.Item.typeLabels ??= {};
  CONFIG.Item.dataModels ??= {};

  CONFIG.Item.typeLabels[NEGOTIATION_TEST_ITEM_TYPE] = "NEGOTIATION.Item.NegotiationTest";

  if (!Object.isExtensible(CONFIG.Item.dataModels)) {
    try {
      CONFIG.Item.dataModels = {
        ...CONFIG.Item.dataModels,
        [NEGOTIATION_TEST_ITEM_TYPE]: NegotiationTestDataModel,
      };
    } catch {
      /* CONFIG.Item itself is sealed */
    }
  } else {
    CONFIG.Item.dataModels[NEGOTIATION_TEST_ITEM_TYPE] = NegotiationTestDataModel;
  }
}

let _systemValid = false;

Hooks.once("init", () => {
  if (game.system?.id !== SYSTEM_ID) return;
  _systemValid = true;

  _registerDataModel();

  const sheetConfig = foundry.applications?.sheets?.DocumentSheetConfig ?? globalThis.DocumentSheetConfig;
  if (sheetConfig?.registerSheet) {
    sheetConfig.registerSheet(Item, MODULE_ID, NegotiationTestSheet, {
      types: [NEGOTIATION_TEST_ITEM_TYPE],
      makeDefault: true,
      label: "NEGOTIATION.Item.NegotiationTest",
    });
  }

  foundry.applications.handlebars.loadTemplates([
    `modules/${MODULE_ID}/templates/items/negotiation-test/negotiation-test-sheet.hbs`,
    `modules/${MODULE_ID}/templates/chat/negotiation-argument.hbs`,
    `modules/${MODULE_ID}/templates/chat/negotiation-summary.hbs`,
  ]);

  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("and", (a, b) => !!a && !!b);
  Handlebars.registerHelper("or", (a, b) => !!a || !!b);

  log("Initialized");
});

Hooks.once("setup", () => {
  if (!_systemValid) return;
  _registerDataModel();
});

Hooks.once("ready", () => {
  if (!_systemValid) return;

  // Public API
  game.modules.get(MODULE_ID).api = new NegotiationAPI();
  log("Ready");
});
