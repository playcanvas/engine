/**
 * The KeyboardEvent is passed into all event callbacks from the {@link Keyboard}. It corresponds
 * to a key press or release.
 *
 * @category Input
 */
class KeyboardEvent {
    /**
     * The keyCode of the key that has changed. See the KEY_* constants.
     *
     * @type {number|null}
     */
    key = null;

    /**
     * The element that fired the keyboard event.
     *
     * @type {Element|null}
     */
    element = null;

    /**
     * The original browser event which was fired.
     *
     * @type {globalThis.KeyboardEvent|null}
     */
    event = null;

    /**
     * Create a new KeyboardEvent.
     *
     * @param {import('./keyboard.js').Keyboard} keyboard - The keyboard object which is firing the
     * event.
     * @param {globalThis.KeyboardEvent} event - The original browser event that was fired.
     * @example
     * const onKeyDown = function (e) {
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
        }
    }
}

export { KeyboardEvent };
