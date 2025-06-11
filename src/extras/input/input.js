import { Pose } from './pose.js';

/** @import { Vec3 } from '../../core/math/vec3.js'; */

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
     * @param {Vec3} position - The controller position.
     * @param {Vec3} focus - The focus point
     * @param {boolean} [smooth] - Whether to smooth the transition.
     */
    attach(position, focus, smooth = true) {
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
