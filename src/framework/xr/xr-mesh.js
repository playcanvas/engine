import { EventHandler } from "../../core/event-handler.js";
import { Vec3 } from "../../core/math/vec3.js";
import { Quat } from "../../core/math/quat.js";

/**
 * Detected Mesh instance that provides its transform (position, rotation),
 * triangles (vertices, indices) and its semantic label. Any of its properties can
 * change during its lifetime.
 *
 * @category XR
 */
class XrMesh extends EventHandler {
    /**
     * Fired when an {@link XrMesh} is removed.
     *
     * @event
     * @example
     * mesh.once('remove', () => {
     *     // mesh is no longer available
     * });
     */
    static EVENT_REMOVE = 'remove';

    /**
     * Fired when {@link XrMesh} attributes such as vertices, indices and/or label have been
     * changed. Position and rotation can change at any time without triggering a `change` event.
     *
     * @event
     * @example
     * mesh.on('change', () => {
     *     // mesh attributes have been changed
     * });
     */
    static EVENT_CHANGE = 'change';

    /**
     * @type {import('./xr-mesh-detection.js').XrMeshDetection}
     * @private
     */
    _meshDetection;

    /**
     * @type {XRMesh}
     * @private
     */
    _xrMesh;

    /**
     * @type {number}
     * @private
     */
    _lastChanged = 0;

    /**
     * @type {Vec3}
     * @private
     */
    _position = new Vec3();

    /**
     * @type {Quat}
     * @private
     */
    _rotation = new Quat();

    /**
     * Create a new XrMesh instance.
     *
     * @param {import('./xr-mesh-detection.js').XrMeshDetection} meshDetection - Mesh Detection
     * interface.
     * @param {XRMesh} xrMesh - XRMesh that is instantiated by WebXR system.
     * @hideconstructor
     */
    constructor(meshDetection, xrMesh) {
        super();

        this._meshDetection = meshDetection;
        this._xrMesh = xrMesh;
        this._lastChanged = this._xrMesh.lastChangedTime;
    }

    /**
     * @type {XRMesh}
     * @ignore
     */
    get xrMesh() {
        return this._xrMesh;
    }

    /**
     * Semantic Label of a mesh that is provided by underlying system.
     * Current list includes (but not limited to): https://github.com/immersive-web/semantic-labels/blob/master/labels.json
     *
     * @type {string}
     */
    get label() {
        return this._xrMesh.semanticLabel || '';
    }

    /**
     * Float 32 array of mesh vertices.
     *
     * @type {Float32Array}
     */
    get vertices() {
        return this._xrMesh.vertices;
    }

    /**
     * Uint 32 array of mesh indices.
     *
     * @type {Uint32Array}
     */
    get indices() {
        return this._xrMesh.indices;
    }

    /** @ignore */
    destroy() {
        if (!this._xrMesh) return;
        this._xrMesh = null;
        this.fire('remove');
    }

    /**
     * @param {XRFrame} frame - XRFrame from requestAnimationFrame callback.
     * @ignore
     */
    update(frame) {
        const manager = this._meshDetection._manager;
        const pose = frame.getPose(this._xrMesh.meshSpace, manager._referenceSpace);
        if (pose) {
            this._position.copy(pose.transform.position);
            this._rotation.copy(pose.transform.orientation);
        }

        // attributes have been changed
        if (this._lastChanged !== this._xrMesh.lastChangedTime) {
            this._lastChanged = this._xrMesh.lastChangedTime;
            this.fire('change');
        }
    }

    /**
     * Get the world space position of a mesh.
     *
     * @returns {Vec3} The world space position of a mesh.
     */
    getPosition() {
        return this._position;
    }

    /**
     * Get the world space rotation of a mesh.
     *
     * @returns {Quat} The world space rotation of a mesh.
     */
    getRotation() {
        return this._rotation;
    }
}

export { XrMesh };
