import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { XrAnchor } from './xr-anchor.js';

/**
 * Callback used by {@link XrAnchors#create}.
 *
 * @callback XrAnchorCreateCallback
 * @param {Error|null} err - The Error object if failed to create an anchor or null.
 * @param {XrAnchor|null} anchor - The anchor that is tracked against real world geometry.
 */

/**
 * Anchors provide an ability to specify a point in the world that needs to be updated to
 * correctly reflect the evolving understanding of the world by the underlying AR system,
 * such that the anchor remains aligned with the same place in the physical world.
 * Anchors tend to persist better relative to the real world, especially during a longer
 * session with lots of movement.
 *
 * ```javascript
 * app.xr.start(camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
 *     anchors: true
 * });
 * ```
 * @augments EventHandler
 * @category XR
 */
class XrAnchors extends EventHandler {
    /**
     * @type {import('./xr-manager.js').XrManager}
     * @ignore
     */
    manager;

    /**
     * @type {boolean}
     * @private
     */
    _supported = platform.browser && !!window.XRAnchor;

    /**
     * @type {boolean}
     * @private
     */
    _available = false;

    /**
     * @type {boolean}
     * @private
     */
    _persistence = platform.browser && !!window?.XRSession?.prototype.restorePersistentAnchor;

    /**
     * List of anchor creation requests.
     *
     * @type {object[]}
     * @private
     */
    _creationQueue = [];

    /**
     * Index of XrAnchors, with XRAnchor (native handle) used as a key.
     *
     * @type {Map<XRAnchor,XrAnchor>}
     * @private
     */
    _index = new Map();

    /**
     * Index of XrAnchors, with UUID (persistent string) used as a key.
     *
     * @type {Map<string,XrAnchor>}
     * @private
     */
    _indexByUuid = new Map();

    /**
     * @type {XrAnchor[]}
     * @private
     */
    _list = [];

    /**
     * Map of callbacks to XRAnchors so that we can call its callback once
     * an anchor is updated with a pose for the first time.
     *
     * @type {Map<XrAnchor, XrAnchorCreateCallback>}
     * @private
     */
    _callbacksAnchors = new Map();

    /**
     * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
     * @hideconstructor
     */
    constructor(manager) {
        super();

        this.manager = manager;

        if (this._supported) {
            this.manager.on('start', this._onSessionStart, this);
            this.manager.on('end', this._onSessionEnd, this);
        }
    }

    /**
     * Fired when anchors becomes available.
     *
     * @event XrAnchors#available
     */

    /**
     * Fired when anchors becomes unavailable.
     *
     * @event XrAnchors#unavailable
     */

    /**
     * Fired when anchor failed to be created.
     *
     * @event XrAnchors#error
     * @param {Error} error - Error object related to a failure of anchors.
     */

    /**
     * Fired when a new {@link XrAnchor} is added.
     *
     * @event XrAnchors#add
     * @param {XrAnchor} anchor - Anchor that has been added.
     * @example
     * app.xr.anchors.on('add', function (anchor) {
     *     // new anchor is added
     * });
     */

    /**
     * Fired when an {@link XrAnchor} is destroyed.
     *
     * @event XrAnchors#destroy
     * @param {XrAnchor} anchor - Anchor that has been destroyed.
     * @example
     * app.xr.anchors.on('destroy', function (anchor) {
     *     // anchor that is destroyed
     * });
     */

    /** @private */
    _onSessionStart() {
        const available = this.manager.session.enabledFeatures.indexOf('anchors') !== -1;
        if (!available) return;
        this._available = available;
        this.fire('available');
    }

    /** @private */
    _onSessionEnd() {
        if (!this._available) return;
        this._available = false;

        // clear anchor creation queue
        for (let i = 0; i < this._creationQueue.length; i++) {
            if (!this._creationQueue[i].callback)
                continue;

            this._creationQueue[i].callback(new Error('session ended'), null);
        }
        this._creationQueue.length = 0;

        this._index.clear();
        this._indexByUuid.clear();

        // destroy all anchors
        let i = this._list.length;
        while (i--) {
            this._list[i].destroy();
        }
        this._list.length = 0;

        this.fire('unavailable');
    }

