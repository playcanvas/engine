pc.extend(pc, function () {
    var Hmd = function (app) {
        InitializeWebVRPolyfill();

        this._app = app;
        this._device = app.graphicsDevice;

        this._frameData = new VRFrameData();
        this.display = null;

        this.presenting = false;

        pc.events.attach(this);
    };

    Hmd.prototype = {
        initialize: function (fn) {
            var self = this;
            self._presentChange = function () {
                self.presenting = (self.display && self.display.isPresenting);
            };
            window.addEventListener('vrdisplaypresentchange', self._presentChange, false);

            this._enumerateDisplays(fn);
        },

        destroy: function () {
            window.removeEventListener('vrdisplaypresentchange', self._presentChange);
        },

        poll: function () {
            if (this.display) {
                this.display.getFrameData(this._frameData);
            }
        },

        requestPresent: function (callback) {
            var self = this;
            if (this.display) {
                this.display.requestPresent([{source: this._device.canvas}]).then(function () {
                    if (callback) callback();
                }, function (err) {
                    if (callback) callback(err);
                });
            }
        },

        exitPresent: function (callback) {
            var self = this;
            if (this.display) {
                this.display.exitPresent().then(function () {
                    if (callback) callback();
                }, function () {
                    if (callback) callback("exitPresent failed");
                });
            }
        },

        submitFrame: function () {
            if (this.display) this.display.submitFrame();
        },

        getFrameData: function () {
            if (this.display) return this._frameData;
        },

        _enumerateDisplays: function (fn) {
            var self = this;
            if (navigator.getVRDisplays) {
                navigator.getVRDisplays().then(function (displays) {
                    if (displays.length) {
                        self.display = displays[0];
                    }
                    fn(null, self);
                });
            } else {
                fn(new Error("WebVR not supported"));
            }
        },
    };

    return {
        Hmd: Hmd
    };
}());
