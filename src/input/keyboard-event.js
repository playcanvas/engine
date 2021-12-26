/** @typedef {import('./keyboard.js').Keyboard} Keyboard */

/**
 * The KeyboardEvent is passed into all event callbacks from the {@link Keyboard}. It corresponds
 * to a key press or release.
 *
 * @property {number} key The keyCode of the key that has changed. See the KEY_* constants.
 * @property {Element} element The element that fired the keyboard event.
 * @property {globalThis.KeyboardEvent} event The original browser event which was fired.
 */
class KeyboardEvent {
    /**
     * Create a new KeyboardEvent.
     *
     * @param {Keyboard} keyboard - The keyboard object which is firing the event.
     * @param {globalThis.KeyboardEvent} event - The original browser event that was fired.
     * @example
     * var onKeyDown = function (e) {
     *     if (e.key === pc.KEY_SPACE) {
     *         // space key pressed
     *     }
     *     e.event.preventDefault(); // Use original browser event to prevent browser action.
     * };
     * app.keyboard.on("keydown", onKeyDown, this);
     */
    constructor(keyboard, event) {
        if (event) {
            this.key = event.keyCode;
            this.element = event.target;
            this.event = event;
        } else {
            this.key = null;
            this.element = null;
            this.event = null;
        }
    }
}

export { KeyboardEvent };
