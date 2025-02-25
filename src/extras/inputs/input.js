import { EventHandler } from '../../core/event-handler.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 */

class Input extends EventHandler {
    static EVENT_ROTATESTART = 'rotate:start';

    static EVENT_ROTATEEND = 'rotate:end';

    /**
     * @type {Map<string, number>}
     * @private
     */
    _deltas = new Map();

    /**
     * @type {CameraComponent | null}
     * @protected
     */
    _camera = null;

    get camera() {
        return this._camera;
    }

    /**
     * @param {string} name - The name of the state.
     * @param {number} val - The delta to add.
     */
    add(name, val) {
        if (this._deltas.has(name)) {
            this._deltas.set(name, (this._deltas.get(name) ?? 0) + val);
        } else {
            this._deltas.set(name, val);
        }
    }

    /**
     * @param {string} name - The name of the state.
     * @returns {number} - The state value.
     */
    get(name) {
        return this._deltas.get(name) || 0;
    }

    collect() {
    }

    flush() {
        this._deltas.clear();
    }
}

export { Input };
