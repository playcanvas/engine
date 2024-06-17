import { EventHandler } from '../../core/event-handler.js';

import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

/**
 * Callback used by {@link XrAnchor#persist}.
 *
 * @callback XrAnchorPersistCallback
 * @param {Error|null} err - The Error object if failed to persist an anchor or null.
 * @param {string|null} uuid - Unique string that can be used to restore {@link XrAnchor}
 * in another session.
 */

/**
 * Callback used by {@link XrAnchor#forget}.
 *
 * @callback XrAnchorForgetCallback
 * @param {Error|null} err - The Error object if failed to forget an anchor or null if succeeded.
 */

/**
 * An anchor keeps track of a position and rotation that is fixed relative to the real world. This
 * allows the application to adjust the location of virtual objects placed in the scene in a way
 * that helps with maintaining the illusion that the placed objects are really present in the
 * user's environment.
 *
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
     * @type {XrAnchorPersistCallback[]|null}
     * @private
     */
    _uuidRequests = null;

    /**
     * @param {import('./xr-anchors.js').XrAnchors} anchors - Anchor manager.
     * @param {object} xrAnchor - Native XRAnchor object that is provided by WebXR API.
     * @param {string|null} uuid - ID string associated with a persistent anchor.
     * @ignore
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
     * @param {XRFrame} frame - XRFrame from requestAnimationFrame callback.
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
     * Persists the anchor between WebXR sessions by generating a universally unique identifier
     * (UUID) for the anchor. This UUID can be used later to restore the anchor from the underlying
     * system. Note that the underlying system may have a limit on the number of anchors that can
     * be persisted per origin.
     *
     * @param {XrAnchorPersistCallback} [callback] - Optional callback function to be called when
     * the persistent UUID has been generated or if an error occurs.
     * @example
     * // Persist the anchor and log the UUID or error
     * anchor.persist((err, uuid) => {
     *     if (err) {
     *         console.error('Failed to persist anchor:', err);
     *     } else {
     *         console.log('Anchor persisted with UUID:', uuid);
     *     }
     * });
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
                for (const uuidRequest of this._uuidRequests) {
                    uuidRequest(null, uuid);
                }
                this._uuidRequests = null;
                this.fire('persist', uuid);
            })
            .catch((ex) => {
                callback?.(ex, null);
                for (const uuidRequest of this._uuidRequests) {
                    uuidRequest(ex, null);
                }
                this._uuidRequests = null;
            });
    }

    /**
     * Removes the persistent UUID of an anchor from the underlying system. This effectively makes
     * the anchor non-persistent, so it will not be restored in future WebXR sessions.
     *
     * @param {XrAnchorForgetCallback} [callback] - Optional callback function to be called when
     * the anchor has been forgotten or if an error occurs.
     * @example
     * // Forget the anchor and log the result or error
     * anchor.forget((err) => {
     *     if (err) {
     *         console.error('Failed to forget anchor:', err);
     *     } else {
     *         console.log('Anchor has been forgotten');
     *     }
     * });
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
     * Gets the UUID string of a persisted anchor or null if the anchor is not persisted.
     *
     * @type {null|string}
     */
    get uuid() {
        return this._uuid;
    }

    /**
     * Gets whether an anchor is persistent.
     *
     * @type {boolean}
     */
    get persistent() {
        return !!this._uuid;
    }
}

export { XrAnchor };