    /**
     * @param {XRAnchor} xrAnchor - XRAnchor that has been added.
     * @param {string|null} [uuid] - UUID string associated with persistent anchor.
     * @returns {XrAnchor} new instance of XrAnchor.
     * @private
     */
    _createAnchor(xrAnchor, uuid = null) {
        const anchor = new XrAnchor(this, xrAnchor, uuid);
        this._index.set(xrAnchor, anchor);
        if (uuid) this._indexByUuid.set(uuid, anchor);
        this._list.push(anchor);
        anchor.once('destroy', this._onAnchorDestroy, this);
        return anchor;
    }

    /**
     * @param {XRAnchor} xrAnchor - XRAnchor that has been destroyed.
     * @param {XrAnchor} anchor - Anchor that has been destroyed.
     * @private
     */
    _onAnchorDestroy(xrAnchor, anchor) {
        this._index.delete(xrAnchor);
        if (anchor.uuid) this._indexByUuid.delete(anchor.uuid);
        const ind = this._list.indexOf(anchor);
        if (ind !== -1) this._list.splice(ind, 1);
        this.fire('destroy', anchor);
    }

    /**
     * Create anchor with position, rotation and a callback.
     *
     * @param {import('../../core/math/vec3.js').Vec3|XRHitTestResult} position - Position for an anchor.
     * @param {import('../../core/math/quat.js').Quat|XrAnchorCreateCallback} [rotation] - Rotation for an anchor.
     * @param {XrAnchorCreateCallback} [callback] - Callback to fire when anchor was created or failed to be created.
     * @example
     * // create an anchor using a position and rotation
     * app.xr.anchors.create(position, rotation, function (err, anchor) {
     *     if (!err) {
     *         // new anchor has been created
     *     }
     * });
     * @example
     * // create an anchor from a hit test result
     * hitTestSource.on('result', (position, rotation, inputSource, hitTestResult) => {
     *     app.xr.anchors.create(hitTestResult, function (err, anchor) {
     *         if (!err) {
     *             // new anchor has been created
     *         }
     *     });
     * });
     */
    create(position, rotation, callback) {
        if (!this._available) {
            callback?.(new Error('Anchors API is not available'), null);
            return;
        }

        // eslint-disable-next-line no-undef
        if (window.XRHitTestResult && position instanceof XRHitTestResult) {
            const hitResult = position;
            callback = rotation;

            if (!this._supported) {
                callback?.(new Error('Anchors API is not supported'), null);
                return;
            }

            if (!hitResult.createAnchor) {
                callback?.(new Error('Creating Anchor from Hit Test is not supported'), null);
                return;
            }

            hitResult.createAnchor()
                .then((xrAnchor) => {
                    const anchor = this._createAnchor(xrAnchor);
                    callback?.(null, anchor);
                    this.fire('add', anchor);
                })
                .catch((ex) => {
                    callback?.(ex, null);
                    this.fire('error', ex);
                });
        } else {
            this._creationQueue.push({
                transform: new XRRigidTransform(position, rotation), // eslint-disable-line no-undef
                callback: callback
            });
        }
    }

    /**
     * Restore anchor using persistent UUID.
     *
     * @param {string} uuid - UUID string associated with persistent anchor.
     * @param {XrAnchorCreateCallback} [callback] - Callback to fire when anchor was created or failed to be created.
     * @example
     * // restore an anchor using uuid string
     * app.xr.anchors.restore(uuid, function (err, anchor) {
     *     if (!err) {
     *         // new anchor has been created
     *     }
     * });
     * @example
     * // restore all available persistent anchors
     * const uuids = app.xr.anchors.uuids;
     * for(let i = 0; i < uuids.length; i++) {
     *     app.xr.anchors.restore(uuids[i]);
     * }
     */
    restore(uuid, callback) {
        if (!this._available) {
            callback?.(new Error('Anchors API is not available'), null);
            return;
        }

        if (!this._persistence) {
            callback?.(new Error('Anchor Persistence is not supported'), null);
            return;
        }

        if (!this.manager.active) {
            callback?.(new Error('WebXR session is not active'), null);
            return;
        }

        this.manager.session.restorePersistentAnchor(uuid)
            .then((xrAnchor) => {
                const anchor = this._createAnchor(xrAnchor, uuid);
                callback?.(null, anchor);
                this.fire('add', anchor);
            })
            .catch((ex) => {
                callback?.(ex, null);
                this.fire('error', ex);
            });
    }

