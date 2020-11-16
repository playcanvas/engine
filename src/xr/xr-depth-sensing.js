import { EventHandler } from '../core/event-handler.js';

function XrDepthSensing(manager) {
    EventHandler.call(this);

    this._manager = manager;
    this._depthInfo = null;
    this._frame = null;
}
XrDepthSensing.prototype = Object.create(EventHandler.prototype);
XrDepthSensing.prototype.constructor = XrDepthSensing;

XrDepthSensing.prototype.update = function(frame) {
    this._frame = frame;
};

Object.defineProperty(XrDepthSensing.prototype, 'supported', {
    get: function () {
        return !! window.XRDepthInformation;
    }
});

export { XrDepthSensing };
