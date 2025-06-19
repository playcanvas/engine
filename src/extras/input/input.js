import { EventHandler } from '../../core/event-handler.js';
import { Pose } from './pose.js';

/** @import { HandleEventCallback } from '../../core/event-handler.js' */

/**
 * Represents an input delta.
 *
 * @category Input Source
 * @alpha
 */
class InputDelta {
    /**
     * @type {number[]}
     * @private
     */
    _value;

    /**
     * @param {number | number[]} arg - The size of the delta or an array of initial values.
     */
    constructor(arg) {
        if (Array.isArray(arg)) {
            this._value = arg.slice();
        } else {
            this._value = new Array(+arg).fill(0);
        }
    }

    /**
     * Adds another InputDelta instance to this one.
     *
     * @param {InputDelta} other - The other InputDelta instance to add.
     * @returns {InputDelta} Self for chaining.
     */
    add(other) {
        for (let i = 0; i < this._value.length; i++) {
            this._value[i] += other._value[i] || 0;
        }
        return this;
    }

    /**
     * Appends offsets to the current delta values.
     *
     * @param {number[]} offsets - The offsets.
     * @returns {InputDelta} Self for chaining.
     */
    append(offsets) {
        for (let i = 0; i < this._value.length; i++) {
            this._value[i] += offsets[i] || 0;
        }
        return this;
    }

    /**
     * Copies the values from another InputDelta instance to this one.
     *
     * @param {InputDelta} other - The other InputDelta instance to copy from.
     * @returns {InputDelta} Self for chaining.
     */
    copy(other) {
        for (let i = 0; i < this._value.length; i++) {
            this._value[i] = other._value[i] || 0;
        }
        return this;
    }

    /**
     * The magnitude of the delta, calculated as the square root of the sum of squares
     * of the values.
     *
     * @returns {number} - The magnitude of the delta.
     */
    length() {
        let sum = 0;
        for (const value of this._value) {
            sum += value * value;
        }
        return Math.sqrt(sum);
    }

    /**
     * Returns the current value of the delta and resets it to zero.
     *
     * @returns {number[]} - The current value of the delta.
     */
    read() {
        const value = this._value.slice();
        this._value.fill(0);
        return value;
    }
}

/**
 * Represents an input frame, which contains a map of input deltas.
 *
 * @category Input Source
 * @alpha
 *
 * @template {Record<string, number[]>} T - The shape of the input frame.
 */
class InputFrame {
    /**
     * @type {{ [K in keyof T]: InputDelta }}
     */
    deltas = /** @type {{ [K in keyof T]: InputDelta }} */ ({});

    /**
     * @param {T} data - The input frame data, where each key corresponds to an input delta.
     */
    constructor(data) {
        for (const name in data) {
            this.deltas[name] = new InputDelta(data[name]);
        }
    }

    /**
     * Returns the current frame state and resets the deltas to zero.
     *
     * @returns {{ [K in keyof T]: number[] }} - The flushed input frame with current deltas.
     */
    read() {
        const frame = /** @type {{ [K in keyof T]: number[] }} */ ({});
        for (const name in this.deltas) {
            frame[name] = this.deltas[name].read();
        }
        return frame;
    }
}

/**
 * The base class for all input devices.
 *
 * @category Input Source
 * @alpha
 *
 * @template {Record<string, number[]>} T - The shape of the input source.
 * @augments {InputFrame<T>}
 */
class InputSource extends InputFrame {
    /**
     * @type {HTMLElement | null}
     * @protected
     */
    _element = null;

    /**
     * @type {EventHandler}
     * @private
     */
    _events = new EventHandler();

    /**
     * Adds an event listener for the specified event.
     *
     * @param {string} event - The event name to listen for.
     * @param {HandleEventCallback} callback - The callback function to execute when the event is
     * triggered.
     */
    on(event, callback) {
        this._events.on(event, callback);
    }

    /**
     * Removes an event listener for the specified event.
     *
     * @param {string} event - The event name to stop listening for.
     * @param {HandleEventCallback} callback - The callback function to remove.
     */
    off(event, callback) {
        this._events.off(event, callback);
    }

    /**
     * Fires an event with the given name and arguments.
     *
     * @param {string} event - The event name to fire.
     * @param {...any} args - The arguments to pass to the event listeners.
     */
    fire(event, ...args) {
        this._events.fire(event, ...args);
    }

    /**
     * @param {HTMLElement} element - The element.
     */
    attach(element) {
        if (this._element) {
            this.detach();
        }
        this._element = element;
    }

    detach() {
        if (!this._element) {
            return;
        }
        this._element = null;
        this.read();
    }

    destroy() {
        this.detach();
        this._events.off();
    }
}

/**
 * The base class for all input consumers, which are used to process input frames.
 *
 * @category Input Consumer
 * @alpha
 */
class InputConsumer {
    /**
     * @param {InputFrame} frame - The input frame.
     * @param {number} dt - The delta time.
     * @returns {any} - The controller pose.
     */
    update(frame, dt) {
        // discard frame by default
        frame.read();
    }
}

/**
 * The base class for all input controllers.
 *
 * @category Input Consumer
 * @alpha
 */
class InputController extends InputConsumer {
    /**
     * @type {Pose}
     * @protected
     */
    _pose = new Pose();

    /**
     * @param {Pose} pose - The initial pose of the controller.
     * @param {boolean} [smooth] - Whether to smooth the transition.
     */
    attach(pose, smooth = true) {
    }

    detach() {
    }

    /**
     * @param {InputFrame} frame - The input frame.
     * @param {number} dt - The delta time.
     * @returns {Pose} - The controller pose.
     * @override
     */
    update(frame, dt) {
        super.update(frame, dt);

        return this._pose;
    }

    destroy() {
        this.detach();
    }
}

export {
    InputDelta,
    InputFrame,
    InputSource,
    InputConsumer,
    InputController
};
