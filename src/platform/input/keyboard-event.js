/**
 * The KeyboardEvent is passed into all event callbacks from the {@link Keyboard}. It corresponds
 * to a key press or release.
 *
 * @category Input
 */
class KeyboardEvent {
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
            /**
             * The keyCode of the key that has changed. See the KEY_* constants.
             *
             * @type {number}
             */
            this.key = event.keyCode;
            /**
             * The element that fired the keyboard event.
             *
             * @type {Element}
             */
            this.element = event.target;
            /**
             * The original browser event which was fired.
             *
             * @type {globalThis.KeyboardEvent}
             */
            this.event = event;
        } else {
            this.key = null;
            this.element = null;
            this.event = null;
        }
    }
}

export { KeyboardEvent };
