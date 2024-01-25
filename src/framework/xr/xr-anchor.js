import { EventHandler } from '../../core/event-handler.js';

import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

/**
 * Callback used by {@link XrAnchor#persist}.
 *
 * @callback XrAnchorPersistCallback
 * @param {Error|null} err - The Error object if failed to persist an anchor or null.
 * @param {string|null} uuid - unique string that can be used to restore {@link XRAnchor}
 * in another session.
 */

/**
 * Callback used by {@link XrAnchor#forget}.
 *
 * @callback XrAnchorForgetCallback
 * @param {Error|null} err - The Error object if failed to forget an anchor or null if succeeded.
 */

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
     * Fired when an anchor is destroyed.
     *
     * @event
     * @example
     * // once anchor is destroyed
     * anchor.once('destroy', () => {
     *     // destroy its related entity
     *     entity.destroy();
     * });
     */
    static EVENT_DESTROY = 'destroy';

    /**
     * Fired when an anchor's position and/or rotation is changed.
     *
     * @event
     * @example
     * anchor.on('change', () => {
     *     // anchor has been updated
     *     entity.setPosition(anchor.getPosition());
     *     entity.setRotation(anchor.getRotation());
     * });
     */
    static EVENT_CHANGE = 'change';

    /**
     * Fired when an anchor has has been persisted. The handler is passed the UUID string that can
     * be used to restore this anchor.
     *
     * @event
     * @example
     * anchor.on('persist', (uuid) => {
     *     // anchor has been persisted
     * });
     */
    static EVENT_PERSIST = 'persist';

    /**
     * Fired when an anchor has been forgotten.
     *
     * @event
     * @example
     * anchor.on('forget', () => {
     *     // anchor has been forgotten
     * });
     */
    static EVENT_FORGET = 'forget';

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
     * Destroy an anchor.
     */
    destroy() {
        if (!this._xrAnchor) return;
        const xrAnchor = this._xrAnchor;
        this._xrAnchor.delete();
        this._xrAnchor = null;
        this.fire('destroy', xrAnchor, this);
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

    /**
     * This method provides a way to persist anchor and get a string with UUID.
     * UUID can be used later to restore anchor.
     * Bear in mind that underlying systems might have a limit on number of anchors
     * allowed to be persisted.
     *
     * @param {XrAnchorPersistCallback} [callback] - Callback to fire when anchor
     * persistent UUID has been generated or error if failed.
     */
    persist(callback) {
        if (!this._anchors.persistence) {
            callback?.(new Error('Persistent Anchors are not supported'), null);
            return;
        }

        if (this._uuid) {
            callback?.(null, this._uuid);
            return;
        }

        if (this._uuidRequests) {
            if (callback) this._uuidRequests.push(callback);
            return;
        }

        this._uuidRequests = [];

        this._xrAnchor.requestPersistentHandle()
            .then((uuid) => {
                this._uuid = uuid;
                this._anchors._indexByUuid.set(this._uuid, this);
                callback?.(null, uuid);
                for (let i = 0; i < this._uuidRequests.length; i++) {
                    this._uuidRequests[i](null, uuid);
                }
                this._uuidRequests = null;
                this.fire('persist', uuid);
            })
            .catch((ex) => {
                callback?.(ex, null);
                for (let i = 0; i < this._uuidRequests.length; i++) {
                    this._uuidRequests[i](ex);
                }
                this._uuidRequests = null;
            });
    }

    /**
     * This method provides a way to remove persistent UUID of an anchor for underlying systems.
     *
     * @param {XrAnchorForgetCallback} [callback] - Callback to fire when anchor has been
     * forgotten or error if failed.
     */
    forget(callback) {
        if (!this._uuid) {
            callback?.(new Error('Anchor is not persistent'));
            return;
        }

        this._anchors.forget(this._uuid, (ex) => {
            this._uuid = null;
            callback?.(ex);
            this.fire('forget');
        });
    }

    /**
     * UUID string of a persistent anchor or null if not presisted.
     *
     * @type {null|string}
     */
    get uuid() {
        return this._uuid;
    }

    /**
     * True if an anchor is persistent.
     *
     * @type {boolean}
     */
    get persistent() {
        return !!this._uuid;
    }
}

export { XrAnchor };
