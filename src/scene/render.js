import { EventHandler } from '../core/event-handler.js';

function Render() {
    EventHandler.call(this);
    this._meshes = null;
}

Render.prototype = Object.create(EventHandler.prototype);
Render.prototype.constructor = Render;

Object.defineProperty(Render.prototype, 'meshes', {
    get: function () {
        return this._meshes;
    },
    set: function (value) {
        this._meshes = value;
        this.fire('set:meshes', value);
    }
});


export { Render };
