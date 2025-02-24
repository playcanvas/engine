import { EventHandler } from '../../core/event-handler.js';
import { Vec3 } from '../../core/math/vec3.js';

class Input extends EventHandler {
    static EVENT_ROTATESTART = 'rotate:start';

    static EVENT_ROTATEMOVE = 'rotate:move';

    static EVENT_ROTATEEND = 'rotate:end';

    translation = new Vec3();

    _state = new Map();

    /**
     * @param {string} name - The name of the state.
     * @param {number} delta - The delta to add.
     */
    add(name, delta) {
        if (this._state.has(name)) {
            this._state.set(name, this._state.get(name) + delta);
        } else {
            this._state.set(name, delta);
        }
    }

    /**
     * @param {string} name - The name of the state.
     * @returns {number} - The state value.
     */
    get(name) {
        return this._state.get(name) || 0;
    }

    clear() {
        this._state.clear();
    }
}

export { Input };
