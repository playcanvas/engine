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
     */
    _instance;

    /**
     * @param {number} dim - The dimension.
     */
    constructor(dim = 1) {
        this._instance = new Array(dim).fill(0);
    }

    get value() {
        return this._instance;
    }

    /**
     * @param {number[]} offsets - The offsets.
     */
    add(offsets) {
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
     * @param {Vec3} position - The position of the controller.
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
