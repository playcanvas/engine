pc.extend(pc, function () {
    /**
     * @name pc.VrManager
     * @class Manage and update {@link pc.VrDisplay}s that are attached to this device.
     * @description Manage and update {@link pc.VrDisplay}s that are attached to this device.
     * @param {pc.Application} app The main application
     * @property {[pc.VrDisplay]} displays The list of {@link pc.VrDisplay}s that are attached to this device
     * @property {pc.VrDisplay} display The default {@link pc.VrDisplay} to be used. Usually the first in the `displays` list
     */
    var VrManager = function (app) {
        pc.events.attach(this);

        var self = this;

        this._polyfill = false;
        // if required initialize webvr polyfill
        if (window.InitializeWebVRPolyfill) {
            window.InitializeWebVRPolyfill();
            this._polyfill = true;
        }

        this.displays = [];
        this.display = null; // primary display (usually the first in list)

        this._app = app;

        // bind functions for event callbacks
        this._onDisplayConnect = this._onDisplayConnect.bind(this);
        this._onDisplayDisconnect = this._onDisplayDisconnect.bind(this);
        this._onDisplayActivate = this._onDisplayActivate.bind(this);
        this._onDisplayDeactivate = this._onDisplayDeactivate.bind(this);
        this._onDisplayBlur = this._onDisplayBlur.bind(this);
        this._onDisplayFocus = this._onDisplayFocus.bind(this);

        self._attach();

        this._getDisplays(function (err, displays) {
            if (err) {
                // webvr not available
                self.fire("error", err);
            } else {
                self.displays = [];
                for (var i = 0; i < displays.length; i++) {
                    self.displays.push(new pc.VrDisplay(self._app, displays[i]));
                }
                if (self.displays.length) {
                    self.display = self.displays[0];
                } else {
                    self.display = null;
                }
                self.fire("ready", self.displays);
            }
        });

    };

    /**
     * @function
     * @name pc.VrManager.hasWebVr
     * @description Reports whether this device supports the WebVR API
     * @returns true if WebVR API is available
     */
    VrManager.hasWebVr = function () {
        return !!(navigator.getVRDisplays);
    };

    /**
     * @function
     * @name pc.VrManager.hasPolyfillWebVr
     * @description Reports whether this device supports the WebVR API using a polyfill
     * @returns true if WebVR API is available using a polyfill
     */
    VrManager.hasPolyfillWebVr = function () {
        return !!(window.InitializeWebVRPolyfill);
    };

    VrManager.prototype = {

        _attach: function () {
            window.addEventListener("vrdisplayconnect", this._onDisplayConnect);
            window.addEventListener("vrdisplaydisconnect", this._onDisplayDisconnect);
            window.addEventListener("vrdisplayactivate", this._onDisplayActivate);
            window.addEventListener("vrdisplaydeactivate", this._onDisplayDeactivate);
            window.addEventListener("vrdisplayblur", this._onDisplayBlur);
            window.addEventListener("vrdisplayfocus", this._onDisplayFocus);
        },

        _detach: function () {
            window.removeEventListener("vrdisplayconnect", this._onDisplayConnect);
            window.removeEventListener("vrdisplaydisconnect", this._onDisplayDisconnect);
            window.removeEventListener("vrdisplayactivate", this._onDisplayActivate);
            window.removeEventListener("vrdisplaydeactivate", this._onDisplayDeactivate);
            window.removeEventListener("vrdisplayblur", this._onDisplayBlur);
            window.removeEventListener("vrdisplayfocus", this._onDisplayFocus);
        },

        /**
         * @function
         * @name pc.VrManager#destroy
         * @description Remove events and clear up manager
         */
        destroy: function () {
            this._detach();
        },

        /**
         * @function
         * @name pc.VrManager#poll
         * @description Called once per frame to poll all attached displays
         */
         poll: function () {
            var l = this.displays.length;
            if (!l) return;
            for (var i = 0; i < l; i++) {
                if (this.displays[i]._camera) this.displays[i].poll();
            }
        },

        _getDisplays: function (callback) {
            var self = this;
            if (navigator.getVRDisplays) {
                navigator.getVRDisplays().then(function (displays) {
                    if (callback) callback(null, displays);
                });
            } else {
                if (callback) callback("WebVR not supported");
            }
        },

        _getDisplayIndex: function(display) {
            for (var i = 0; i < this.displays.length; i++) {
                if (this.displays[i].display === display) {
                    return i;
                }
            }

            return -1;
        },

        _onDisplayConnect: function (e) {
            var i = this._getDisplayIndex(e.display);
            if (i < 0) {
                var display = new pc.VrDisplay(this._app, e.display);
                this.displays.push(e.display);
                this.available = true;
                if (this.displays.length === 1) {
                    this.display = e.display;
                }

                this.fire("displayconnect", display);
            }
        },

        _onDisplayDisconnect: function (e) {
            var i = this._getDisplayIndex(e.display);
            if (i >= 0) {
                this.fire("displaydisconnect", this.displays[i]);

                this.displays[i].destroy();
                if (this.display === this.displays[i]) this.display = null;
                this.displays.splice(i,1);
                if (this.displays.length === 0) {
                    this.available = false;
                }
            }
        },

        _onDisplayActivate: function (e) {
            // not supported
        },

        _onDisplayDeactivate: function (e) {
            // not supported
        },

        _onDisplayBlur: function (e) {
            // not supported
        },

        _onDisplayFocus: function (e) {
            // not supported
        }
    };

    Object.defineProperty(VrManager.prototype, "available", {
        get: function () {
            return !!this.displays.length;
        }
    });

    return {
        VrManager: VrManager
    }
}());
