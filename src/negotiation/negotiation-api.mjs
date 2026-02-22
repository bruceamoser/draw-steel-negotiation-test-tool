import { NEGOTIATION_TEST_ITEM_TYPE } from "../config.mjs";

/**
 * Public API exposed on `game.modules.get("draw-steel-negotiation").api`.
 * Item-centric helpers for creating and opening Negotiation Test items.
 */
export class NegotiationAPI {
  /**
   * Create a new Negotiation Test item in the world.
   * @param {object} [options]
   * @param {string} [options.name]
   * @param {boolean} [options.renderSheet]
   */
  async createNegotiationTest(options = {}) {
    if (!game.user.isGM) throw new Error("Only the GM can create a negotiation test.");

    let item;
    try {
      item = await Item.create({
        name: options.name ?? game.i18n.localize("NEGOTIATION.Item.DefaultName"),
        type: NEGOTIATION_TEST_ITEM_TYPE,
      });
    } catch (err) {
      ui.notifications?.error?.(`Failed to create Negotiation Test item: ${err?.message ?? err}`);
      throw err;
    }

    if (options.renderSheet) item?.sheet?.render(true);
    return item;
  }

  /** Open the Items sidebar tab. */
  openItemsDirectory() {
    ui.sidebar.activateTab("items");
  }
}
