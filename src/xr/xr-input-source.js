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
     * @classdesc Represents an XR input source, which is any input mechanism which allows the user to perform targeted actions in the same virtual space as the viewer. Example XR input sources include, but are not limited to, handheld controllers, optically tracked hands, and gaze-based input methods that operate on the viewer's pose.
     * @description Represents an XR input source, which is any input mechanism which allows the user to perform targeted actions in the same virtual space as the viewer. Example XR input sources include, but are not limited to, handheld controllers, optically tracked hands, and gaze-based input methods that operate on the viewer's pose.
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
     * @property {pc.Ray} ray Ray that is calculated based on {pc.XrInputSource#targetRayMode} that can be used for interacting with virtual objects.
     * @property {boolean} grip If input source can be held, then it will have node with its world transformation, that can be used to position and rotate virtual joystics based on it.
     * @property {pc.Vec3|null} position If {pc.XrInputSource#grip} is true, then position will represent world space position of handheld input source.
     * @property {pc.Quat|null} rotation If {pc.XrInputSource#grip} is true, then rotation will represent world space rotation of handheld input source.
     * @property {Gamepad|null} gamepad If input source has buttons, triggers, thumbstick or touchpad, then this object provides access to its states.
     * @property {boolean} selecting True if input source is in active primary action between selectstart and selectend events.
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
    };
    XrInputSource.prototype = Object.create(pc.EventHandler.prototype);
    XrInputSource.prototype.constructor = XrInputSource;

    /**
     * @event
     * @name pc.XrInputSource#remove
     * @description Fired when {pc.XrInputSource} is removed.
     * @example
     * inputSource.on('remove', function () {
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

    XrInputSource.prototype.update = function (frame) {
        var targetRayPose = frame.getPose(this._xrInputSource.targetRaySpace, this._manager._referenceSpace);
        if (! targetRayPose) return;

        var camera = this._manager._camera;
        var parent = (camera.entity && camera.entity.parent) || null;
        var parentPosition = parent && parent.getPosition();

        // ray
        this._ray.origin.copy(targetRayPose.transform.position);
        // relative to XR camera parent
        if (parentPosition) this._ray.origin.add(parentPosition);

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


    var obj = {
        XrInputSource: XrInputSource
    };
    Object.assign(obj, targetRayModes);
    Object.assign(obj, handednessTypes);
    return obj;
}());
