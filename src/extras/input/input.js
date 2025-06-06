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
     * Resets the delta values to zero.
     */
    flush() {
        this._instance.fill(0);
    }
}

/**
 * The base class for all input devices.
 *
 * @category Input Source
 * @alpha
 */
class InputSource {
    /**
     * @type {HTMLElement | null}
     * @protected
     */
    _element = null;

    /**
     * @type {object}
     * @protected
     */
    deltas = {};

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

        for (const name in this.deltas) {
            this.deltas[name].flush();
        }
    }

    /**
     * @returns {object} - The deltas.
     */
    frame() {
        const frame = {};
        for (const name in this.deltas) {
            const delta = this.deltas[name];
            frame[name] = delta.value.slice();
            delta.flush();
        }
        return frame;
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
class InputController {
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
     * @param {Record<string, InputDelta>} frame - The input frame.
     * @param {number} dt - The delta time.
     * @returns {Pose} - The controller pose.
     */
    update(frame, dt) {
        return this._pose;
    }

    destroy() {
        this.detach();
    }
}

export { InputDelta, InputSource, InputController };
