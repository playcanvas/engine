import { EventHandler } from '../core/event-handler.js';
import { XrPlane } from './xr-plane.js';

/**
 * @class
 * @name XrPlaneDetection
 * @classdesc Plane Detection provides the ability to detect real world surfaces based on estimations of the underlying AR system.
 * @description Plane Detection provides the ability to detect real world surfaces based on estimations of the underlying AR system.
 * @param {XrManager} manager - WebXR Manager.
 * @property {boolean} supported True if Plane Detection is supported.
 * @property {boolean} available True if Plane Detection is available. This property can be set to true only during a running session.
 * @property {XrPlane[]|null} planes Array of {@link XrPlane} instances that contain individual plane information, or null if plane detection is not available.
 * @example
 * // start session with plane detection enabled
 * app.xr.start(camera, pc.XRTYPE_VR, pc.XRSPACE_LOCALFLOOR, {
 *     planeDetection: true
 * });
 * @example
 * app.xr.planeDetection.on('add', function (plane) {
 *     // new plane been added
 * });
 */
class XrPlaneDetection extends EventHandler {
    constructor(manager) {
        super();

        this._manager = manager;
        this._supported = !! window.XRPlane;
        this._available = false;

        // key - XRPlane (native plane does not have ID's)
        // value - XrPlane
        this._planesIndex = new Map();

        this._planes = null;

        if (this._supported) {
            this._manager.on('end', this._onSessionEnd, this);
        }
    }

    /**
     * @event
     * @name XrPlaneDetection#available
     * @description Fired when plane detection becomes available.
     */

    /**
     * @event
     * @name XrPlaneDetection#unavailable
     * @description Fired when plane detection becomes unavailable.
     */

    /**
     * @event
     * @name XrPlaneDetection#add
     * @description Fired when new {@link XrPlane} is added to the list.
     * @param {XrPlane} plane - Plane that has been added.
     * @example
     * app.xr.planeDetection.on('add', function (plane) {
     *     // new plane is added
     * });
     */

    /**
     * @event
     * @name XrPlaneDetection#remove
     * @description Fired when a {@link XrPlane} is removed from the list.
     * @param {XrPlane} plane - Plane that has been removed.
     * @example
     * app.xr.planeDetection.on('remove', function (plane) {
     *     // new plane is removed
     * });
     */

    _onSessionEnd() {
        if (this._planes) {
            for (let i = 0; i < this._planes.length; i++) {
                this._planes[i].destroy();
            }
        }

        this._planesIndex.clear();
        this._planes = null;

        if (this._available) {
            this._available = false;
            this.fire('unavailable');
        }
    }

    update(frame) {
        let detectedPlanes;

        if (! this._available) {
            try {
                detectedPlanes = frame.detectedPlanes;
                this._planes = [];
                this._available = true;
                this.fire('available');
            } catch (ex) {
                return;
            }
        } else {
            detectedPlanes = frame.detectedPlanes;
        }

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

            if (! plane) {
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

    get supported() {
        return this._supported;
    }

    get available() {
        return this._available;
    }

    get planes() {
        return this._planes;
    }
}

export { XrPlaneDetection };
