import { EventHandler } from '../core/event-handler.js';

import { Vec3 } from '../math/vec3.js';
import { Quat } from '../math/quat.js';

/**
 * @class
 * @name XrAnchor
 * @classdesc Anchor provides position and rotation, that is updated by underlying AR system, that tries to better persist an anchor relative to evolving understanding of a real world.
 * @description Anchor provides position and rotation, that is updated by underlying AR system, that tries to better persist an anchor relative to evolving understanding of a real world.
 * @param {XrAnchors} anchors - Anchors manager.
 * @property {object} xrAndhor native XRAnchor object that is provided by WebXR API.
 */
class XrAnchor extends EventHandler {
    constructor(anchors, xrAnchor) {
        super();

        this._anchors = anchors;
        this._xrAnchor = xrAnchor;

        this._position = new Vec3();
        this._rotation = new Quat();
    }

    /**
     * @event
     * @name XrAnchor#remove
     * @description Fired when {@link XrAnchor} is removed.
     * @example
     * // once anchor is removed
     * anchor.once('remove', function () {
     *     // destroy its related entity
     *     entity.destroy();
     * });
     */

    /**
     * @event
     * @name XrAnchor#change
     * @description Fired when an {@link XrAnchor}'s position and/or rotation is changed.
     * @example
     * anchor.on('change', function () {
     *     // anchor has been updated
     *     entity.setPosition(anchor.getPosition());
     *     entity.setRotation(anchor.getRotation());
     * });
     */

    /**
     * @function
     * @name XrAnchor#remove
     * @description Remove an anchor from tracking.
     */
    remove() {
        this._anchors._index.delete(this._xrAnchor);

        const ind = this._anchors._list.indexOf(this);
        if (ind !== -1) this._anchors._list.splice(ind, 1);

        this._xrAnchor.delete();

        this._xrAnchor = null;

        this.fire('remove');
        this._anchors.fire('remove', this);
    }

    update(frame) {
        if (! this._xrAnchor)
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
     * @function
     * @name XrAnchor#getPosition
     * @description Get the world space position of an anchor.
     * @returns {Vec3} The world space position of an anchor.
     */
    getPosition() {
        return this._position;
    }

    /**
     * @function
     * @name XrAnchor#getRotation
     * @description Get the world space rotation of an anchor.
     * @returns {Quat} The world space rotation of an anchor.
     */
    getRotation() {
        return this._rotation;
    }
}

export { XrAnchor };
