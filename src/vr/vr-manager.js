import { EventHandler } from '../core/event-handler.js';

import { VrDisplay } from './vr-display.js';

/**
 * @private
 * @deprecated
 * @class
 * @name VrManager
 * @augments pc.EventHandler
 * @classdesc Manage and update {@link pc.VrDisplay}s that are attached to this device.
 * @description Manage and update {@link pc.VrDisplay}s that are attached to this device.
 * @param {pc.Application} app - The main application.
 * @property {pc.VrDisplay[]} displays The list of {@link pc.VrDisplay}s that are attached to this device.
 * @property {pc.VrDisplay} display The default {@link pc.VrDisplay} to be used. Usually the first in the `displays` list.
 * @property {boolean} isSupported Reports whether this device supports the WebVR API.
 */
class VrManager extends EventHandler {
    constructor(app) {
        super();

        var self = this;

        this.isSupported = VrManager.isSupported;

        this._index = {};
        this.displays = [];
        this.display = null; // primary display (usually the first in list)

        this._app = app;

        // bind functions for event callbacks
        this._onDisplayConnect = this._onDisplayConnect.bind(this);
        this._onDisplayDisconnect = this._onDisplayDisconnect.bind(this);

        self._attach();

        this._getDisplays(function (err, displays) {
            if (err) {
                // webvr not available
                self.fire('error', err);
            } else {
                for (var i = 0; i < displays.length; i++) {
                    self._addDisplay(displays[i]);
                }

                self.fire('ready', self.displays);
            }
        });
    }

    /**
     * @private
     * @deprecated
     * @event
     * @name VrManager#displayconnect
     * @description Fired when an VR display is connected.
     * @param {pc.VrDisplay} display - The {@link pc.VrDisplay} that has just been connected.
     * @example
     * this.app.vr.on("displayconnect", function (display) {
     *     // use `display` here
     * });
     */

    /**
     * @private
     * @deprecated
     * @event
     * @name VrManager#displaydisconnect
     * @description Fired when an VR display is disconnected.
     * @param {pc.VrDisplay} display - The {@link pc.VrDisplay} that has just been disconnected.
     * @example
     * this.app.vr.on("displaydisconnect", function (display) {
     *     // `display` is no longer connected
     * });
     */

    /**
     * @private
     * @deprecated
     * @static
     * @name VrManager.isSupported
     * @type {boolean}
     * @description Reports whether this device supports the WebVR API.
     */
    static isSupported = (typeof navigator !== 'undefined') ? !!navigator.getVRDisplays : false;

    _attach() {
        window.addEventListener('vrdisplayconnect', this._onDisplayConnect);
        window.addEventListener('vrdisplaydisconnect', this._onDisplayDisconnect);
    }

    _detach() {
        window.removeEventListener('vrdisplayconnect', this._onDisplayConnect);
        window.removeEventListener('vrdisplaydisconnect', this._onDisplayDisconnect);
    }

    /**
     * @private
     * @deprecated
     * @function
     * @name VrManager#destroy
     * @description Remove events and clear up manager.
     */
    destroy() {
        this._detach();
    }

    /**
     * @private
     * @deprecated
     * @function
     * @name VrManager#poll
     * @description Called once per frame to poll all attached displays.
     */
    poll() {
        var l = this.displays.length;
        if (!l) return;
        for (var i = 0; i < l; i++) {
            if (this.displays[i]._camera) this.displays[i].poll();
        }
    }

    _getDisplays(callback) {
        if (navigator.getVRDisplays) {
            navigator.getVRDisplays().then(function (displays) {
                if (callback) callback(null, displays);
            });
        } else {
            if (callback) callback(new Error('WebVR not supported'));
        }
    }

    _addDisplay(vrDisplay) {
        if (this._index[vrDisplay.displayId])
            return;

        var display = new VrDisplay(this._app, vrDisplay);
        this._index[display.id] = display;
        this.displays.push(display);

        if (!this.display)
            this.display = display;

        this.fire('displayconnect', display);
    }

    _onDisplayConnect(e) {
        if (e.detail && e.detail.display) {
            // polyfill has different event format
            this._addDisplay(e.detail.display);
        } else {
            // real event API
            this._addDisplay(e.display);
        }
    }

    _onDisplayDisconnect(e) {
        var id;
        if (e.detail && e.detail.display) {
            // polyfill has different event format
            id = e.detail.display.displayId;
        } else {
            // real event API
            id = e.display.displayId;
        }

        var display = this._index[id];
        if (!display)
            return;

        display.destroy();

        delete this._index[display.id];

        var ind = this.displays.indexOf(display);
        this.displays.splice(ind, 1);

        if (this.display === display) {
            if (this.displays.length) {
                this.display = this.displays[0];
            } else {
                this.display = null;
            }
        }

        this.fire('displaydisconnect', display);
    }
}

export { VrManager };
