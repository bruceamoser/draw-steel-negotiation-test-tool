/**
 * Module constants and configuration for Draw Steel Negotiation Test Tool
 */
export const MODULE_ID = "draw-steel-negotiation";
export const SYSTEM_ID = "draw-steel";

// Must match module.json -> documentTypes.Item.negotiationTest
export const NEGOTIATION_TEST_SUBTYPE = "negotiationTest";

// Foundry namespaces module-defined document subtypes at runtime.
// Example: moduleId + "." + subtype
// This *namespaced* string is what will appear in Item.TYPES and what the Draw Steel system expects.
export const NEGOTIATION_TEST_ITEM_TYPE = `${MODULE_ID}.${NEGOTIATION_TEST_SUBTYPE}`;
