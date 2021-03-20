import { EventHandler } from '../core/event-handler.js';

class Render extends EventHandler {
    constructor() {
        super();
        this._meshes = null;
    }

    get meshes() {
        return this._meshes;
    }

    set meshes(value) {
        this._meshes = value;
        this.fire('set:meshes', value);
    }
}

export { Render };
