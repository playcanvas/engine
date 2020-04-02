Object.assign(pc, function () {
    var quat = new pc.Quat();


    var targetRayModes = {
        /**
         * @constant
         * @type string
         * @name pc.XRTARGETRAY_GAZE
         * @description Gaze - indicates the target ray will originate at the viewer and follow the direction it is facing. (This is commonly referred to as a "gaze input" device in the context of head-mounted displays.)
         */
        XRTARGETRAY_GAZE: 'gaze',

        /**
         * @constant
         * @type string
         * @name pc.XRTARGETRAY_SCREEN
         * @description Screen - indicates that the input source was an interaction with the canvas element associated with an inline session’s output context, such as a mouse click or touch event.
         */
        XRTARGETRAY_SCREEN: 'screen',

        /**
         * @constant
         * @type string
         * @name pc.XRTARGETRAY_POINTER
         * @description Tracked Pointer - indicates that the target ray originates from either a handheld device or other hand-tracking mechanism and represents that the user is using their hands or the held device for pointing.
         */
        XRTARGETRAY_POINTER: 'tracked-pointer'
    };

    var handednessTypes = {
        /**
         * @constant
         * @type string
         * @name pc.XRHAND_NONE
         * @description None - input source is not meant to be held in hands.
         */
        XRHAND_NONE: 'none',

        /**
         * @constant
         * @type string
         * @name pc.XRHAND_LEFT
         * @description Left - indicates that input source is meant to be held in left hand.
         */
        XRHAND_LEFT: 'left',

        /**
         * @constant
         * @type string
         * @name pc.XRHAND_RIGHT
         * @description Right - indicates that input source is meant to be held in right hand.
         */
        XRHAND_RIGHT: 'right'
    };

    /**
     * @class
     * @name pc.XrInputSource
     * @augments pc.EventHandler
     * @classdesc Represents XR input source, which is any input mechanism which allows the user to perform targeted actions in the same virtual space as the viewer. Example XR input sources include, but are not limited to, handheld controllers, optically tracked hands, and gaze-based input methods that operate on the viewer's pose.
     * @description Represents XR input source, which is any input mechanism which allows the user to perform targeted actions in the same virtual space as the viewer. Example XR input sources include, but are not limited to, handheld controllers, optically tracked hands, and gaze-based input methods that operate on the viewer's pose.
     * @param {pc.XrManager} manager - WebXR Manager.
     * @param {object} xrInputSource - XRInputSource object that is created by WebXR API.
     * @property {object} inputSource XRInputSource object that is associated with this input source.
     * @property {string} targetRayMode Type of ray Input Device is based on. Can be one of the following:
     *
     * * {@link pc.XRTARGETRAY_GAZE}: Gaze - indicates the target ray will originate at the viewer and follow the direction it is facing. (This is commonly referred to as a "gaze input" device in the context of head-mounted displays.)
     * * {@link pc.XRTARGETRAY_SCREEN}: Screen - indicates that the input source was an interaction with the canvas element associated with an inline session’s output context, such as a mouse click or touch event.
     * * {@link pc.XRTARGETRAY_POINTER}: Tracked Pointer - indicates that the target ray originates from either a handheld device or other hand-tracking mechanism and represents that the user is using their hands or the held device for pointing.
     *
     * @property {string} handedness Describes which hand input source is associated with. Can be one of the following:
     *
     * * {@link pc.XRHAND_NONE}: None - input source is not meant to be held in hands.
     * * {@link pc.XRHAND_LEFT}: Left - indicates that input source is meant to be held in left hand.
     * * {@link pc.XRHAND_RIGHT}: Right - indicates that input source is meant to be held in right hand.
     *
     * @property {string[]} profiles List of input profile names indicating both the prefered visual representation and behavior of the input source.
     * @property {pc.Ray} ray Ray that is calculated based on {@link pc.XrInputSource#targetRayMode} that can be used for interacting with virtual objects. Its origin and direction are in local space of XR session.
     * @property {boolean} grip If input source can be held, then it will have node with its world transformation, that can be used to position and rotate virtual joystics based on it.
     * @property {pc.Vec3|null} position If {@link pc.XrInputSource#grip} is true, then position will represent position of handheld input source in local space of XR session.
     * @property {pc.Quat|null} rotation If {@link pc.XrInputSource#grip} is true, then rotation will represent rotation of handheld input source in local space of XR session.
     * @property {Gamepad|null} gamepad If input source has buttons, triggers, thumbstick or touchpad, then this object provides access to its states.
     * @property {boolean} selecting True if input source is in active primary action between selectstart and selectend events.
     * @property {pc.XrHitTestSource[]} hitTestSources list of active {@link pc.XrHitTestSource} created by this input source.
     */
    var XrInputSource = function (manager, xrInputSource) {
        pc.EventHandler.call(this);

        this._manager = manager;
        this._xrInputSource = xrInputSource;

        this._ray = new pc.Ray();
        this._grip = false;
        this._position = null;
        this._rotation = null;
        this._selecting = false;

        this._hitTestSources = [];
    };
    XrInputSource.prototype = Object.create(pc.EventHandler.prototype);
    XrInputSource.prototype.constructor = XrInputSource;

    /**
     * @event
     * @name pc.XrInputSource#remove
     * @description Fired when {@link pc.XrInputSource} is removed.
     * @example
     * inputSource.once('remove', function () {
     *     // input source is not available anymore
     * });
     */

    /**
     * @event
     * @name pc.XrInputSource#select
     * @description Fired when input source has triggered primary action. This could be pressing a trigger button, or touching a screen.
     * @param {object} evt - XRInputSourceEvent event data from WebXR API
     * @example
     * app.xr.input.on('select', function (evt) {
     *     if (obj.intersectsRay(inputSource.ray)) {
     *         // selected an object with input source
     *     }
     * });
     */

    /**
     * @event
     * @name pc.XrInputSource#selectstart
     * @description Fired when input source has started to trigger primary action.
     * @param {object} evt - XRInputSourceEvent event data from WebXR API
     */

    /**
     * @event
     * @name pc.XrInputSource#selectend
     * @description Fired when input source has ended triggerring primary action.
     * @param {object} evt - XRInputSourceEvent event data from WebXR API
     */

    /**
     * @event
     * @name pc.XrInputSource#hittest:add
     * @description Fired when new {@link pc.XrHitTestSource} is added to the input source.
     * @param {pc.XrHitTestSource} hitTestSource - Hit test source that has been added
     * @example
     * inputSource.on('hittest:add', function (hitTestSource) {
     *     // new hit test source is added
     * });
     */

    /**
     * @event
     * @name pc.XrInputSource#hittest:remove
     * @description Fired when {@link pc.XrHitTestSource} is removed to the the input source.
     * @param {pc.XrHitTestSource} hitTestSource - Hit test source that has been removed
     * @example
     * inputSource.on('remove', function (hitTestSource) {
     *     // hit test source is removed
     * });
     */

    /**
     * @event
     * @name pc.XrInputSource#hittest:result
     * @description Fired when hit test source receives new results. It provides transform information that tries to match real world picked geometry.
     * @param {pc.XrHitTestSource} hitTestSource - Hit test source that produced the hit result
     * @param {pc.Vec3} position - Position of hit test
     * @param {pc.Quat} rotation - Rotation of hit test
     * @example
     * inputSource.on('hittest:result', function (hitTestSource, position, rotation) {
     *     target.setPosition(position);
     *     target.setRotation(rotation);
     * });
     */

    XrInputSource.prototype.update = function (frame) {
        var targetRayPose = frame.getPose(this._xrInputSource.targetRaySpace, this._manager._referenceSpace);
        if (! targetRayPose) return;

        // ray
        this._ray.origin.copy(targetRayPose.transform.position);

        this._ray.direction.set(0, 0, -1);
        quat.copy(targetRayPose.transform.orientation);
        quat.transformVector(this._ray.direction, this._ray.direction);

        // grip
        if (this._xrInputSource.gripSpace) {
            var gripPose = frame.getPose(this._xrInputSource.gripSpace, this._manager._referenceSpace);
            if (gripPose) {
                if (! this._grip) {
                    this._grip = true;
                    this._position = new pc.Vec3();
                    this._rotation = new pc.Quat();
                }
                this._position.copy(gripPose.transform.position);
                this._rotation.copy(gripPose.transform.orientation);
            }
        }
    };

    /**
     * @function
     * @name pc.XrInputSource#hitTestStart
     * @description Attempts to start hit test source based on this input source.
     * @param {object} [options] - Object for passing optional arguments.
     * @param {string[]} [options.entityTypes] - Optional list of underlying entity types
     * against which hit tests will be performed. Defaults to [ {pc.XRTRACKABLE_PLANE} ].
     * Can be any combination of the following:
     *
     * * {@link pc.XRTRACKABLE_POINT}: Point - indicates that the hit test results will be
     * computed based on the feature points detected by the underlying Augmented Reality system.
     * * {@link pc.XRTRACKABLE_PLANE}: Plane - indicates that the hit test results will be
     * computed based on the planes detected by the underlying Augmented Reality system.
     * * {@link pc.XRTRACKABLE_MESH}: Mesh - indicates that the hit test results will be
     * computed based on the meshes detected by the underlying Augmented Reality system.
     *
     * @param {pc.Ray} [options.offsetRay] - Optional ray by which hit test ray can be offset.
     * @param {pc.callbacks.XrHitTestStart} [options.callback] - Optional callback function
     * called once hit test source is created or failed.
     * @example
     * app.xr.input.on('add', function (inputSource) {
     *     inputSource.hitTestStart({
     *         callback: function (err, hitTestSource) {
     *             if (err) return;
     *             hitTestSource.on('result', function (position, rotation) {
     *                 // position and rotation of hit test result
     *                 // that will be created from touch on mobile devices
     *             });
     *         }
     *     });
     * });
     */
    XrInputSource.prototype.hitTestStart = function (options) {
        var self = this;

        options = options || { };
        options.profile = this._xrInputSource.profiles[0];

        var callback = options.callback;
        options.callback = function (err, hitTestSource) {
            if (hitTestSource) self.onHitTestSourceAdd(hitTestSource);
            if (callback) callback(err, hitTestSource);
        };

        this._manager.hitTest.start(options);
    };

    XrInputSource.prototype.onHitTestSourceAdd = function (hitTestSource) {
        this._hitTestSources.push(hitTestSource);

        this.fire('hittest:add', hitTestSource);

        hitTestSource.on('result', function (position, rotation, inputSource) {
            if (inputSource !== this)
                return;

            this.fire('hittest:result', hitTestSource, position, rotation);
        }, this);
        hitTestSource.once('remove', function () {
            this.onHitTestSourceRemove(hitTestSource);
            this.fire('hittest:remove', hitTestSource);
        }, this);
    };

    XrInputSource.prototype.onHitTestSourceRemove = function (hitTestSource) {
        var ind = this._hitTestSources.indexOf(hitTestSource);
        if (ind !== -1) this._hitTestSources.splice(ind, 1);
    };

    Object.defineProperty(XrInputSource.prototype, 'inputSource', {
        get: function () {
            return this._xrInputSource;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'targetRayMode', {
        get: function () {
            return this._xrInputSource.targetRayMode;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'handedness', {
        get: function () {
            return this._xrInputSource.handedness;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'profiles', {
        get: function () {
            return this._xrInputSource.profiles;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'ray', {
        get: function () {
            return this._ray;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'grip', {
        get: function () {
            return this._grip;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'position', {
        get: function () {
            return this._position;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'rotation', {
        get: function () {
            return this._rotation;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'gamepad', {
        get: function () {
            return this._xrInputSource.gamepad || null;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'selecting', {
        get: function () {
            return this._selecting;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'hitTestSources', {
        get: function () {
            return this._hitTestSources;
        }
    });


    var obj = {
        XrInputSource: XrInputSource
    };
    Object.assign(obj, targetRayModes);
    Object.assign(obj, handednessTypes);
    return obj;
}());
