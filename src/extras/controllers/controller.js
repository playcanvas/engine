/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 */

class Input {
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

    add() {
        for (let i = 0; i < this._instance.length; i++) {
            this._instance[i] += arguments[i] || 0;
        }
    }

    flush() {
        this._instance.fill(0);
    }
}

class Controller {
    /**
     * @type {HTMLElement | null}
     * @protected
     */
    _element = null;

    /**
     * @type {CameraComponent | null}
     * @protected
     */
    _camera = null;

    /**
     * @type {Input}
     */
    translate = new Input(3);

    /**
     * @type {Input}
     */
    rotate = new Input(2);

    /**
     * @type {Input}
     */
    pointer = new Input(2);

    /**
     * @type {Input}
     */
    pan = new Input(2);

    /**
     * @type {Input}
     */
    zoom = new Input();

    /**
     * @returns {CameraComponent | null} - The camera.
     */
    get camera() {
        return this._camera;
    }

    /**
     * @param {HTMLElement} element - The element.
     * @param {CameraComponent} camera - The camera.
     */
    attach(element, camera) {
        if (this._element) {
            this.detach();
        }
        this._element = element;
        this._camera = camera;
    }

    detach() {
        if (!this._element) {
            return;
        }

        this._element = null;
        this._camera = null;
    }

    frame() {
        const frame = [
            this.translate.value[0],
            this.translate.value[1],
            this.translate.value[2],
            this.rotate.value[0],
            this.rotate.value[1],
            this.pointer.value[0],
            this.pointer.value[1],
            this.pan.value[0],
            this.pan.value[1],
            this.zoom.value[0]
        ];
        this.translate.flush();
        this.pointer.flush();
        this.rotate.flush();
        this.pan.flush();
        this.zoom.flush();
        return frame;
    }

    destroy() {
        this.detach();
    }
}

export { Controller };
