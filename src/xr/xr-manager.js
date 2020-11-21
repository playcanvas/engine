import { EventHandler } from '../core/event-handler.js';

import { Mat3 } from '../math/mat3.js';
import { Mat4 } from '../math/mat4.js';
import { Quat } from '../math/quat.js';
import { Vec3 } from '../math/vec3.js';
import { Vec4 } from '../math/vec4.js';

import { XRTYPE_INLINE, XRTYPE_VR, XRTYPE_AR } from './constants.js';
import { XrHitTest } from './xr-hit-test.js';
import { XrInput } from './xr-input.js';
import { XrLightEstimation } from './xr-light-estimation.js';
import { XrImageTracking } from './xr-image-tracking.js';

/**
 * @class
 * @name pc.XrManager
 * @augments pc.EventHandler
 * @classdesc Manage and update XR session and its states.
 * @description Manage and update XR session and its states.
 * @param {pc.Application} app - The main application.
 * @property {boolean} supported True if XR is supported.
 * @property {boolean} active True if XR session is running.
 * @property {string|null} type Returns type of currently running XR session or null if no session is running. Can be
 * any of pc.XRTYPE_*.
 * @property {string|null} spaceType Returns reference space type of currently running XR session or null if no session
 * is running. Can be any of pc.XRSPACE_*.
 * @property {pc.Entity|null} camera Active camera for which XR session is running or null.
 * @property {pc.XrInput} input provides access to Input Sources.
 * @property {pc.XrHitTest} hitTest provides ability to hit test representation of real world geometry of underlying AR system.
 * @property {object|null} session provides access to [XRSession](https://developer.mozilla.org/en-US/docs/Web/API/XRSession) of WebXR
 */
function XrManager(app) {
    EventHandler.call(this);

    var self = this;

    this.app = app;

    this._supported = !! navigator.xr;

    this._available = { };

    // Add all the supported session types
    this._available[XRTYPE_INLINE] = false;
    this._available[XRTYPE_VR] = false;
    this._available[XRTYPE_AR] = false;

    this._type = null;
    this._spaceType = null;
    this._session = null;
    this._baseLayer = null;
    this._referenceSpace = null;

    this.input = new XrInput(this);
    this.hitTest = new XrHitTest(this);
    this.lightEstimation = new XrLightEstimation(this);
    this.imageTracking = new XrImageTracking(this);

    this._camera = null;
    this.views = [];
    this.viewsPool = [];
    this._localPosition = new Vec3();
    this._localRotation = new Quat();

    this._depthNear = 0.1;
    this._depthFar = 1000;

    this._width = 0;
    this._height = 0;

    // TODO
    // 1. HMD class with its params
    // 2. Space class
    // 3. Controllers class

    if (this._supported) {
        navigator.xr.addEventListener('devicechange', function () {
            self._deviceAvailabilityCheck();
        });
        this._deviceAvailabilityCheck();
    }
}
XrManager.prototype = Object.create(EventHandler.prototype);
XrManager.prototype.constructor = XrManager;

/**
 * @event
 * @name pc.XrManager#available
 * @description Fired when availability of specific XR type is changed.
 * @param {string} type - The session type that has changed availability.
 * @param {boolean} available - True if specified session type is now available.
 * @example
 * app.xr.on('available', function (type, available) {
 *     console.log('"' + type + '" XR session is now ' + (available ? 'available' : 'unavailable'));
 * });
 */

/**
 * @event
 * @name pc.XrManager#available:[type]
 * @description Fired when availability of specific XR type is changed.
 * @param {boolean} available - True if specified session type is now available.
 * @example
 * app.xr.on('available:' + pc.XRTYPE_VR, function (available) {
 *     console.log('Immersive VR session is now ' + (available ? 'available' : 'unavailable'));
 * });
 */

/**
 * @event
 * @name pc.XrManager#start
 * @description Fired when XR session is started
 * @example
 * app.xr.on('start', function () {
 *     // XR session has started
 * });
 */

/**
 * @event
 * @name pc.XrManager#end
 * @description Fired when XR session is ended
 * @example
 * app.xr.on('end', function () {
 *     // XR session has ended
 * });
 */

/**
 * @event
 * @name pc.XrManager#update
 * @param {object} frame - [XRFrame](https://developer.mozilla.org/en-US/docs/Web/API/XRFrame) object that can be used for interfacing directly with WebXR APIs.
 * @description Fired when XR session is updated, providing relevant XRFrame object.
 * @example
 * app.xr.on('update', function (frame) {
 *
 * });
 */

