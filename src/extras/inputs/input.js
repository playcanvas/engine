import { EventHandler } from '../../core/event-handler.js';

class Input extends EventHandler {
    static EVENT_ROTATESTART = 'rotate:start';

    static EVENT_ROTATEMOVE = 'rotate:move';

    static EVENT_ROTATEEND = 'rotate:end';

    _deltas = new Map();

    /**
     * @param {string} name - The name of the state.
     * @param {number} val - The delta to add.
     */
    add(name, val) {
        if (this._deltas.has(name)) {
            this._deltas.set(name, this._deltas.get(name) + val);
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
