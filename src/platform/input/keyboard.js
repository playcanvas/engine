import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';

import { KeyboardEvent } from './keyboard-event.js';

// internal global keyboard events
const _keyboardEvent = new KeyboardEvent();

/**
 * Convert a browser keyboard event to a PlayCanvas keyboard event.
 *
 * @param {globalThis.KeyboardEvent} event - A browser keyboard event.
 * @returns {KeyboardEvent} A PlayCanvas keyboard event.
 * @ignore
 */
function makeKeyboardEvent(event) {
    _keyboardEvent.key = event.keyCode;
    _keyboardEvent.element = event.target;
    _keyboardEvent.event = event;
    return _keyboardEvent;
}

/**
 * Convert a string or keycode to a keycode.
 *
 * @param {string|number} s - Either a character code or the key character.
 * @returns {number} The character code.
 * @ignore
 */
function toKeyCode(s) {
    if (typeof s === 'string') {
        return s.toUpperCase().charCodeAt(0);
    }
    return s;
}

const _keyCodeToKeyIdentifier = {
    '9': 'Tab',
    '13': 'Enter',
    '16': 'Shift',
    '17': 'Control',
    '18': 'Alt',
    '27': 'Escape',

    '37': 'Left',
    '38': 'Up',
    '39': 'Right',
    '40': 'Down',

    '46': 'Delete',

    '91': 'Win'
};

/**
 * A Keyboard device bound to an Element. Allows you to detect the state of the key presses. Note
 * that the Keyboard object must be attached to an Element before it can detect any key presses.
 *
 * @category Input
 */
class Keyboard extends EventHandler {
    /**
     * Fired when a key is pressed. The handler is passed a {@link KeyboardEvent}.
     *
     * @event
     * @example
     * const onKeyDown = (e) => {
     *     if (e.key === pc.KEY_SPACE) {
     *         // space key pressed
     *     }
     *     e.event.preventDefault(); // Use original browser event to prevent browser action.
     * };
     *
     * app.keyboard.on("keydown", onKeyDown, this);
     */
    static EVENT_KEYDOWN = 'keydown';

    /**
     * Fired when a key is released. The handler is passed a {@link KeyboardEvent}.
     *
     * @event
     * @example
     * const onKeyUp = (e) => {
     *     if (e.key === pc.KEY_SPACE) {
     *         // space key released
     *     }
     *     e.event.preventDefault(); // Use original browser event to prevent browser action.
     * };
     *
     * app.keyboard.on("keyup", onKeyUp, this);
     */
    static EVENT_KEYUP = 'keyup';

    /** @private */
    _element = null;

    /** @private */
    _keymap = {};

    /** @private */
    _lastmap = {};

    /**
     * Create a new Keyboard instance.
     *
     * @param {Element|Window} [element] - Element to attach Keyboard to. Note that elements like
     * &lt;div&gt; can't accept focus by default. To use keyboard events on an element like this it
     * must have a value of 'tabindex' e.g. tabindex="0". See
     * [here](https://www.w3.org/WAI/GL/WCAG20/WD-WCAG20-TECHS/SCR29.html) for more details.
     * @param {object} [options] - Optional options object.
     * @param {boolean} [options.preventDefault] - Call preventDefault() in key event handlers.
     * This stops the default action of the event occurring. e.g. Ctrl+T will not open a new
     * browser tab.
     * @param {boolean} [options.stopPropagation] - Call stopPropagation() in key event handlers.
     * This stops the event bubbling up the DOM so no parent handlers will be notified of the
     * event.
     * @example
     * // attach keyboard listeners to the window
     * const keyboard = new pc.Keyboard(window);
     */
    constructor(element, options = {}) {
        super();

        this._keyDownHandler = this._handleKeyDown.bind(this);
        this._keyUpHandler = this._handleKeyUp.bind(this);
        this._keyPressHandler = this._handleKeyPress.bind(this);
        this._visibilityChangeHandler = this._handleVisibilityChange.bind(this);
        this._windowBlurHandler = this._handleWindowBlur.bind(this);

        if (element) {
            this.attach(element);
        }

        this.preventDefault = options.preventDefault || false;
        this.stopPropagation = options.stopPropagation || false;
    }

    /**
     * Attach the keyboard event handlers to an Element.
     *
     * @param {Element|Window} element - The element to listen for keyboard events on.
     */
    attach(element) {
        if (this._element) {
            // remove previous attached element
            this.detach();
        }

        this._element = element;
        this._element.addEventListener('keydown', this._keyDownHandler, false);
        this._element.addEventListener('keypress', this._keyPressHandler, false);
        this._element.addEventListener('keyup', this._keyUpHandler, false);
        document.addEventListener('visibilitychange', this._visibilityChangeHandler, false);
        window.addEventListener('blur', this._windowBlurHandler, false);
    }

