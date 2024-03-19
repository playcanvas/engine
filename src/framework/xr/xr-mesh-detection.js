import { platform } from "../../core/platform.js";
import { EventHandler } from "../../core/event-handler.js";
import { XrMesh } from "./xr-mesh.js";

/**
 * Mesh Detection provides the ability to detect real world meshes based on the
 * scanning and reconstruction by the underlying AR system.
 *
 * ```javascript
 * // start session with plane detection enabled
 * app.xr.start(camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
 *     meshDetection: true
 * });
 * ```
 *
 * ```javascript
 * app.xr.meshDetection.on('add', function (mesh) {
 *     // new mesh been added
 * });
 * ```
 *
 * @category XR
 */
class XrMeshDetection extends EventHandler {
    /**
     * Fired when mesh detection becomes available.
     *
     * @event
     * @example
     * app.xr.meshDetection.on('available', () => {
     *     console.log('Mesh detection is available');
     * });
     */
    static EVENT_AVAILABLE = 'available';

    /**
     * Fired when mesh detection becomes unavailable.
     *
     * @event
     * @example
     * app.xr.meshDetection.on('unavailable', () => {
     *     console.log('Mesh detection is unavailable');
     * });
     */
    static EVENT_UNAVAILABLE = 'unavailable';

    /**
     * Fired when new {@link XrMesh} is added to the list. The handler is passed the {@link XrMesh}
     * instance that has been added.
     *
     * @event
     * @example
     * app.xr.meshDetection.on('add', (mesh) => {
     *     // a new XrMesh has been added
     * });
     */
    static EVENT_ADD = 'add';

    /**
     * Fired when a {@link XrMesh} is removed from the list. The handler is passed the
     * {@link XrMesh} instance that has been removed.
     *
     * @event
     * @example
     * app.xr.meshDetection.on('remove', (mesh) => {
     *     // XrMesh has been removed
     * });
     */
    static EVENT_REMOVE = 'remove';

    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    _manager;

    /**
     * @type {boolean}
     * @private
     */
    _supported = platform.browser && !!window.XRMesh;

    /**
     * @type {boolean}
     * @private
     */
    _available = false;

    /**
     * @type {Map<XRMesh, XrMesh>}
     * @private
     */
    _index = new Map();

    /**
     * @type {XrMesh[]}
     * @private
     */
    _list = [];

    /**
     * Create a new XrMeshDetection instance.
     *
     * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
     * @ignore
     */
    constructor(manager) {
        super();

        this._manager = manager;

        if (this._supported) {
            this._manager.on('start', this._onSessionStart, this);
            this._manager.on('end', this._onSessionEnd, this);
        }
    }

    /**
     * @param {XRFrame} frame - XRFrame from requestAnimationFrame callback.
     * @ignore
     */
    update(frame) {
        if (!this._available) {
            if (!this._manager.session.enabledFeatures && frame.detectedMeshes.size) {
                this._available = true;
                this.fire('available');
            } else {
                return;
            }
        }

        // add meshes
        for (const xrMesh of frame.detectedMeshes) {
            let mesh = this._index.get(xrMesh);
            if (!mesh) {
                mesh = new XrMesh(this, xrMesh);
                this._index.set(xrMesh, mesh);
                this._list.push(mesh);
                mesh.update(frame);
                this.fire('add', mesh);
            } else {
                mesh.update(frame);
            }
        }

        // remove meshes
        for (const mesh of this._index.values()) {
            if (frame.detectedMeshes.has(mesh.xrMesh))
                continue;

            this._removeMesh(mesh);
        }
    }

    /**
     * @param {XrMesh} mesh - XrMesh to remove.
     * @private
     */
    _removeMesh(mesh) {
        this._index.delete(mesh.xrMesh);
        this._list.splice(this._list.indexOf(mesh), 1);
        mesh.destroy();
        this.fire('remove', mesh);
    }

    /** @private */
    _onSessionStart() {
        if (this._manager.session.enabledFeatures) {
            const available = this._manager.session.enabledFeatures.indexOf('mesh-detection') !== -1;
            if (!available) return;
            this._available = available;
            this.fire('available');
        }
    }

    /** @private */
    _onSessionEnd() {
        if (!this._available) return;
        this._available = false;

        for (const mesh of this._index.values())
            this._removeMesh(mesh);

        this.fire('unavailable');
    }

    /**
     * True if Mesh Detection is supported.
     *
     * @type {boolean}
     */
    get supported() {
        return this._supported;
    }

    /**
     * True if Mesh Detection is available. This information is available only when session has started.
     *
     * @type {boolean}
     */
    get available() {
        return this._available;
    }

    /**
     * Array of {@link XrMesh} instances that contain transform, vertices and label information.
     *
     * @type {XrMesh[]}
     */
    get meshes() {
        return this._list;
    }
}

export { XrMeshDetection };
