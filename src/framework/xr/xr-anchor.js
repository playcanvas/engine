import { EventHandler } from '../../core/event-handler.js';

import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

/**
 * An anchor keeps track of a position and rotation that is fixed relative to the real world.
 * This allows the application to adjust the location of the virtual objects placed in the
 * scene in a way that helps with maintaining the illusion that the placed objects are really
 * present in the user’s environment.
 *
 * @augments EventHandler
 * @category XR
 */
class XrAnchor extends EventHandler {
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
     * @param {import('./xr-anchors.js').XrAnchors} anchors - Anchor manager.
     * @param {object} xrAnchor - native XRAnchor object that is provided by WebXR API
     * @hideconstructor
     */
    constructor(anchors, xrAnchor) {
        super();

        this._anchors = anchors;
        this._xrAnchor = xrAnchor;
    }

    /**
     * Fired when an {@link XrAnchor} is destroyed.
     *
     * @event XrAnchor#destroy
     * @example
     * // once anchor is destroyed
     * anchor.once('destroy', function () {
     *     // destroy its related entity
     *     entity.destroy();
     * });
     */

    /**
     * Fired when an {@link XrAnchor}'s position and/or rotation is changed.
     *
     * @event XrAnchor#change
     * @example
     * anchor.on('change', function () {
     *     // anchor has been updated
     *     entity.setPosition(anchor.getPosition());
     *     entity.setRotation(anchor.getRotation());
     * });
     */

    /**
     * Destroy an anchor.
     */
    destroy() {
        if (!this._xrAnchor) return;
        this._anchors._index.delete(this._xrAnchor);

        const ind = this._anchors._list.indexOf(this);
        if (ind !== -1) this._anchors._list.splice(ind, 1);

        this._xrAnchor.delete();
        this._xrAnchor = null;

        this.fire('destroy');
        this._anchors.fire('destroy', this);
    }

    /**
     * @param {*} frame - XRFrame from requestAnimationFrame callback.
     * @ignore
     */
    update(frame) {
        if (!this._xrAnchor)
            return;

        const pose = frame.getPose(this._xrAnchor.anchorSpace, this._anchors.manager._referenceSpace);
        if (pose) {
            if (this._position.equals(pose.transform.position) && this._rotation.equals(pose.transform.orientation))
                return;

            this._position.copy(pose.transform.position);
            this._rotation.copy(pose.transform.orientation);
            this.fire('change');
        }
    }

    /**
     * Get the world space position of an anchor.
     *
     * @returns {Vec3} The world space position of an anchor.
     */
    getPosition() {
        return this._position;
    }

    /**
     * Get the world space rotation of an anchor.
     *
     * @returns {Quat} The world space rotation of an anchor.
     */
    getRotation() {
        return this._rotation;
    }
}

export { XrAnchor };