    /**
     * Detach the keyboard event handlers from the element it is attached to.
     */
    detach() {
        if (!this._element) {
            Debug.warn('Unable to detach keyboard. It is not attached to an element.');
            return;
        }

        this._element.removeEventListener('keydown', this._keyDownHandler);
        this._element.removeEventListener('keypress', this._keyPressHandler);
        this._element.removeEventListener('keyup', this._keyUpHandler);
        this._element = null;

        document.removeEventListener('visibilitychange', this._visibilityChangeHandler, false);
        window.removeEventListener('blur', this._windowBlurHandler, false);
    }

    /**
     * Convert a key code into a key identifier.
     *
     * @param {number} keyCode - The key code.
     * @returns {string} The key identifier.
     * @private
     */
    toKeyIdentifier(keyCode) {
        keyCode = toKeyCode(keyCode);

        const id = _keyCodeToKeyIdentifier[keyCode.toString()];
        if (id) {
            return id;
        }

        // Convert to hex and add leading 0's
        let hex = keyCode.toString(16).toUpperCase();
        const length = hex.length;
        for (let count = 0; count < (4 - length); count++) {
            hex = '0' + hex;
        }

        return 'U+' + hex;
    }

    /**
     * Process the browser keydown event.
     *
     * @param {globalThis.KeyboardEvent} event - The browser keyboard event.
     * @private
     */
    _handleKeyDown(event) {
        const code = event.keyCode || event.charCode;

        // Google Chrome auto-filling of login forms could raise a malformed event
        if (code === undefined) return;

        const id = this.toKeyIdentifier(code);

        this._keymap[id] = true;

        this.fire('keydown', makeKeyboardEvent(event));

        if (this.preventDefault) {
            event.preventDefault();
        }
        if (this.stopPropagation) {
            event.stopPropagation();
        }
    }

    /**
     * Process the browser keyup event.
     *
     * @param {globalThis.KeyboardEvent} event - The browser keyboard event.
     * @private
     */
    _handleKeyUp(event) {
        const code = event.keyCode || event.charCode;

        // Google Chrome auto-filling of login forms could raise a malformed event
        if (code === undefined) return;

        const id = this.toKeyIdentifier(code);

        delete this._keymap[id];

        this.fire('keyup', makeKeyboardEvent(event));

        if (this.preventDefault) {
            event.preventDefault();
        }
        if (this.stopPropagation) {
            event.stopPropagation();
        }
    }

    /**
     * Process the browser keypress event.
     *
     * @param {globalThis.KeyboardEvent} event - The browser keyboard event.
     * @private
     */
    _handleKeyPress(event) {
        this.fire('keypress', makeKeyboardEvent(event));

        if (this.preventDefault) {
            event.preventDefault();
        }
        if (this.stopPropagation) {
            event.stopPropagation();
        }
    }

    /**
     * Handle the browser visibilitychange event.
     *
     * @private
     */
    _handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            this._handleWindowBlur();
        }
    }

    /**
     * Handle the browser blur event.
     *
     * @private
     */
    _handleWindowBlur() {
        this._keymap = {};
        this._lastmap = {};
    }

    /**
     * Called once per frame to update internal state.
     *
     * @ignore
     */
    update() {
        // clear all keys
        for (const prop in this._lastmap) {
            delete this._lastmap[prop];
        }

        for (const prop in this._keymap) {
            if (this._keymap.hasOwnProperty(prop)) {
                this._lastmap[prop] = this._keymap[prop];
            }
        }
    }

    /**
     * Return true if the key is currently down.
     *
     * @param {number} key - The keyCode of the key to test. See the KEY_* constants.
     * @returns {boolean} True if the key was pressed, false if not.
     */
    isPressed(key) {
        const keyCode = toKeyCode(key);
        const id = this.toKeyIdentifier(keyCode);

        return !!(this._keymap[id]);
    }

    /**
     * Returns true if the key was pressed since the last update.
     *
     * @param {number} key - The keyCode of the key to test. See the KEY_* constants.
     * @returns {boolean} True if the key was pressed.
     */
    wasPressed(key) {
        const keyCode = toKeyCode(key);
        const id = this.toKeyIdentifier(keyCode);

        return (!!(this._keymap[id]) && !!!(this._lastmap[id]));
    }

    /**
     * Returns true if the key was released since the last update.
     *
     * @param {number} key - The keyCode of the key to test. See the KEY_* constants.
     * @returns {boolean} True if the key was pressed.
     */
    wasReleased(key) {
        const keyCode = toKeyCode(key);
        const id = this.toKeyIdentifier(keyCode);

        return (!!!(this._keymap[id]) && !!(this._lastmap[id]));
    }
}

export { Keyboard };
