import { EventHandler } from '../../core/event-handler.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

let ids = 0;

/**
 * Detected Plane instance that provides position, rotation, polygon points and its semantic label.
 * Plane data is subject to change during its lifetime.
 *
 * @category XR
 */
class XrPlane extends EventHandler {
    /**
     * Fired when an {@link XrPlane} is removed.
     *
     * @event
     * @example
     * plane.once('remove', () => {
     *     // plane is not available anymore
     * });
     */
    static EVENT_REMOVE = 'remove';

    /**
     * Fired when {@link XrPlane} attributes such as: orientation and/or points have been changed.
     * Position and rotation can change at any time without triggering a `change` event.
     *
     * @event
     * @example
     * plane.on('change', () -> {
     *     // plane has been changed
     * });
     */
    static EVENT_CHANGE = 'change';

    /**
     * @type {number}
     * @private
     */
    _id;

    /**
     * @type {import('./xr-plane-detection.js').XrPlaneDetection}
     * @private
     */
    _planeDetection;

    /**
     * @type {XRPlane}
     * @private
     */
    _xrPlane;

    /**
     * @type {number}
     * @private
     */
    _lastChangedTime;

    /**
     * @type {string}
     * @private
     */
    _orientation;

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
     * Create a new XrPlane instance.
     *
     * @param {import('./xr-plane-detection.js').XrPlaneDetection} planeDetection - Plane detection
     * system.
     * @param {*} xrPlane - XRPlane that is instantiated by WebXR system.
     * @ignore
     */
    constructor(planeDetection, xrPlane) {
        super();

        this._id = ++ids;
        this._planeDetection = planeDetection;
        this._xrPlane = xrPlane;
        this._lastChangedTime = xrPlane.lastChangedTime;
        this._orientation = xrPlane.orientation;
    }

    /** @ignore */
    destroy() {
        if (!this._xrPlane) return;
        this._xrPlane = null;
        this.fire('remove');
    }

    /**
     * @param {*} frame - XRFrame from requestAnimationFrame callback.
     * @ignore
     */
    update(frame) {
        const manager = this._planeDetection._manager;
        const pose = frame.getPose(this._xrPlane.planeSpace, manager._referenceSpace);
        if (pose) {
            this._position.copy(pose.transform.position);
            this._rotation.copy(pose.transform.orientation);
        }

        // has not changed
        if (this._lastChangedTime !== this._xrPlane.lastChangedTime) {
            this._lastChangedTime = this._xrPlane.lastChangedTime;

            // attributes have been changed
            this.fire('change');
        }
    }

    /**
     * Get the world space position of a plane.
     *
     * @returns {Vec3} The world space position of a plane.
     */
    getPosition() {
        return this._position;
    }

    /**
     * Get the world space rotation of a plane.
     *
     * @returns {Quat} The world space rotation of a plane.
     */
    getRotation() {
        return this._rotation;
    }

    /**
     * Unique identifier of a plane.
     *
     * @type {number}
     */
    get id() {
        return this._id;
    }

    /**
     * Plane's specific orientation (horizontal or vertical) or null if orientation is anything else.
     *
     * @type {string|null}
     */
    get orientation() {
        return this._orientation;
    }

    /**
     * Array of DOMPointReadOnly objects. DOMPointReadOnly is an object with `x y z` properties
     * that defines a local point of a plane's polygon.
     *
     * @type {object[]}
     * @example
     * // prepare reusable objects
     * const vecA = new pc.Vec3();
     * const vecB = new pc.Vec3();
     * const color = new pc.Color(1, 1, 1);
     *
     * // update Mat4 to plane position and rotation
     * transform.setTRS(plane.getPosition(), plane.getRotation(), pc.Vec3.ONE);
     *
     * // draw lines between points
     * for (let i = 0; i < plane.points.length; i++) {
     *     vecA.copy(plane.points[i]);
     *     vecB.copy(plane.points[(i + 1) % plane.points.length]);
     *
     *     // transform from planes local to world coords
     *     transform.transformPoint(vecA, vecA);
     *     transform.transformPoint(vecB, vecB);
     *
     *     // render line
     *     app.drawLine(vecA, vecB, color);
     * }
     */
    get points() {
        return this._xrPlane.polygon;
    }

    /**
     * Semantic Label of a plane that is provided by underlying system.
     * Current list includes (but not limited to): https://github.com/immersive-web/semantic-labels/blob/master/labels.json
     *
     * @type {string}
     */
    get label() {
        return this._xrPlane.semanticLabel || '';
    }
}

export { XrPlane };
