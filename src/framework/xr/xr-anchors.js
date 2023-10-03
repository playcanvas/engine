import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { XrAnchor } from './xr-anchor.js';

/**
 * Callback used by {@link XrAnchors#create}.
 *
 * @callback XrAnchorCreate
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
     * @type {boolean}
     * @private
     */
    _supported = platform.browser && !!window.XRAnchor;

    /**
     * List of anchor creation requests.
     *
     * @type {Array<object>}
     * @private
     */
    _creationQueue = [];

    /**
     * Index of XrAnchors, with XRAnchor (native handle) used as a key.
     *
     * @type {Map<XRAnchor,XrAnchor>}
     * @ignore
     */
    _index = new Map();

    /**
     * @type {Array<XrAnchor>}
     * @ignore
     */
    _list = [];

    /**
     * Map of callbacks to XRAnchors so that we can call its callback once
     * an anchor is updated with a pose for the first time.
     *
     * @type {Map<XrAnchor,XrAnchorCreate>}
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
            this.manager.on('end', this._onSessionEnd, this);
        }
    }

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
    _onSessionEnd() {
        // clear anchor creation queue
        for (let i = 0; i < this._creationQueue.length; i++) {
            if (!this._creationQueue[i].callback)
                continue;

            this._creationQueue[i].callback(new Error('session ended'), null);
        }
        this._creationQueue.length = 0;

        // destroy all anchors
        if (this._list) {
            let i = this._list.length;
            while (i--) {
                this._list[i].destroy();
            }
            this._list.length = 0;
        }
    }

    /**
     * Create anchor with position, rotation and a callback.
     *
     * @param {import('../../core/math/vec3.js').Vec3} position - Position for an anchor.
     * @param {import('../../core/math/quat.js').Quat} [rotation] - Rotation for an anchor.
     * @param {XrAnchorCreate} [callback] - Callback to fire when anchor was created or failed to be created.
     * @example
     * app.xr.anchors.create(position, rotation, function (err, anchor) {
     *     if (!err) {
     *         // new anchor has been created
     *     }
     * });
     */
    create(position, rotation, callback) {
        this._creationQueue.push({
            transform: new XRRigidTransform(position, rotation), // eslint-disable-line no-undef
            callback: callback
        });
    }

    /**
     * @param {*} frame - XRFrame from requestAnimationFrame callback.
     * @ignore
     */
    update(frame) {
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

            const anchor = new XrAnchor(this, xrAnchor);
            this._index.set(xrAnchor, anchor);
            this._list.push(anchor);
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
     * List of available {@link XrAnchor}s.
     *
     * @type {Array<XrAnchor>}
     */
    get list() {
        return this._list;
    }
}

export { XrAnchors };
