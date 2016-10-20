pc.extend(pc, function () {
    var VrManager = function (app) {
        pc.events.attach(this);

        var self = this;

        // if required initialize webvr polyfill
        if (window.InitializeWebVRPolyfill) {
            window.InitializeWebVRPolyfill();
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

        destroy: function () {
            this._detach();
        },

        poll: function () {
            for (var i = 0, n = this.displays.length; i < n; i++) {
                this.displays[i].poll();
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
