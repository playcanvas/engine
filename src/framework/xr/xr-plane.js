import { EventHandler } from '../../core/event-handler.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

let ids = 0;

/**
 * Represents a detected plane in the real world, providing its position, rotation, polygon points,
 * and semantic label. The plane data may change over time as the system updates its understanding
 * of the environment. Instances of this class are created and managed by the
 * {@link XrPlaneDetection} system.
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
     * @type {"horizontal"|"vertical"|null}
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
     * @param {XRFrame} frame - XRFrame from requestAnimationFrame callback.
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
     * Gets the plane's specific orientation. This can be "horizontal" for planes that are parallel
     * to the ground, "vertical" for planes that are perpendicular to the ground, or `null` if the
     * orientation is different or unknown.
     *
     * @type {"horizontal"|"vertical"|null}
     * @example
     * if (plane.orientation === 'horizontal') {
     *     console.log('This plane is horizontal.');
     * } else if (plane.orientation === 'vertical') {
     *     console.log('This plane is vertical.');
     * } else {
     *     console.log('Orientation of this plane is unknown or different.');
     * }
     */
    get orientation() {
        return this._orientation;
    }

    /**
     * Gets the array of points that define the polygon of the plane in its local coordinate space.
     * Each point is represented as a `DOMPointReadOnly` object with `x`, `y`, and `z` properties.
     * These points can be transformed to world coordinates using the plane's position and
     * rotation.
     *
     * @type {DOMPointReadOnly[]}
     * @example
     * // prepare reusable objects
     * const transform = new pc.Mat4();
     * const vecA = new pc.Vec3();
     * const vecB = new pc.Vec3();
     *
     * // update Mat4 to plane position and rotation
     * transform.setTRS(plane.getPosition(), plane.getRotation(), pc.Vec3.ONE);
     *
     * // draw lines between points
     * for (let i = 0; i < plane.points.length; i++) {
     *     vecA.copy(plane.points[i]);
     *     vecB.copy(plane.points[(i + 1) % plane.points.length]);
     *
     *     // transform points to world space
     *     transform.transformPoint(vecA, vecA);
     *     transform.transformPoint(vecB, vecB);
     *
     *     // render line
     *     app.drawLine(vecA, vecB, pc.Color.WHITE);
     * }
     */
    get points() {
        return this._xrPlane.polygon;
    }

    /**
     * Gets the semantic label of the plane provided by the underlying system. The label describes
     * the type of surface the plane represents, such as "floor", "wall", "ceiling", etc. The list
     * of possible labels can be found in the [semantic labels repository](https://github.com/immersive-web/semantic-labels).
     *
     * @type {string}
     * @example
     * if (plane.label === 'floor') {
     *     console.log('This plane represents the floor.');
     * } else if (plane.label === 'wall') {
     *     console.log('This plane represents a wall.');
     * }
     */
    get label() {
        return this._xrPlane.semanticLabel || '';
    }
}

export { XrPlane };
