import { EventHandler } from '../core/event-handler.js';

/**
 * A `Render` contains an array of meshes that are referenced by a single hierarchy node in a GLB
 * scene, and are accessible using the {@link ContainerResource#renders} property. A `Render` is
 * the resource of a Render Asset. They are usually created by the GLB loader and not created by
 * hand.
 *
 * @ignore
 */
class Render extends EventHandler {
    /**
     * Fired when the meshes are set on the render. The handler is passed the an array of
     * {@link Mesh} objects.
     *
     * @event
     * @example
     * render.on('set:meshes', (meshes) => {
     *     console.log(`Render has ${meshes.length} meshes`);
     * });
     */
    static EVENT_SETMESHES = 'set:meshes';

    /**
     * Meshes are reference counted, and this class owns the references and is responsible for
     * releasing the meshes when they are no longer referenced.
     *
     * @type {Array<import('./mesh.js').Mesh|null>|null}
     * @private
     */
    _meshes = null;

    /**
     * Sets the meshes that the render contains.
     *
     * @type {Array<import('./mesh.js').Mesh|null>|null}
     */
    set meshes(value) {
        // decrement references on the existing meshes
        this.decRefMeshes();

        // assign new meshes
        this._meshes = value;
        this.incRefMeshes();

        this.fire('set:meshes', value);
    }

    /**
     * Gets the meshes that the render contains.
     *
     * @type {Array<import('./mesh.js').Mesh|null>|null}
     */
    get meshes() {
        return this._meshes;
    }

    destroy() {
        this.meshes = null;
    }

    /**
     * Decrement references to meshes. Destroy the ones with zero references.
     */
    decRefMeshes() {
        this._meshes?.forEach((mesh, index) => {
            if (mesh) {
                mesh.decRefCount();
                if (mesh.refCount < 1) {
                    mesh.destroy();
                    this._meshes[index] = null;
                }
            }
        });
    }

    /**
     * Increments ref count on all meshes.
     */
    incRefMeshes() {
        this._meshes?.forEach((mesh) => {
            mesh?.incRefCount();
        });
    }
}

export { Render };
