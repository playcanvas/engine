import { EventHandler } from '../core/event-handler.js';

/**
 * @event
 * @private
 * @name Render#set:meshes
 * @description Fired when the meshes are set
 * @param {Mesh[]} meshes - The meshes
 */

/**
 * @class
 * @private
 * @name Render
 * @augments EventHandler
 * @classdesc A render contains an array of meshes that are referenced by a single hierarchy node in a GLB model, and are accessible using {@link ContainerResource#renders} property. The render is the resource of a Render Asset.
 * @description Create a new Render. These are usually created by the GLB loader and not created by hand.
 * @property {Mesh[]} meshes The meshes that the render contains
 */
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
