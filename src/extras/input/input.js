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
     * Allocates a new InputDelta instance with the specified dimension.
     *
     * @param {number} dim - The dimension of the delta.
     * @returns {InputDelta} - A new InputDelta instance initialized with zeros.
     */
    static alloc(dim = 1) {
        return new this(Array(dim).fill(0));
    }

    /**
     * @param {number[]} array - the array to use for the delta.
     */
    constructor(array) {
        this._instance = array;
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
     * @returns {InputDelta} - This InputDelta instance after addition.
     */
    add(other) {
        for (let i = 0; i < this._instance.length; i++) {
            this._instance[i] += other._instance[i] || 0;
        }
        return this;
    }

    /**
     * Copies the values from another InputDelta instance to this one.
     *
     * @param {InputDelta} other - The other InputDelta instance to copy from.
     * @returns {InputDelta} - This InputDelta instance after copying.
     */
    copy(other) {
        for (let i = 0; i < this._instance.length; i++) {
            this._instance[i] = other._instance[i] || 0;
        }
        return this;
    }

    /**
     * Subtracts another InputDelta instance from this one.
     *
     * @param {InputDelta} other - The other InputDelta instance to subtract.
     * @returns {InputDelta} - This InputDelta instance after subtraction.
     */
    sub(other) {
        for (let i = 0; i < this._instance.length; i++) {
            this._instance[i] -= other._instance[i] || 0;
        }
        return this;
    }

    /**
     * @param {number[]} offsets - The offsets.
     */
    append(offsets) {
        for (let i = 0; i < this._instance.length; i++) {
            this._instance[i] += offsets[i] || 0;
        }
    }

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
