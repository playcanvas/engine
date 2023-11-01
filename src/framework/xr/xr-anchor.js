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
     * @type {string|null}
     * @private
     */
    _uuid = null;

    /**
     * @type {string[]|null}
     * @private
     */
    _uuidRequests = null;

    /**
     * @param {import('./xr-anchors.js').XrAnchors} anchors - Anchor manager.
     * @param {object} xrAnchor - native XRAnchor object that is provided by WebXR API
     * @param {string|null} uuid - ID string associated with a persistent anchor
     * @hideconstructor
     */
    constructor(anchors, xrAnchor, uuid = null) {
        super();

        this._anchors = anchors;
        this._xrAnchor = xrAnchor;
        this._uuid = uuid;
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

        if (this._uuid)
            this._anchors._indexByUuid.delete(this._uuid);

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

    persist(callback) {
        if (!this._anchors.persistence)
            return callback(new Error('Persistent Anchors are not supported'), null);

        if (this._uuid)
            return callback(null, this._uuid);

        if (this._uuidRequests) {
            this._uuidRequests.push(callback);
            return;
        }

        this._uuidRequests = [];

        this._xrAnchor.requestPersistentHandle()
            .then((uuid) => {
                this._uuid = uuid;
                this._anchors._indexByUuid.set(this._uuid, this);
                callback(null, uuid);
                for(let i = 0; i < this._uuidRequests.length; i++) {
                    this._uuidRequests[i](null, uuid);
                }
                this._uuidRequests = null;
            })
            .catch((ex) => {
                callback(ex);
                for(let i = 0; i < this._uuidRequests.length; i++) {
                    this._uuidRequests[i](ex);
                }
                this._uuidRequests = null;
            });
    }

    delete(callback) {
        if (!this._uuid) {
            if (callback) callback(new Error('Anchor is not persistent'));
            return;
        }

        this._anchors.delete(this._uuid, (ex) => {
            this._uuid = null;
            if (callback) callback(ex);
        });
    }

    get uuid() {
        return this._uuid;
    }

    get persistent() {
        return !!this._uuid;
    }
}

export { XrAnchor };
