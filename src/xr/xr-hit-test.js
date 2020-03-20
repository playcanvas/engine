Object.assign(pc, function () {
    var hitTestTrackableTypes = {
        /**
         * @constant
         * @type string
         * @name pc.XRTRACKABLE_POINT
         * @description Point - indicates that the hit test results will be computed based on the feature points detected by the underlying Augmented Reality system.
         */
        XRTRACKABLE_POINT: 'point',

        /**
         * @constant
         * @type string
         * @name pc.XRTRACKABLE_PLANE
         * @description Plane - indicates that the hit test results will be computed based on the planes detected by the underlying Augmented Reality system.
         */
        XRTRACKABLE_PLANE: 'plane',

        /**
         * @constant
         * @type string
         * @name pc.XRTRACKABLE_MESH
         * @description Mesh - indicates that the hit test results will be computed based on the meshes detected by the underlying Augmented Reality system.
         */
        XRTRACKABLE_MESH: 'mesh'
    };


    /**
     * @class
     * @name pc.XrHitTest
     * @augments pc.EventHandler
     * @classdesc Hit Test provides ability to get position and rotation of ray intersecting point with representation of real world geometry by underlying AR system.
     * @description Hit Test provides ability to get position and rotation of ray intersecting point with representation of real world geometry by underlying AR system.
     * @param {pc.XrManager} manager - WebXR Manager.
     * @property {boolean} supported True if AR Hit Test is supported.
     * @property {pc.XrHitTestSource[]} hitTestSources list of active {pc.XrHitTestSource}.
     */
    var XrHitTest = function (manager) {
        pc.EventHandler.call(this);

        this.manager = manager;
        this._supported = !! window.XRSession.prototype.requestHitTestSource;

        this._session = null;

        this.hitTestSources = [];

        if (this._supported) {
            this.manager.on('start', this._onSessionStart, this);
            this.manager.on('end', this._onSessionEnd, this);
        }
    };
    XrHitTest.prototype = Object.create(pc.EventHandler.prototype);
    XrHitTest.prototype.constructor = XrHitTest;

    /**
     * @event
     * @name pc.XrHitTest#add
     * @description Fired when new {pc.XrHitTestSource} is added to the list.
     * @param {pc.XrHitTestSource} hitTestSource - Hit test source that has been added
     * @example
     * app.xr.hitTest.on('add', function (hitTestSource) {
     *     // new hit test source is added
     * });
     */

    /**
     * @event
     * @name pc.XrHitTest#remove
     * @description Fired when {pc.XrHitTestSource} is removed to the list.
     * @param {pc.XrHitTestSource} hitTestSource - Hit test source that has been removed
     * @example
     * app.xr.hitTest.on('remove', function (hitTestSource) {
     *     // hit test source is removed
     * });
     */

    /**
     * @event
     * @name pc.XrHitTest#result
     * @description Fired when hit test source receives new results. It provides transform information that tries to match real world picked geometry.
     * @param {pc.XrHitTestSource} hitTestSource - Hit test source that produced the hit result
     * @param {pc.Vec3} position - Position of hit test
     * @param {pc.Quat} rotation - Rotation of hit test
     * @param {pc.XrInputSource|null} inputSource - If is transient hit test source, then it will provide related input source
     * @example
     * app.xr.hitTest.on('result', function (hitTestSource, position, rotation, inputSource) {
     *     target.setPosition(position);
     *     target.setRotation(rotation);
     * });
     */

    /**
     * @event
     * @name pc.XrHitTest#error
     * @param {Error} error - Error object related to failure of creating hit test source.
     * @description Fired when failed create hit test source.
     */

    XrHitTest.prototype._onSessionStart = function () {
        if (this.manager.type !== pc.XRTYPE_AR)
            return;

        this._session = this.manager.session;
    };

    XrHitTest.prototype._onSessionEnd = function () {
        if (! this._session)
            return;

        this._session = null;

        for (var i = 0; i < this.hitTestSources.length; i++) {
            this.hitTestSources[i].onStop();
        }
        this.hitTestSources = [];
    };

    XrHitTest.prototype.isAvailable = function (callback, fireError) {
        var err;

        if (! this._supported)
            err = new Error('XR HitTest is not supported');

        if (! this._session)
            err = new Error('XR Session is not started (1)');

        if (this.manager.type !== pc.XRTYPE_AR)
            err = new Error('XR HitTest is available only for AR');

        if (err) {
            if (callback) callback(err);
            if (fireError) fireError.fire('error', err);
            return false;
        }

        return true;
    };

    /**
     * @function
     * @name pc.XrHitTest#start
     * @description Attempts to start hit test with provided reference space.
     * @param {string} [spaceType] - Optional reference space type. Defaults to {pc.XRSPACE_VIEWER}. Can be one of the following:
     *
     * * {@link pc.XRSPACE_VIEWER}: Viewer - hit test will be facing relative to viewers space.
     * * {@link pc.XRSPACE_LOCAL}: Local - represents a tracking space with a native origin near the viewer at the time of creation.
     * * {@link pc.XRSPACE_LOCALFLOOR}: Local Floor - represents a tracking space with a native origin at the floor in a safe position for the user to stand. The y axis equals 0 at floor level. Floor level value might be estimated by the underlying platform.
     * * {@link pc.XRSPACE_BOUNDEDFLOOR}: Bounded Floor - represents a tracking space with its native origin at the floor, where the user is expected to move within a pre-established boundary.
     * * {@link pc.XRSPACE_UNBOUNDED}: Unbounded - represents a tracking space where the user is expected to move freely around their environment, potentially long distances from their starting point.
     *
     * @param {string[]} [entityTypes] - Optional list of underlying entity types against which hit tests will be performed. Defaults to [ {pc.XRTRACKABLE_PLANE} ]. Can be any combination of the following:
     *
     * * {@link pc.XRTRACKABLE_POINT}: Point - indicates that the hit test results will be computed based on the feature points detected by the underlying Augmented Reality system.
     * * {@link pc.XRTRACKABLE_PLANE}: Plane - indicates that the hit test results will be computed based on the planes detected by the underlying Augmented Reality system.
     * * {@link pc.XRTRACKABLE_MESH}: Mesh - indicates that the hit test results will be computed based on the meshes detected by the underlying Augmented Reality system.
     *
     * @param {pc.Ray} [offsetRay] - Optional ray by which hit test ray can be offset.
     * @param {pc.callbacks.XrHitTestStart} [callback] - Optional callback function called once hit test source is created or failed.
     * @example
     * app.xr.hitTest.start(function (err, hitTestSource) {
     *     if (err) return;
     *     hitTestSource.on('result', function (position, rotation) {
     *         // position and rotation of hit test result
     *         // based on default Ray facing forward from the Viewer (default space)
     *     });
     * });
     * @example
     * var ray = new pc.Ray(new pc.Vec3(0, 0, 0), new pc.Vec3(0, -1, 0));
     * app.xr.hitTest.start(pc.XRSPACE_LOCAL, [pc.XRTRACKABLE_PLANE], ray, function (err, hitTestSource) {
     *     // hit test source that will sample real world geometry straight down
     *     // from the position where AR session started
     * });
     */
    XrHitTest.prototype.start = function (spaceType, entityTypes, offsetRay, callback) {
        var self = this;

        if (! spaceType) {
            spaceType = pc.XRSPACE_VIEWER;
        } else if (typeof(spaceType) === 'function') {
            callback = spaceType;
            spaceType = pc.XRSPACE_VIEWER;
        } else if (typeof(entityTypes) === 'function') {
            callback = entityTypes;
            entityTypes = undefined;
        } else if (typeof(offsetRay) === 'function') {
            callback = offsetRay;
            offsetRay = undefined;
        }

        if (! this.isAvailable(callback, this))
            return;

        this._session.requestReferenceSpace(spaceType).then(function (referenceSpace) {
            if (! self._session) {
                var err = new Error('XR Session is not started (2)');
                if (callback) callback(err);
                self.fire('error', err);
                return;
            }

            var xrRay;
            if (offsetRay) xrRay = new XRRay(new DOMPoint(offsetRay.origin.x, offsetRay.origin.y, offsetRay.origin.z), new DOMPoint(offsetRay.direction.x, offsetRay.direction.y, offsetRay.direction.z));

            self._session.requestHitTestSource({
                space: referenceSpace,
                entityTypes: entityTypes || undefined,
                offsetRay: xrRay
            }).then(function (xrHitTestSource) {
                if (! self._session) {
                    xrHitTestSource.cancel();
                    var err = new Error('XR Session is not started (3)');
                    if (callback) callback(err);
                    self.fire('error', err);
                    return;
                }

                var hitTestSource = new pc.XrHitTestSource(self.manager, xrHitTestSource);
                self.hitTestSources.push(hitTestSource);

                if (callback) callback(null, hitTestSource);
                self.fire('add', hitTestSource);
            }).catch(function (ex) {
                if (callback) callback(ex);
                self.fire('error', ex);
            });
        }).catch(function (ex) {
            if (callback) callback(ex);
            self.fire('error', ex);
        });
    };

    /**
     * @function
     * @name pc.XrHitTest#startForInputSource
     * @description Attempts to start hit test with provided input source profile.
     * @param {string} profile - name of profile of the {pc.XrInputSource}.
     * @param {string[]} [entityTypes] - Optional list of underlying entity tipes against which hit tests will be performed. Defaults to [ {pc.XRTRACKABLE_PLANE} ]. Can be any combination of the following:
     *
     * * {@link pc.XRTRACKABLE_POINT}: Point - indicates that the hit test results will be computed based on the feature points detected by the underlying Augmented Reality system.
     * * {@link pc.XRTRACKABLE_PLANE}: Plane - indicates that the hit test results will be computed based on the planes detected by the underlying Augmented Reality system.
     * * {@link pc.XRTRACKABLE_MESH}: Mesh - indicates that the hit test results will be computed based on the meshes detected by the underlying Augmented Reality system.
     *
     * @param {pc.Ray} [offsetRay] - Optional ray by which hit test ray can be offset.
     * @param {pc.callbacks.XrHitTestStart} [callback] - Optional callback function called once hit test source is created or failed.
     * @example
     * app.xr.hitTest.start('generic-touchscreen', function (err, hitTestSource) {
     *     if (err) return;
     *     hitTestSource.on('result', function (position, rotation, inputSource) {
     *         // position and rotation of hit test result
     *         // that will be created from touch on mobile devices
     *     });
     * });
     */
    XrHitTest.prototype.startForInputSource = function (profile, entityTypes, offsetRay, callback) {
        var self = this;

        if (! profile) {
            var err = new Error('missing profile');
            if (callback) callback(err);
            this.fire('error', err);
            return;
        } else if (typeof(entityTypes) === 'function') {
            callback = entityTypes;
            entityTypes = undefined;
        } else if (typeof(offsetRay) === 'function') {
            callback = offsetRay;
            offsetRay = undefined;
        }

        if (! this.isAvailable(callback, this))
            return;

        var xrRay;
        if (offsetRay) xrRay = new XRRay(new DOMPoint(offsetRay.origin.x, offsetRay.origin.y, offsetRay.origin.z), new DOMPoint(offsetRay.direction.x, offsetRay.direction.y, offsetRay.direction.z));

        self._session.requestHitTestSourceForTransientInput({
            profile: profile,
            entityTypes: entityTypes || undefined,
            offsetRay: xrRay
        }).then(function (xrHitTestSource) {
            if (! self._session) {
                xrHitTestSource.cancel();
                var err = new Error('XR Session is not started (3)');
                if (callback) callback(err);
                self.fire('error', err);
                return;
            }

            var hitTestSource = new pc.XrHitTestSource(self.manager, xrHitTestSource, true);
            self.hitTestSources.push(hitTestSource);

            if (callback) callback(null, hitTestSource);
            self.fire('add', hitTestSource);
        }).catch(function (ex) {
            if (callback) callback(ex);
            self.fire('error', ex);
        });
    };


    XrHitTest.prototype.update = function (frame) {
        for (var i = 0; i < this.hitTestSources.length; i++) {
            this.hitTestSources[i].update(frame);
        }
    };


    Object.defineProperty(XrHitTest.prototype, 'supported', {
        get: function () {
            return this._supported;
        }
    });


    var obj = {
        XrHitTest: XrHitTest
    };
    Object.assign(obj, hitTestTrackableTypes);


    return obj;
}());
