import { EventHandler } from '../core/event-handler.js';
import { Vec3 } from '../math/vec3.js';
import { Quat } from '../math/quat.js';

let ids = 0;

/**
 * @class
 * @name XrPlane
 * @classdesc Detected Plane instance that provides position, rotation and polygon points. Plane is a subject to change during its lifetime.
 * @description Detected Plane instance that provides position, rotation and polygon points. Plane is a subject to change during its lifetime.
 * @param {XrPlaneDetection} planeDetection - Plane detection system.
 * @param {object} xrPlane - XRPlane that is instantiated by WebXR system.
 * @property {number} id Unique identifier of a plane.
 * @property {string|null} orientation Plane's specific orientation (horizontal or vertical) or null if orientation is anything else.
 */
class XrPlane extends EventHandler {
    constructor(planeDetection, xrPlane) {
        super();

        this._id = ++ids;

        this._planeDetection = planeDetection;
        this._manager = this._planeDetection._manager;

        this._xrPlane = xrPlane;
        this._lastChangedTime = this._xrPlane.lastChangedTime;
        this._orientation = this._xrPlane.orientation;

        this._position = new Vec3();
        this._rotation = new Quat();
    }

    /**
     * @event
     * @name XrPlane#remove
     * @description Fired when {@link XrPlane} is removed.
     * @example
     * plane.once('remove', function () {
     *     // plane is not available anymore
     * });
     */

    /**
     * @event
     * @name XrPlane#change
     * @description Fired when {@link XrPlane} attributes such as: orientation and/or points have been changed. Position and rotation can change at any time without triggering a `change` event.
     * @example
     * plane.on('change', function () {
     *     // plane has been changed
     * });
     */

    destroy() {
        this.fire('remove');
    }

    update(frame) {
        const pose = frame.getPose(this._xrPlane.planeSpace, this._manager._referenceSpace);
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
     * @function
     * @name XrPlane#getPosition
     * @description Get the world space position of a plane.
     * @returns {Vec3} The world space position of a plane.
     */
    getPosition() {
        return this._position;
    }

    /**
     * @function
     * @name XrPlane#getRotation
     * @description Get the world space rotation of a plane.
     * @returns {Quat} The world space rotation of a plane.
     */
    getRotation() {
        return this._rotation;
    }

    get id() {
        return this.id;
    }

    get orientation() {
        return this._orientation;
    }

    /**
     * @name XrPlane#points
     * @type {object[]}
     * @description Array of DOMPointReadOnly objects. DOMPointReadOnly is an object with `x y z` properties that defines a local point of a plane's polygon.
     * @example
     * // prepare reusable objects
     * var vecA = new pc.Vec3();
     * var vecB = new pc.Vec3();
     * var color = new pc.Color(1, 1, 1);
     *
     * // update Mat4 to plane position and rotation
     * transform.setTRS(plane.getPosition(), plane.getRotation(), pc.Vec3.ONE);
     *
     * // draw lines between points
     * for (var i = 0; i < plane.points.length; i++) {
     *     vecA.copy(plane.points[i]);
     *     vecB.copy(plane.points[(i + 1) % plane.points.length]);
     *
     *     // transform from planes local to world coords
     *     transform.transformPoint(vecA, vecA);
     *     transform.transformPoint(vecB, vecB);
     *
     *     // render line
     *     app.renderLine(vecA, vecB, color);
     * }
     */
    get points() {
        return this._xrPlane.polygon;
    }
}

export { XrPlane };
