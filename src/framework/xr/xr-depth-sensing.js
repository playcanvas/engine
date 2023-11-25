import { EventHandler } from '../../core/event-handler.js';

/**
 * @augments EventHandler
 * @category XR
 * @deprecated
 * @ignore
 */
class XrDepthSensing extends EventHandler {
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
     * @param {import('./xr-manager.js').XrManager} manager - manager
     * @hideconstructor
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

    /**
     * @event XrDepthSensing#available
     * @deprecated
     * @ignore
     */

    /**
     * @event XrDepthSensing#unavailable
     * @deprecated
     * @ignore
     */

    /**
     * @event XrDepthSensing#resize
     * @param {number} width
     * @param {number} height
     * @deprecated
     * @ignore
     */

    /** @private */
    _onSessionStart() {
        if (this._views.availableDepth) {
            this._available = true;
            this._evtDepthResize = this._views.list[0]?.on('depth:resize', this._onDepthResize, this);
            this.fire('available');
        }
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
     * @ignore
     * @returns {number|null} number
     */
    getDepth(u, v) {
        return this._views.list[0]?.getDepth(u, v) ?? null;
    }

    /**
     * @type {boolean}
     * @deprecated
     * @ignore
     */
    get supported() {
        return this._views.supportedDepth;
    }

    /**
     * @type {boolean}
     * @deprecated
     * @ignore
     */
    get available() {
        return this._views.availableDepth;
    }

    /**
     * @type {string}
     * @deprecated
     * @ignore
     */
    get usage() {
        return this._views.depthUsage;
    }

    /**
     * @type {string}
     * @deprecated
     * @ignore
     */
    get dataFormat() {
        return this._views.depthFormat;
    }

    /**
     * @type {number}
     * @deprecated
     * @ignore
     */
    get width() {
        return this._views.list[0]?.textureDepth?.width ?? 0;
    }

    /**
     * @type {number}
     * @deprecated
     * @ignore
     */
    get height() {
        return this._views.list[0]?.textureDepth?.height ?? 0;
    }

    /**
     * @type {import('../../platform/graphics/texture.js').Texture|null}
     * @deprecated
     * @ignore
     */
    get texture() {
        return this._views.list[0]?.textureDepth;
    }

    /**
     * @type {import('../../core/math/mat4.js').Mat4}
     * @deprecated
     * @ignore
     */
    get uvMatrix() {
        return this._views.list[0]?.depthUvMatrix;
    }

    /**
     * @type {number}
     * @deprecated
     * @ignore
     */
    get rawValueToMeters() {
        return this._views.list[0]?.depthValueToMeters ?? 0;
    }
}

export { XrDepthSensing };