/**
 * @event
 * @name pc.XrManager#error
 * @param {Error} error - Error object related to failure of session start or check of session type support.
 * @description Fired when XR session is failed to start or failed to check for session type support.
 * @example
 * app.xr.on('error', function (ex) {
 *     // XR session has failed to start, or failed to check for session type support
 * });
 */

/**
 * @function
 * @name pc.XrManager#start
 * @description Attempts to start XR session for provided {@link pc.CameraComponent} and optionally fires callback when session is created or failed to create.
 * @param {pc.CameraComponent} camera - it will be used to render XR session and manipulated based on pose tracking
 * @param {string} type - session type. Can be one of the following:
 *
 * * {@link pc.XRTYPE_INLINE}: Inline - always available type of session. It has limited features availability and is rendered into HTML element.
 * * {@link pc.XRTYPE_VR}: Immersive VR - session that provides exclusive access to VR device with best available tracking features.
 * * {@link pc.XRTYPE_AR}: Immersive AR - session that provides exclusive access to VR/AR device that is intended to be blended with real-world environment.
 *
 * @param {string} spaceType - reference space type. Can be one of the following:
 *
 * * {@link pc.XRSPACE_VIEWER}: Viewer - always supported space with some basic tracking capabilities.
 * * {@link pc.XRSPACE_LOCAL}: Local - represents a tracking space with a native origin near the viewer at the time of creation. It is meant for seated or basic local XR sessions.
 * * {@link pc.XRSPACE_LOCALFLOOR}: Local Floor - represents a tracking space with a native origin at the floor in a safe position for the user to stand. The y axis equals 0 at floor level. Floor level value might be estimated by the underlying platform. It is meant for seated or basic local XR sessions.
 * * {@link pc.XRSPACE_BOUNDEDFLOOR}: Bounded Floor - represents a tracking space with its native origin at the floor, where the user is expected to move within a pre-established boundary.
 * * {@link pc.XRSPACE_UNBOUNDED}: Unbounded - represents a tracking space where the user is expected to move freely around their environment, potentially long distances from their starting point.
 *
 * @example
 * button.on('click', function () {
 *     app.xr.start(camera, pc.XRTYPE_VR, pc.XRSPACE_LOCAL);
 * });
 * @param {object} [options] - object with additional options for XR session initialization.
 * @param {string[]} [options.optionalFeatures] - Optional features for XRSession start. It is used for getting access to additional WebXR spec extensions.
 * @param {pc.callbacks.XrError} [options.callback] - Optional callback function called once session is started. The callback has one argument Error - it is null if successfully started XR session.
 */
XrManager.prototype.start = function (camera, type, spaceType, options) {
    var self = this;
    var callback = options;

    if (typeof(options) === 'object')
        callback = options.callback;

    if (! this._available[type]) {
        if (callback) callback(new Error('XR is not available'));
        return;
    }

    if (this._session) {
        if (callback) callback(new Error('XR session is already started'));
        return;
    }

    this._camera = camera;
    this._camera.camera.xr = this;
    this._type = type;
    this._spaceType = spaceType;

    this._setClipPlanes(camera.nearClip, camera.farClip);

    // TODO
    // makeXRCompatible
    // scenario to test:
    // 1. app is running on integrated GPU
    // 2. XR device is connected, to another GPU
    // 3. probably immersive-vr will fail to be created
    // 4. call makeXRCompatible, very likely will lead to context loss

    var opts = {
        requiredFeatures: [spaceType],
        optionalFeatures: []
    };

    if (type === XRTYPE_AR) {
        opts.optionalFeatures.push('light-estimation');
        opts.optionalFeatures.push('hit-test');

        if (options && options.imageTracking) {
            opts.optionalFeatures.push('image-tracking');
        }
    } else if (type === XRTYPE_VR) {
        opts.optionalFeatures.push('hand-tracking');
    }

    if (options && options.optionalFeatures)
        opts.optionalFeatures = opts.optionalFeatures.concat(options.optionalFeatures);

    if (this.imageTracking.images.length) {
        this.imageTracking.prepareImages(function (err, trackedImages) {
            if (err) {
                if (callback) callback(err);
                self.fire('error', err);
                return;
            }

            if (trackedImages !== null)
                opts.trackedImages = trackedImages;

            self._onStartOptionsReady(type, spaceType, opts, callback);
        });
    } else {
        self._onStartOptionsReady(type, spaceType, opts, callback);
    }
};

