import { EventHandler } from '../../core/event-handler.js';
import { Mat4 } from '../../core/math/mat4.js';

/**
 * @category XR
 * @deprecated
 * @ignore
 */
class XrDepthSensing extends EventHandler {
    /**
     * @event
     * @deprecated
     */
    static EVENT_AVAILABLE = 'available';

    /**
     * @event
     * @deprecated
     */
    static EVENT_UNAVAILABLE = 'unavailable';

    /**
     * @event
     * @deprecated
     */
    static EVENT_RESIZE = 'resize';

    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    _manager;

    /**
     * @type {import('./xr-views.js').XrViews}
     * @private
     */
    _views;

    /**
     * @type {boolean}
     * @private
     */
    _available = false;

    /**
     * @type {import('../../core/event-handle.js').EventHandle|null}
     * @private
     */
    _evtDepthResize = null;

    /**
     * @type {Mat4}
     * @private
     */
    _uvMatrix = Mat4.IDENTITY.clone();

    /**
     * @param {import('./xr-manager.js').XrManager} manager - manager
     * @ignore
     */
    constructor(manager) {
        super();

        this._manager = manager;
        this._views = manager.views;

        if (this._views.supportedDepth) {
            this._manager.on('start', this._onSessionStart, this);
            this._manager.on('end', this._onSessionEnd, this);
        }
    }

    /** @private */
    _onSessionStart() {
        if (this._views.availableDepth)
            this._evtDepthResize = this._views.list[0]?.on('depth:resize', this._onDepthResize, this);
    }

    /** @private */
    _onSessionEnd() {
        if (this._evtDepthResize) {
            this._evtDepthResize.off();
            this._evtDepthResize = null;
        }

        if (this._available) {
            this._available = false;
            this.fire('unavailable');
        }
    }

    /** @private */
    _onDepthResize(width, height) {
        this.fire('resize', width, height);
    }

    /**
     * @param {number} u - u
     * @param {number} v - v
     * @deprecated
     * @returns {number|null} number
     */
    getDepth(u, v) {
        return this._views.list[0]?.getDepth(u, v) ?? null;
    }

    /**
     * @deprecated
     */
    update() {
        if (this._manager.session && this.supported && this._views.availableDepth && this._views.list.length && !this._available) {
            this._available = true;
            this.fire('available');
        }
    }

    /**
     * @type {boolean}
     * @deprecated
     */
    get supported() {
        return this._views.supportedDepth;
    }

    /**
     * @type {boolean}
     * @deprecated
     */
    get available() {
        return this._views.availableDepth;
    }

    /**
     * @type {string}
     * @deprecated
     */
    get usage() {
        return this._views.depthUsage;
    }

    /**
     * @type {string}
     * @deprecated
     */
    get dataFormat() {
        return this._views.depthFormat;
    }

    /**
     * @type {number}
     * @deprecated
     */
    get width() {
        return this._views.list[0]?.textureDepth?.width ?? 0;
    }

    /**
     * @type {number}
     * @deprecated
     */
    get height() {
        return this._views.list[0]?.textureDepth?.height ?? 0;
    }

    /**
     * @type {import('../../platform/graphics/texture.js').Texture|null}
     * @deprecated
     */
    get texture() {
        return this._views.list[0]?.textureDepth;
    }

    /**
     * @type {Mat4}
     * @deprecated
     */
    get uvMatrix() {
        return this._views.list[0]?.depthUvMatrix ?? this._uvMatrix;
    }

    /**
     * @type {number}
     * @deprecated
     */
    get rawValueToMeters() {
        return this._views.list[0]?.depthValueToMeters ?? 0;
    }
}

export { XrDepthSensing };
