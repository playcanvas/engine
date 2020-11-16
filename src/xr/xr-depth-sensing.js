import { EventHandler } from '../core/event-handler.js';

/**
 * @class
 * @name pc.XrDepthSensing
 * @augments pc.EventHandler
 * @classdesc Depth Sensing provides depth information which is reconstructed using underlying AR system. It provides ability to query depth value (CPU path) or access a depth texture (GPU path). Depth information can be used (not limited to) for: reconstructing real world geometry; virtual object placement; occlusion of virtual objects by real world geometry; and more.
 * @description Depth Sensing provides depth information which is reconstructed using underlying AR system. It provides ability to query depth value (CPU path) or access a depth texture (GPU path). Depth information can be used (not limited to) for: reconstructing real world geometry; virtual object placement; occlusion of virtual objects by real world geometry; and more.
 * @param {pc.XrManager} manager - WebXR Manager.
 * @property {boolean} supported True if Depth Sensing is supported.
 * @property {number} width Width of depth texture or 0 if not available.
 * @property {number} height Height of depth texture or 0 if not available.
 */
function XrDepthSensing(manager) {
    EventHandler.call(this);

    this._manager = manager;
    this._depthInfo = null;
    this._available = false;

    this._manager.on('end', this._onSessionEnd, this);
}
XrDepthSensing.prototype = Object.create(EventHandler.prototype);
XrDepthSensing.prototype.constructor = XrDepthSensing;

/**
 * @event
 * @name pc.XrDepthSensing#available
 * @description Fired when depth sensing data becomes available.
 */

/**
 * @event
 * @name pc.XrDepthSensing#unavailable
 * @description Fired when depth sensing data becomes unavailable.
 */

XrDepthSensing.prototype._onSessionEnd = function () {
    this._depthInfo = null;

    if (this._available) {
        this._available = false;
        this.fire('unavailable');
    }
};

XrDepthSensing.prototype.update = function (frame, view) {
    if (view) {
        this._depthInfo = frame.getDepthInformation(view);
    } else {
        this._depthInfo = null;
    }

    if (this._depthInfo && ! this._available) {
        this._available = true;
        this.fire('available');
    } else if (! this._depthInfo && this._available) {
        this._available = false;
        this.fire('unavailable');
    }
};

/**
 * @function
 * @name pc.XrDepthSensing#getDepth
 * @param {number} x - x coordinate of pixel in depth texture.
 * @param {number} y - y coordinate of pixel in depth texture.
 * @description Get depth value from depth information in meters. X and Y coordinates are in depth texture space, use {@link pc.XrDepthSensing#width} and {@link pc.XrDepthSensing#height}. This is not using GPU texture, and is a CPU path.
 * @example
 * var depth = app.xr.depthSensing.getDepth(x, y);
 * if (depth !== null) {
 *     // depth in meters
 * }
 * @returns {number|null} Depth in meters or null if depth information is not available.
 */
XrDepthSensing.prototype.getDepth = function (x, y) {
    if (! this._depthInfo)
        return null;

    return this._depthInfo.getDepth(x, y);
};

Object.defineProperty(XrDepthSensing.prototype, 'supported', {
    get: function () {
        return !! window.XRDepthInformation;
    }
});

/**
 * @name pc.XrDepthSensing#available
 * @type {boolean}
 * @description True if depth sensing information is available.
 * @example
 * if (app.xr.depthSensing.available) {
 *     var depth = app.xr.depthSensing.getDepth(x, y);
 * }
 */
Object.defineProperty(XrDepthSensing.prototype, 'available', {
    get: function () {
        return this._available;
    }
});

Object.defineProperty(XrDepthSensing.prototype, 'width', {
    get: function () {
        return this._depthInfo && this._depthInfo.width || 0;
    }
});

Object.defineProperty(XrDepthSensing.prototype, 'height', {
    get: function () {
        return this._depthInfo && this._depthInfo.height || 0;
    }
});

export { XrDepthSensing };
