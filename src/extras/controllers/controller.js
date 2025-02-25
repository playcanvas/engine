import { Input } from './input.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 */

class Controller extends Input {
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

    collect() {
    }

    destroy() {
        this.detach();
    }
}

export { Controller };
