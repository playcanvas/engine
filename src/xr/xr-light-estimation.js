Object.assign(pc, function () {
    var vec3A = new pc.Vec3();
    var vec3B = new pc.Vec3();
    var mat4A = new pc.Mat4();
    var mat4B = new pc.Mat4();

    /**
     * @class
     * @name pc.XrLightEstimation
     * @augments pc.EventHandler
     * @classdesc Light Estimation provides illimunation data from real world, which is estimated by underlying AR systems.
     * It provides reflection Cube Map, that represents reflection estimation from viewer position.
     * More simplified approximation of light is provided by L2 Spherical Harminics data.
     * And the most simple level of light estimation is a most prominent directional light, its rotation, intensity and a color.
     * @description Light Estimation provides illimunation data from real world, which is estimated by underlying AR systems.
     * It provides reflection Cube Map, that represents reflection estimation from viewer position.
     * More simplified approximation of light is provided by L2 Spherical Harminics data.
     * And the most simple level of light estimation is a most prominent directional light, its rotation, intensity and a color.
     * @param {pc.XrManager} manager - WebXR Manager.
     * @property {boolean} supported True if Light Estimation is supported, this information is available only during active AR session.
     * @property {number|null} intensity Intensity of estimated most prominent directional light. Or null if data is not available.
     * @property {pc.Color|null} color Color of estimated most prominent directional light. Or null if data is not available.
     * @property {pc.Quat|null} rotation Rotation of estimated most prominent directional light. Or null if data is not available.
     */
    var XrLightEstimation = function (manager) {
        pc.EventHandler.call(this);

        this._manager = manager;

        this._supported = false;
        this._available = false;

        this._lightProbeRequested = false;
        this._lightProbe = null;

        this._intensity = 0;
        this._rotation = new pc.Quat();
        this._color = new pc.Color();

        this._manager.on('start', this._onSessionStart, this);
        this._manager.on('end', this._onSessionEnd, this);
    };
    XrLightEstimation.prototype = Object.create(pc.EventHandler.prototype);
    XrLightEstimation.prototype.constructor = XrLightEstimation;

    /**
     * @event
     * @name pc.XrLightEstimation#available
     * @description Fired when light estimation data becomes available.
     */

    /**
     * @event
     * @name pc.XrLightEstimation#error
     * @param {Error} error - Error object related to failure of light estimation start.
     * @description Fired when light estimation has failed to start.
     * @example
     * app.xr.lightEstimation.on('error', function (ex) {
     *     // has failed to start
     * });
     */

    XrLightEstimation.prototype._onSessionStart = function () {
        var supported = !! this._manager.session.requestLightProbe;
        if (! supported) return;
        this._supported = true;
    };

    XrLightEstimation.prototype._onSessionEnd = function () {
        this._supported = false;
        this._available = false;

        this._lightProbeRequested = false;
        this._lightProbe = null;
    };

    /**
     * @function
     * @name pc.XrLightEstimation#start
     * @description Start estimation of illimunation data.
     * Availability of such data will come later, and `available` event will be fired.
     * If it failed to start estimation, `error` event will be fired.
     * @example
     * app.xr.on('start', function () {
     *     if (app.xr.lightEstimation.supported) {
     *         app.xr.lightEstimation.start();
     *     }
     * });
     */
    XrLightEstimation.prototype.start = function () {
        var err;

        if (! this._manager.session)
            err = new Error('XR session is not running');

        if (! err && this._manager.type !== pc.XRTYPE_AR)
            err = new Error('XR session type is not AR');

        if (! err && ! this._supported)
            err = new Error('light-estimation is not supported');

        if (! err && this._lightProbe || this._lightProbeRequested)
            err = new Error('light estimation is already requested');

        if (err) {
            this.fire('error', err);
            return;
        }

        var self = this;
        this._lightProbeRequested = true;

        this._manager.session.requestLightProbe(
        ).then(function (lightProbe) {
            var wasRequested = self._lightProbeRequested;
            self._lightProbeRequested = false;

            if (self._manager.active) {
                if (wasRequested) {
                    self._lightProbe = lightProbe;
                }
            } else {
                self.fire('error', new Error('XR session is not active'));
            }
        }).catch(function (ex) {
            self._lightProbeRequested = false;
            self.fire('error', ex);
        });
    };

    /**
     * @function
     * @name pc.XrLightEstimation#stop
     * @description Stop estimation of illimunation data.
     */
    XrLightEstimation.prototype.stop = function () {
        this._lightProbeRequested = false;
        this._lightProbe = null;
        this._available = false;
    };

    XrLightEstimation.prototype.update = function (frame) {
        if (! this._lightProbe) return;

        var lightEstimate = frame.getLightEstimate(this._lightProbe);
        if (! lightEstimate) return;

        if (! this._available) {
            this._available = true;
            this.fire('available');
        }

        // intensity
        this._intensity = Math.max(1.0, Math.max(lightEstimate.primaryLightIntensity.x, Math.max(lightEstimate.primaryLightIntensity.y, lightEstimate.primaryLightIntensity.z)));

        // color
        vec3A.copy(lightEstimate.primaryLightIntensity).scale(1 / this._intensity);
        this._color.set(vec3A.x, vec3A.y, vec3A.z);

        // rotation
        vec3A.set(0, 0, 0);
        vec3B.copy(lightEstimate.primaryLightDirection);
        mat4A.setLookAt(vec3B, vec3A, pc.Vec3.UP);
        mat4B.setFromAxisAngle(pc.Vec3.RIGHT, 90); // direcitonal light is looking down
        mat4A.mul(mat4B);
        this._rotation.setFromMat4(mat4A);
    };

    Object.defineProperty(XrLightEstimation.prototype, 'supported', {
        get: function () {
            return this._supported;
        }
    });

    /**
     * @name pc.XrLightEstimation#available
     * @type {boolean}
     * @description True if estimated light information is available.
     * @example
     * if (app.xr.lightEstimation.available) {
     *     entity.light.intensity = app.xr.lightEstimation.intensity;
     * }
     */
    Object.defineProperty(XrLightEstimation.prototype, 'available', {
        get: function () {
            return !! this._available;
        }
    });

    Object.defineProperty(XrLightEstimation.prototype, 'intensity', {
        get: function () {
            return this._available ? this._intensity : null;
        }
    });

    Object.defineProperty(XrLightEstimation.prototype, 'color', {
        get: function () {
            return this._available ? this._color : null;
        }
    });

    Object.defineProperty(XrLightEstimation.prototype, 'rotation', {
        get: function () {
            return this._available ? this._rotation : null;
        }
    });

    return {
        XrLightEstimation: XrLightEstimation
    };
}());
