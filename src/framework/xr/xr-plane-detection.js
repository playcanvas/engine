import { platform } from '../../core/platform.js';
import { EventHandler } from '../../core/event-handler.js';
import { XrPlane } from './xr-plane.js';

/**
 * Plane Detection provides the ability to detect real world surfaces based on estimations of the
 * underlying AR system.
 *
 * ```javascript
 * // start session with plane detection enabled
 * app.xr.start(camera, pc.XRTYPE_VR, pc.XRSPACE_LOCALFLOOR, {
 *     planeDetection: true
 * });
 * ```
 *
 * ```javascript
 * app.xr.planeDetection.on('add', (plane) => {
 *     // new plane been added
 * });
 * ```
 *
 * @category XR
 */
class XrPlaneDetection extends EventHandler {
    /**
     * Fired when plane detection becomes available.
     *
     * @event
     * @example
     * app.xr.planeDetection.on('available', () => {
     *     console.log('Plane detection is available');
     * });
     */
    static EVENT_AVAILABLE = 'available';

    /**
     * Fired when plane detection becomes unavailable.
     *
     * @event
     * @example
     * app.xr.planeDetection.on('unavailable', () => {
     *     console.log('Plane detection is unavailable');
     * });
     */
    static EVENT_UNAVAILABLE = 'unavailable';

    /**
     * Fired when new {@link XrPlane} is added to the list. The handler is passed the
     * {@link XrPlane} instance that has been added.
     *
     * @event
     * @example
     * app.xr.planeDetection.on('add', (plane) => {
     *     // new plane is added
     * });
     */
    static EVENT_ADD = 'add';

    /**
     * Fired when a {@link XrPlane} is removed from the list. The handler is passed the
     * {@link XrPlane} instance that has been removed.
     *
     * @event
     * @example
     * app.xr.planeDetection.on('remove', (plane) => {
     *     // new plane is removed
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
    _supported = platform.browser && !!window.XRPlane;

    /**
     * @type {boolean}
     * @private
     */
    _available = false;

    /**
     * @type {Map<XRPlane, XrPlane>}
     * @private
     */
    _planesIndex = new Map();

    /**
     * @type {XrPlane[]}
     * @private
     */
    _planes = [];

    /**
     * Create a new XrPlaneDetection instance.
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

    /** @private */
    _onSessionStart() {
        if (this._manager.session.enabledFeatures) {
            const available = this._manager.session.enabledFeatures.indexOf('plane-detection') !== -1;
            if (available) {
                this._available = true;
                this.fire('available');
            }
        }
    }

    /** @private */
    _onSessionEnd() {
        for (let i = 0; i < this._planes.length; i++) {
            this._planes[i].destroy();
            this.fire('remove', this._planes[i]);
        }

        this._planesIndex.clear();
        this._planes.length = 0;

        if (this._available) {
            this._available = false;
            this.fire('unavailable');
        }
    }

    /**
     * @param {XRFrame} frame - XRFrame from requestAnimationFrame callback.
     * @ignore
     */
    update(frame) {
        if (!this._available) {
            if (!this._manager.session.enabledFeatures && frame.detectedPlanes.size) {
                this._available = true;
                this.fire('available');
            } else {
                return;
            }
        }

        const detectedPlanes = frame.detectedPlanes;

        // iterate through indexed planes
        for (const [xrPlane, plane] of this._planesIndex) {
            if (detectedPlanes.has(xrPlane))
                continue;

            // if indexed plane is not listed in detectedPlanes anymore
            // then remove it
            this._planesIndex.delete(xrPlane);
            this._planes.splice(this._planes.indexOf(plane), 1);
            plane.destroy();
            this.fire('remove', plane);
        }

        // iterate through detected planes
        for (const xrPlane of detectedPlanes) {
            let plane = this._planesIndex.get(xrPlane);

            if (!plane) {
                // detected plane is not indexed
                // then create new XrPlane
                plane = new XrPlane(this, xrPlane);
                this._planesIndex.set(xrPlane, plane);
                this._planes.push(plane);
                plane.update(frame);
                this.fire('add', plane);
            } else {
                // if already indexed, just update
                plane.update(frame);
            }
        }
    }

    /**
     * True if Plane Detection is supported.
     *
     * @type {boolean}
     */
    get supported() {
        return this._supported;
    }

    /**
     * True if Plane Detection is available. This information is available only when the session has started.
     *
     * @type {boolean}
     */
    get available() {
        return this._available;
    }

    /**
     * Array of {@link XrPlane} instances that contain individual plane information.
     *
     * @type {XrPlane[]}
     */
    get planes() {
        return this._planes;
    }
}

export { XrPlaneDetection };
