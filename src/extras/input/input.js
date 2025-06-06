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
    _instance;

    /**
     * @param {number} dim - The dimension of the delta. Defaults to 1.
     */
    constructor(dim = 1) {
        this._instance = Array(dim).fill(0);
    }

    /**
     * Gets the current value of the delta.
     *
     * @returns {number[]} - The current value of the delta.
     */
    get value() {
        return this._instance;
    }

    /**
     * Adds another InputDelta instance to this one.
     *
     * @param {InputDelta} other - The other InputDelta instance to add.
     * @returns {InputDelta} Self for chaining.
     */
    add(other) {
        for (let i = 0; i < this._instance.length; i++) {
            this._instance[i] += other._instance[i] || 0;
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
        for (let i = 0; i < this._instance.length; i++) {
            this._instance[i] += offsets[i] || 0;
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
        for (let i = 0; i < this._instance.length; i++) {
            this._instance[i] = other._instance[i] || 0;
        }
        return this;
    }

    /**
     * Returns the current value of the delta and resets it to zero.
     *
     * @returns {number[]} - The current value of the delta.
     */
    flush() {
        const value = this._instance.slice();
        this._instance.fill(0);
        return value;
    }
}

/**
 * Represents an input frame, which contains a map of input deltas.
 *
 * @template {Record<string, number>} T - The shape of the input frame.
 */
class InputFrame {
    /**
     * @type {{ [K in keyof T]: InputDelta }}
     */
    deltas = /** @type {{ [K in keyof T]: InputDelta }} */ ({});

    /**
     * @param {T} shape - The shape of the input frame.
     */
    constructor(shape) {
        for (const name in shape) {
            this.deltas[name] = new InputDelta(shape[name]);
        }
    }

    /**
     * Flushes the current input frame, returning a new frame with the current deltas.
     *
     * @returns {{ [K in keyof T]: number[] }} - The flushed input frame with current deltas.
     */
    flush() {
        const frame = /** @type {{ [K in keyof T]: number[] }} */ ({});
        for (const name in this.deltas) {
            frame[name] = this.deltas[name].flush();
        }
        return frame;
    }
}

/**
 * The base class for all input consumers, which are used to process input frames.
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
 * The base class for all input devices.
 *
 * @category Input Source
 * @alpha
 *
 * @template {Record<string, number>} T - The shape of the input source.
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
        this.flush();
    }

    destroy() {
        this.detach();
    }
}

/**
 * The base class for all input controllers.
 *
 * @category Input Controller
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
     */
    attach(position, focus) {
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
    InputConsumer,
    InputSource,
    InputController
};
