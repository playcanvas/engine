import { EventHandler } from '../core/event-handler.js';
import { XrAnchor } from './xr-anchor.js';

/**
 * @class
 * @name XrAnchors
 * @classdesc Anchors provide an ability to specify a point in the world that need to be updated to correctly reflect the evolving understanding of the world by the underlying AR system, such that the anchor remains aligned with the same place in the physical world. Anchors tend to persist better relative to the real world, especially during a longer session with lots of movement.
 * @description Anchors provide an ability to specify a point in the world that need to be updated to correctly reflect the evolving understanding of the world by the underlying AR system, such that the anchor remains aligned with the same place in the physical world. Anchors tend to persist better relative to the real world, especially during a longer session with lots of movement.
 * @param {XrManager} manager - WebXR Manager.
 * @property {boolean} supported True if Anchors are supported.
* @property {XrAnchor[]} list Array of active {@link XrAnchor}s.
 * @example
 * app.xr.start(camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
 *     anchors: true
 * });
 */
class XrAnchors extends EventHandler {
    constructor(manager) {
        super();

        this.manager = manager;
        this._supported = !! window.XRAnchor;

        // list of anchor creation requests
        this._creationQueue = [];

        // key - XRAnchor (native anchor does not have an ID)
        // value - XrAnchor
        this._index = new Map();
        this._list = null;

        // map of callbacks to XRAnchors so that we can call its callback once an anchor is updated
        // with a pose for the first time
        //
        // key - XRAnchor
        // value - function
        this._callbacks = new Map();

        if (this._supported) {
            this.manager.on('start', this._onSessionStart, this);
            this.manager.on('end', this._onSessionEnd, this);
        }
    }

    /**
     * @event
     * @name XrAnchors#error
     * @param {Error} error - Error object related to a failure of anchors.
     * @description Fired when anchor failed to be created.
     */

    /**
     * @event
     * @name XrAnchors#add
     * @description Fired when a new {@link XrAnchor} is added.
     * @param {XrAnchor} anchor - Anchor that has been added.
     * @example
     * app.xr.anchors.on('add', function (anchor) {
     *     // new anchor is added
     * });
     */

    /**
     * @event
     * @name XrAnchors#remove
     * @description Fired when {@link XrAnchor} is removed.
     * @param {XrAnchor} anchor - Anchor that has been removed.
     * @example
     * app.xr.anchors.on('remove', function (anchor) {
     *     // anchor that is removed
     * });
     */

    _onSessionStart() {
        this._list = [];
    }

    _onSessionEnd() {
        // clear anchor creation queue
        for (let i = 0; i < this._creationQueue.length; i++) {
            if (! this._creationQueue[i].callback)
                continue;

            this._creationQueue[i].callback(new Error('session ended'), null);
        }
        this._creationQueue.length = 0;

        // remove all anchors
        if (this._list) {
            let i = this._list.length;
            while (i--) {
                this._list[i].remove();
            }
            this._list = null;
        }
    }

    /**
     * @function
     * @name XrAnchors#create
     * @description Create anchor with position and rotation, with a callback.
     * @param {Vec3} position - Position for an anchor
     * @param {Quat} [rotation] - Rotastion for an anchor
     * @param {callbacks.XrAnchorCreate} [callback] - Callback to fire when anchor was created or failed to be created
     * @example
     * app.xr.anchors.create(position, rotation, function (err, anchor) {
     *     if (! err) {
     *         // new anchor has been created
     *     }
     * });
     */
    create(position, rotation, callback) {
        this._creationQueue.push({
            transform: new XRRigidTransform(position, rotation),
            callback: callback
        });
    }

    update(frame) {
        // check if need to create anchors
        if (this._creationQueue.length) {
            for (let i = 0; i < this._creationQueue.length; i++) {
                const request = this._creationQueue[i];

                frame.createAnchor(request.transform, this.manager._referenceSpace)
                    .then((xrAnchor) => {
                        if (request.callback)
                            this._callbacks.set(xrAnchor, request.callback);
                    })
                    .catch((ex) => {
                        if (request.callback)
                            request.callback(ex, null);

                        this.fire('error', ex);
                    });
            }

            this._creationQueue.length = 0;
        }

        // check if removed
        for (const [xrAnchor, anchor] of this._index) {
            if (frame.trackedAnchors.has(xrAnchor))
                continue;

            anchor.remove();
        }

        // update existing anchors
        for (let i = 0; i < this._list.length; i++) {
            this._list[i].update(frame);
        }

        // check if added
        for (const xrAnchor of frame.trackedAnchors) {
            if (this._index.has(xrAnchor))
                continue;

            const anchor = new XrAnchor(this, xrAnchor);
            this._index.set(xrAnchor, anchor);
            this._list.push(anchor);
            anchor.update(frame);

            const callback = this._callbacks.get(xrAnchor);
            if (callback) {
                this._callbacks.delete(xrAnchor);
                callback(null, anchor);
            }

            this.fire('add', anchor);
        }
    }

    get supported() {
        return this._supported;
    }

    get list() {
        return this._list;
    }
}

export { XrAnchors };