XrManager.prototype._onStartOptionsReady = function (type, spaceType, options, callback) {
    var self = this;

    navigator.xr.requestSession(type, options).then(function (session) {
        self._onSessionStart(session, spaceType, callback);
    }).catch(function (ex) {
        self._camera.camera.xr = null;
        self._camera = null;
        self._type = null;
        self._spaceType = null;

        if (callback) callback(ex);
        self.fire('error', ex);
    });
};

/**
 * @function
 * @name pc.XrManager#end
 * @description Attempts to end XR session and optionally fires callback when session is ended or failed to end.
 * @example
 * app.keyboard.on('keydown', function (evt) {
 *     if (evt.key === pc.KEY_ESCAPE && app.xr.active) {
 *         app.xr.end();
 *     }
 * });
 * @param {pc.callbacks.XrError} [callback] - Optional callback function called once session is started. The callback has one argument Error - it is null if successfully started XR session.
 */
XrManager.prototype.end = function (callback) {
    if (! this._session) {
        if (callback) callback(new Error('XR Session is not initialized'));
        return;
    }

    if (callback) this.once('end', callback);

    this._session.end();
};

/**
 * @function
 * @name pc.XrManager#isAvailable
 * @description Check if specific type of session is available
 * @param {string} type - session type. Can be one of the following:
 *
 * * {@link pc.XRTYPE_INLINE}: Inline - always available type of session. It has limited features availability and is rendered into HTML element.
 * * {@link pc.XRTYPE_VR}: Immersive VR - session that provides exclusive access to VR device with best available tracking features.
 * * {@link pc.XRTYPE_AR}: Immersive AR - session that provides exclusive access to VR/AR device that is intended to be blended with real-world environment.
 *
 * @example
 * if (app.xr.isAvailable(pc.XRTYPE_VR)) {
 *     // VR is available
 * }
 * @returns {boolean} True if specified session type is available.
 */
XrManager.prototype.isAvailable = function (type) {
    return this._available[type];
};

XrManager.prototype._deviceAvailabilityCheck = function () {
    for (var key in this._available) {
        this._sessionSupportCheck(key);
    }
};

XrManager.prototype._sessionSupportCheck = function (type) {
    var self = this;

    navigator.xr.isSessionSupported(type).then(function (available) {
        if (self._available[type] === available)
            return;

        self._available[type] = available;
        self.fire('available', type, available);
        self.fire('available:' + type, available);
    }).catch(function (ex) {
        self.fire('error', ex);
    });
};

XrManager.prototype._onSessionStart = function (session, spaceType, callback) {
    var self = this;
    var failed = false;

    this._session = session;

    var onVisibilityChange = function () {
        self.fire('visibility:change', session.visibilityState);
    };

    var onClipPlanesChange = function () {
        self._setClipPlanes(self._camera.nearClip, self._camera.farClip);
    };

    // clean up once session is ended
    var onEnd = function () {
        self._session = null;
        self._referenceSpace = null;
        self.views = [];
        self._width = 0;
        self._height = 0;
        self._type = null;
        self._spaceType = null;

        if (self._camera) {
            self._camera.off('set_nearClip', onClipPlanesChange);
            self._camera.off('set_farClip', onClipPlanesChange);

            self._camera.camera.xr = null;
            self._camera = null;
        }

        session.removeEventListener('end', onEnd);
        session.removeEventListener('visibilitychange', onVisibilityChange);

        if (! failed) self.fire('end');

        // old requestAnimationFrame will never be triggered,
        // so queue up new tick
        self.app.tick();
    };

    session.addEventListener('end', onEnd);
    session.addEventListener('visibilitychange', onVisibilityChange);

    this._camera.on('set_nearClip', onClipPlanesChange);
    this._camera.on('set_farClip', onClipPlanesChange);

    this._baseLayer = new XRWebGLLayer(session, this.app.graphicsDevice.gl);

    session.updateRenderState({
        baseLayer: this._baseLayer,
        depthNear: this._depthNear,
        depthFar: this._depthFar
    });

    // request reference space
    session.requestReferenceSpace(spaceType).then(function (referenceSpace) {
        self._referenceSpace = referenceSpace;

        // old requestAnimationFrame will never be triggered,
        // so queue up new tick
        self.app.tick();

        if (callback) callback(null);
        self.fire('start');
    }).catch(function (ex) {
        failed = true;
        session.end();
        if (callback) callback(ex);
        self.fire('error', ex);
    });
};

