import { EventHandler } from '../core/event-handler.js';

import { VrDisplay } from './vr-display.js';

/** @typedef {import('../framework/application.js').Application} Application */

/**
 * Manage and update {@link VrDisplay}s that are attached to this device.
 *
 * @augments EventHandler
 * @deprecated
 * @ignore
 */
class VrManager extends EventHandler {
    /**
     * displays The list of {@link VrDisplay}s that are attached to this device.
     *
     * @type {VrDisplay[]}
     */
    displays = [];

    /**
     * The default {@link VrDisplay} to be used. Usually the first in the `displays` list.
     *
     * @type {VrDisplay}
     */
    display = null;

    /**
     * Reports whether this device supports the WebVR API.
     *
     * @type {boolean}
     */
    isSupported;

    /**
     * Create a new VrManager instance.
     *
     * @param {Application} app - The main application.
     */
    constructor(app) {
        super();

        this._index = {};

        this._app = app;

        this.isSupported = VrManager.isSupported;

        // bind functions for event callbacks
        this._onDisplayConnect = this._onDisplayConnect.bind(this);
        this._onDisplayDisconnect = this._onDisplayDisconnect.bind(this);

        this._attach();

        this._getDisplays((err, displays) => {
            if (err) {
                // webvr not available
                this.fire('error', err);
            } else {
                for (let i = 0; i < displays.length; i++) {
                    this._addDisplay(displays[i]);
                }

                this.fire('ready', this.displays);
            }
        });
    }

    /**
     * @ignore
     * @deprecated
     * @event
     * @name VrManager#displayconnect
     * @description Fired when an VR display is connected.
     * @param {VrDisplay} display - The {@link VrDisplay} that has just been connected.
     * @example
     * this.app.vr.on("displayconnect", function (display) {
     *     // use `display` here
     * });
     */

    /**
     * @ignore
     * @deprecated
     * @event
     * @name VrManager#displaydisconnect
     * @description Fired when an VR display is disconnected.
     * @param {VrDisplay} display - The {@link VrDisplay} that has just been disconnected.
     * @example
     * this.app.vr.on("displaydisconnect", function (display) {
     *     // `display` is no longer connected
     * });
     */

    /**
     * Reports whether this device supports the WebVR API.
     *
     * @type {boolean}
     * @deprecated
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
     * Remove events and clear up manager.
     *
     * @deprecated
     */
    destroy() {
        this._detach();
    }

    /**
     * Called once per frame to poll all attached displays.
     *
     * @deprecated
     */
    poll() {
        const l = this.displays.length;
        if (!l) return;
        for (let i = 0; i < l; i++) {
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

        const display = new VrDisplay(this._app, vrDisplay);
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
        let id;
        if (e.detail && e.detail.display) {
            // polyfill has different event format
            id = e.detail.display.displayId;
        } else {
            // real event API
            id = e.display.displayId;
        }

        const display = this._index[id];
        if (!display)
            return;

        display.destroy();

        delete this._index[display.id];

        const ind = this.displays.indexOf(display);
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
