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

        // meshes are reference counted, and this class owns the references and is responsible
        // for releasing the meshes when they are no longer referenced
        this._meshes = null;
    }

    destroy() {
        this.meshes = null;
    }

    // decrement references to meshes, destroy the ones with zero references
    decRefMeshes() {
        if (this._meshes) {
            const count = this._meshes.length;
            for (let i = 0; i < count; i++) {
                const mesh = this._meshes[i];
                if (mesh) {
                    mesh.decRefCount();
                    if (mesh.getRefCount() < 1) {
                        mesh.destroy();
                        this._meshes[i] = null;
                    }
                }
            }
        }
    }

    // increments ref count on all meshes
    incRefMeshes() {
        if (this._meshes) {
            const count = this._meshes.length;
            for (let i = 0; i < count; i++) {
                if (this._meshes[i]) {
                    this._meshes[i].incRefCount();
                }
            }
        }
    }

    get meshes() {
        return this._meshes;
    }

    set meshes(value) {

        // decrement references on the existing meshes
        this.decRefMeshes();

        // assign new meshes
        this._meshes = value;
        this.incRefMeshes();

        this.fire('set:meshes', value);
    }
}

export { Render };