XrManager.prototype._setClipPlanes = function (near, far) {
    if (this._depthNear === near && this._depthFar === far)
        return;

    this._depthNear = near;
    this._depthFar = far;

    if (! this._session)
        return;

    // if session is available,
    // queue up render state update
    this._session.updateRenderState({
        depthNear: this._depthNear,
        depthFar: this._depthFar
    });
};

XrManager.prototype.update = function (frame) {
    if (! this._session) return;

    var i, view, viewRaw, layer, viewport;
    var lengthNew;

    // canvas resolution should be set on first frame availability or resolution changes
    var width = frame.session.renderState.baseLayer.framebufferWidth;
    var height = frame.session.renderState.baseLayer.framebufferHeight;
    if (this._width !== width || this._height !== height) {
        this._width = width;
        this._height = height;
        this.app.graphicsDevice.setResolution(width, height);
    }

    var pose = frame.getViewerPose(this._referenceSpace);
    lengthNew = pose ? pose.views.length : 0;

    if (lengthNew > this.views.length) {
        // add new views into list
        for (i = 0; i <= (lengthNew - this.views.length); i++) {
            view = this.viewsPool.pop();
            if (! view) {
                view = {
                    viewport: new Vec4(),
                    projMat: new Mat4(),
                    viewMat: new Mat4(),
                    viewOffMat: new Mat4(),
                    viewInvMat: new Mat4(),
                    viewInvOffMat: new Mat4(),
                    projViewOffMat: new Mat4(),
                    viewMat3: new Mat3(),
                    position: new Float32Array(3),
                    rotation: new Quat()
                };
            }

            this.views.push(view);
        }
    } else if (lengthNew <= this.views.length) {
        // remove views from list into pool
        for (i = 0; i < (this.views.length - lengthNew); i++) {
            this.viewsPool.push(this.views.pop());
        }
    }

    if (pose) {
        // reset position
        var posePosition = pose.transform.position;
        var poseOrientation = pose.transform.orientation;
        this._localPosition.set(posePosition.x, posePosition.y, posePosition.z);
        this._localRotation.set(poseOrientation.x, poseOrientation.y, poseOrientation.z, poseOrientation.w);

        layer = frame.session.renderState.baseLayer;

        for (i = 0; i < pose.views.length; i++) {
            // for each view, calculate matrices
            viewRaw = pose.views[i];
            view = this.views[i];
            viewport = layer.getViewport(viewRaw);

            view.viewport.x = viewport.x;
            view.viewport.y = viewport.y;
            view.viewport.z = viewport.width;
            view.viewport.w = viewport.height;

            view.projMat.set(viewRaw.projectionMatrix);
            view.viewMat.set(viewRaw.transform.inverse.matrix);
            view.viewInvMat.set(viewRaw.transform.matrix);
        }
    }

    // position and rotate camera based on calculated vectors
    this._camera.camera._node.setLocalPosition(this._localPosition);
    this._camera.camera._node.setLocalRotation(this._localRotation);

    this.input.update(frame);

    if (this._type === XRTYPE_AR) {
        if (this.hitTest.supported) {
            this.hitTest.update(frame);
        }
        if (this.lightEstimation.supported) {
            this.lightEstimation.update(frame);
        }
        if (this.imageTracking.supported) {
            this.imageTracking.update(frame);
        }
    }

    this.fire('update', frame);
};

Object.defineProperty(XrManager.prototype, 'supported', {
    get: function () {
        return this._supported;
    }
});

Object.defineProperty(XrManager.prototype, 'active', {
    get: function () {
        return !! this._session;
    }
});

Object.defineProperty(XrManager.prototype, 'type', {
    get: function () {
        return this._type;
    }
});

Object.defineProperty(XrManager.prototype, 'spaceType', {
    get: function () {
        return this._spaceType;
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

Object.defineProperty(XrManager.prototype, 'camera', {
    get: function () {
        return this._camera ? this._camera.entity : null;
    }
});

export { XrManager };
