import { platform } from '../../core/platform.js';
import { EventHandler } from "../../core/event-handler.js";
import { XrView } from "./xr-view.js";
import { XRTYPE_AR } from "./constants.js";

/**
 * Provides access to list of {@link XrView}'s. And information about their capabilities,
 * such as support and availability of view's camera color texture.
 *
 * @category XR
 */
class XrViews extends EventHandler {
    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    _manager;

    /**
     * @type {Map<string,XrView>}
     * @private
     */
    _index = new Map();

    /**
     * @type {Map<string,XrView>}
     * @private
     */
    _indexTmp = new Map();

    /**
     * @type {XrView[]}
     * @private
     */
    _list = [];

    /**
     * @type {boolean}
     * @private
     */
    _supportedColor = platform.browser && !!window.XRCamera && !!window.XRWebGLBinding;

    /**
     * @type {boolean}
     * @private
     */
    _availableColor = false;

    /**
     * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
     * @hideconstructor
     */
    constructor(manager) {
        super();

        this._manager = manager;
        this._manager.on('start', this._onSessionStart, this);
        this._manager.on('end', this._onSessionEnd, this);
    }

    /**
     * Fired when view has been added. Views are not available straight away on session start
     * and are added mid-session. They can be added/removed mid session by underlyng system.
     *
     * @event XrViews#add
     * @param {XrView} view - XrView that has been added.
     * @example
     * xr.views.on('add', function (view) {
     *     // view that has been added
     * });
     */

    /**
     * Fired when view has been removed. They can be added/removed mid session by underlyng system.
     *
     * @event XrViews#remove
     * @param {XrView} view - XrView that has been removed.
     * @example
     * xr.views.on('remove', function (view) {
     *     // view that has been added
     * });
     */

    /**
     * An array of {@link XrView}'s of this session. Views are not available straight
     * away on session start, and can be added/removed mid-session. So use of add/remove
     * events is required for accessing views.
     *
     * @type {XrView[]}
     */
    get list() {
        return this._list;
    }

    /**
     * Check if Camera Color is supported. It might be still unavailable even if requested,
     * based on hardware capabilities and granted permissions.
     *
     * @type {boolean}
     */
    get supportedColor() {
        return this._supportedColor;
    }

    /**
     * Check if Camera Color is available. This information becomes available only after
     * session has started.
     *
     * @type {boolean}
     */
    get availableColor() {
        return this._availableColor;
    }

    /**
     * @param {*} frame - XRFrame from requestAnimationFrame callback.
     * @param {XRView} xrView - XRView from WebXR API.
     * @ignore
     */
    update(frame, xrViews) {
        for (let i = 0; i < xrViews.length; i++) {
            this._indexTmp.set(xrViews[i].eye, xrViews[i]);
        }

        for (const [eye, xrView] of this._indexTmp) {
            let view = this._index.get(eye);

            if (!view) {
                // add new view
                view = new XrView(this._manager, xrView);
                this._index.set(eye, view);
                this._list.push(view);
                view.update(frame, xrView);
                this.fire('add', view);
            } else {
                // update existing view0
                view.update(frame, xrView);
            }
        }

        // remove views
        for (const [eye, view] of this._index) {
            if (this._indexTmp.has(eye))
                continue;

            view.destroy();
            this._index.delete(eye);
            const ind = this._list.indexOf(view);
            if (ind !== -1) this._list.splice(ind, 1);
            this.fire('remove', view);
        }

        this._indexTmp.clear();
    }

    /**
     * @param {string} eye - An XREYE_* view is associated with. Can be 'none' for monoscope views.
     * @returns {XrView|null} View or null if view of such eye is not available.
     */
    get(eye) {
        return this._index.get(eye) || null;
    }

    /**
     * @private
     */
    _onSessionStart() {
        if (this._manager.type !== XRTYPE_AR)
            return;
        this._availableColor = this._manager.session.enabledFeatures.indexOf('camera-access') !== -1;
    }

    /**
     * @private
     */
    _onSessionEnd() {
        for (const view of this._index.values()) {
            view.destroy();
        }
        this._index.clear();
        this._availableColor = false;
        this._list.length = 0;
    }
}

export { XrViews };
