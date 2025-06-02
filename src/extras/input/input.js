import { Mat4 } from '../../core/math/mat4.js';

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
     * @type {Mat4}
     * @protected
     */
    _transform = new Mat4();

    /**
     * @param {Mat4} transform - The transform.
     */
    attach(transform) {
    }

    detach() {
    }

    /**
     * @param {Record<string, InputDelta>} frame - The input frame.
     * @param {number} dt - The delta time.
     * @returns {Mat4} - The camera transform.
     */
    update(frame, dt) {
        return this._transform;
    }

    destroy() {
    }
}

export { InputDelta, InputSource, InputController };
