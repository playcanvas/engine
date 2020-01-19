Object.assign(pc, function () {
    function mat3FromMat4(m3, m4) {
        m3.data[0] = m4.data[0];
        m3.data[1] = m4.data[1];
        m3.data[2] = m4.data[2];

        m3.data[3] = m4.data[4];
        m3.data[4] = m4.data[5];
        m3.data[5] = m4.data[6];

        m3.data[6] = m4.data[8];
        m3.data[7] = m4.data[9];
        m3.data[8] = m4.data[10];
    }

    var XrManager = function (app) {
        pc.EventHandler.call(this);

        var self = this;

        this.app = app;

        this._supported = !! navigator.xr;
        this._available = false;
        this._session = null;
        this._baseLayer = null;
        this._referenceSpace = null;
        this._inputSources = [];

        this._pose = null;
        this.views = [];
        this.viewsPool = [];
        this.position = new pc.Vec3();
        this.rotation = new pc.Quat();

        this.depthNear = 0.1;
        this.depthFar = 1000;

        // TODO
        // 1. HMD class with its params
        // 2. Space class
        // 3. Controllers class

        // TODO
        // better APIs

        if (this._supported) {
            navigator.xr.addEventListener('devicechange', function () {
                self._deviceVailabilityCheck();
            });
            this._deviceVailabilityCheck();
        }
    };
    XrManager.prototype = Object.create(pc.EventHandler.prototype);
    XrManager.prototype.constructor = XrManager;

    XrManager.prototype._deviceVailabilityCheck = function () {
        var self = this;

        navigator.xr.isSessionSupported('immersive-vr').then(function (available) {
            if (self._available === available)
                return;

            self._available = available;
            self.fire('available', self._available);
        });
    };

    XrManager.prototype.sessionStart = function (callback) {
        if (! this._available)
            return callback(new Error('XR is not available'));

        if (this._session)
            return callback(new Error('XR session is already started'));

        var self = this;

        // TODO
        // makeXRCompatible
        // scenario to test:
        // 1. app is running on integrated GPU
        // 2. XR device is connected, to another GPU
        // 3. probably immersive-vr will fail to be created
        // 4. call makeXRCompatible, very likely will lead to context loss

        navigator.xr.requestSession('immersive-vr').then(function (session) {
            self._onSessionStart(session, callback);
        });
    };

    XrManager.prototype.sessionEnd = function () {
        if (! this._session)
            return;

        this._session.end();
    };

    XrManager.prototype._onSessionStart = function (session, callback) {
        var self = this;

        this._session = session;

        var onVisibilityChange = function () {
            self.fire('visibility:change',  session.visibilityState);
        };

        var onInputSourcesChange = function (evt) {
            var i;

            for (i = 0; i < evt.removed.length; i++) {
                self._inputSourceRemove(evt.removed[i]);
            }
            for (i = 0; i < evt.added.length; i++) {
                self._inputSourceAdd(evt.added[i]);
            }
        };

        var onEnd = function () {
            self._session = null;
            self._referenceSpace = null;
            self._inputSources = [];
            self._pose = null;
            self.views = [];

            session.removeEventListener('end', onEnd);
            session.removeEventListener('visibilitychange', onVisibilityChange);
            session.removeEventListener('inputsourceschange', onInputSourcesChange);

            self.fire('session:end', session);
        };

        session.addEventListener('end', onEnd);
        session.addEventListener('visibilitychange', onVisibilityChange);
        session.addEventListener('inputsourceschange', onInputSourcesChange);

        this._baseLayer = new XRWebGLLayer(session, this.app.graphicsDevice.gl);

        session.updateRenderState({
            baseLayer: this._baseLayer
        });

        session.requestReferenceSpace('local').then(function (referenceSpace) {
            self._referenceSpace = referenceSpace;

            if (callback) callback(null, session);
            self.fire('session:start', session);
        });
    };

    XrManager.prototype._inputSourceAdd = function (inputSource) {
        this._inputSources.push(inputSource);
        this.fire('inputSource:add', inputSource);
    };

    XrManager.prototype._inputSourceRemove = function (inputSource) {
        var ind = this._inputSources.indexOf(inputSource);
        if (ind === -1) return;
        this._inputSources.splice(ind, 1);
        this.fire('inputSource:remove', inputSource);
    };

    XrManager.prototype.setClipPlanes = function (near, far) {
        if (this.depthNear === near && this.depthFar === far)
            return;

        this.depthNear = near;
        this.depthFar = far;

        // TODO
        // update clip planes
    };

    XrManager.prototype.calculateViews = function (frame) {
        if (! this._session) return;

        var i, view, viewRaw, layer, viewport, position, rotation;

        this._pose = frame.getViewerPose(this._referenceSpace);

        if (this._pose.views.length > this.views.length) {
            for (i = 0; i <= (this._pose.views.length - this.views.length); i++) {
                view = this.viewsPool.pop();
                if (! view) {
                    view = {
                        viewport: new pc.Vec4(),
                        projMat: new pc.Mat4(),
                        viewMat: new pc.Mat4(),
                        viewInvMat: new pc.Mat4(),
                        projViewMat: new pc.Mat4(),
                        viewMat3: new pc.Mat3(),
                        position: new pc.Vec3(),
                        rotation: new pc.Quat()
                    };
                }

                this.views.push(view);
            }
        } else if (this._pose.views.length <= this.views.length) {
            for (i = 0; i < (this.views.length - this._pose.views.length); i++) {
                this.viewsPool.push(this.views.pop());
            }
        }

        this.position.set(0, 0, 0);

        layer = frame.session.renderState.baseLayer;

        for (i = 0; i < this._pose.views.length; i++) {
            viewRaw = this._pose.views[i];
            view = this.views[i];
            viewport = layer.getViewport(viewRaw);

            view.viewport.x = viewport.x;
            view.viewport.y = viewport.y;
            view.viewport.z = viewport.width;
            view.viewport.w = viewport.height;

            view.projMat.set(viewRaw.projectionMatrix);
            view.viewMat.set(viewRaw.transform.inverse.matrix);
            view.viewInvMat.set(viewRaw.transform.matrix);
            view.projViewMat.mul2(view.projMat, view.viewMat);
            mat3FromMat4(view.viewMat3, view.viewMat);

            position = viewRaw.transform.position;
            view.position.set(position.x, position.y, position.z);
            this.position.add(view.position);

            rotation = viewRaw.transform.orientation;
            view.rotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
            this.rotation.copy(view.rotation);
        }

        this.position.scale(1 / this._pose.views.length);
    };

    Object.defineProperty(XrManager.prototype, 'isSupported', {
        get: function () {
            return this._supported;
        }
    });

    Object.defineProperty(XrManager.prototype, 'isAvailable', {
        get: function () {
            return this._available;
        }
    });

    Object.defineProperty(XrManager.prototype, 'session', {
        get: function () {
            return this._session;
        }
    });

    Object.defineProperty(XrManager.prototype, 'visibilityState', {
        get: function () {
            if (! this._session)
                return null;

            return this._session.visibilityState;
        }
    });

    Object.defineProperty(XrManager.prototype, 'inputSources', {
        get: function () {
            return this._inputSources;
        }
    });

    return {
        XrManager: XrManager
    };
}());
