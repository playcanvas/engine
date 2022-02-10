import { EventHandler } from '../core/event-handler.js';

/**
 * The graphics device manages the underlying graphics context. It is responsible for submitting
 * render state changes and graphics primitives to the hardware. A graphics device is tied to a
 * specific canvas HTML element. It is valid to have more than one canvas element per page and
 * create a new graphics device against each.
 *
 * @augments EventHandler
 */
class GraphicsDevice extends EventHandler {
    // don't stringify GraphicsDevice to JSON by JSON.stringify
    toJSON(key) {
        return undefined;
    }
}

export { GraphicsDevice };