    /**
     * Forget an anchor by removing its UUID from underlying systems.
     *
     * @param {string} uuid - UUID string associated with persistent anchor.
     * @param {import('./xr-anchor.js').XrAnchorForgetCallback} [callback] - Callback to
     * fire when anchor persistent data was removed or error if failed.
     * @example
     * // forget all available anchors
     * const uuids = app.xr.anchors.uuids;
     * for(let i = 0; i < uuids.length; i++) {
     *     app.xr.anchors.forget(uuids[i]);
     * }
     */
    forget(uuid, callback) {
        if (!this._available) {
            callback?.(new Error('Anchors API is not available'));
            return;
        }

        if (!this._persistence) {
            callback?.(new Error('Anchor Persistence is not supported'));
            return;
        }

        if (!this.manager.active) {
            callback?.(new Error('WebXR session is not active'));
            return;
        }

        this.manager.session.deletePersistentAnchor(uuid)
            .then(() => {
                callback?.(null);
            })
            .catch((ex) => {
                callback?.(ex);
                this.fire('error', ex);
            });
    }

    /**
     * @param {*} frame - XRFrame from requestAnimationFrame callback.
     * @ignore
     */
    update(frame) {
        if (!this._available)
            return;

        // check if need to create anchors
        if (this._creationQueue.length) {
            for (let i = 0; i < this._creationQueue.length; i++) {
                const request = this._creationQueue[i];

                frame.createAnchor(request.transform, this.manager._referenceSpace)
                    .then((xrAnchor) => {
                        if (request.callback)
                            this._callbacksAnchors.set(xrAnchor, request.callback);
                    })
                    .catch((ex) => {
                        if (request.callback)
                            request.callback(ex, null);

                        this.fire('error', ex);
                    });
            }

            this._creationQueue.length = 0;
        }

        // check if destroyed
        for (const [xrAnchor, anchor] of this._index) {
            if (frame.trackedAnchors.has(xrAnchor))
                continue;

            this._index.delete(xrAnchor);
            anchor.destroy();
        }

        // update existing anchors
        for (let i = 0; i < this._list.length; i++) {
            this._list[i].update(frame);
        }

        // check if added
        for (const xrAnchor of frame.trackedAnchors) {
            if (this._index.has(xrAnchor))
                continue;

            try {
                const tmp = xrAnchor.anchorSpace; // eslint-disable-line no-unused-vars
            } catch (ex) {
                // if anchorSpace is not available, then anchor is invalid
                // and should not be created
                continue;
            }

            const anchor = this._createAnchor(xrAnchor);
            anchor.update(frame);

            const callback = this._callbacksAnchors.get(xrAnchor);
            if (callback) {
                this._callbacksAnchors.delete(xrAnchor);
                callback(null, anchor);
            }

            this.fire('add', anchor);
        }
    }

    /**
     * True if Anchors are supported.
     *
     * @type {boolean}
     */
    get supported() {
        return this._supported;
    }

    /**
     * True if Anchors are available. This information is available only when session has started.
     *
     * @type {boolean}
     */
    get available() {
        return this._available;
    }

    /**
     * True if Anchors support persistence.
     *
     * @type {boolean}
     */
    get persistence() {
        return this._persistence;
    }

    /**
     * Array of UUID strings of persistent anchors, or null if not available.
     *
     * @type {null|string[]}
     */
    get uuids() {
        if (!this._available)
            return null;

        if (!this._persistence)
            return null;

        if (!this.manager.active)
            return null;

        return this.manager.session.persistentAnchors;
    }

    /**
     * List of available {@link XrAnchor}s.
     *
     * @type {XrAnchor[]}
     */
    get list() {
        return this._list;
    }
}

export { XrAnchors };
