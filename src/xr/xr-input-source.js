Object.assign(pc, function () {
    var inputSourceId = 0;
    var quatA = new pc.Quat();


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
         * @description None - inputSource is not meant to be held in hands.
         */
        XRHAND_NONE: 'none',

        /**
         * @constant
         * @type string
         * @name pc.XRHAND_LEFT
         * @description Left - indicates that InputSource is meant to be held in left hand.
         */
        XRHAND_LEFT: 'left',

        /**
         * @constant
         * @type string
         * @name pc.XRHAND_RIGHT
         * @description Right - indicates that InputSource is meant to be held in right hand.
         */
        XRHAND_RIGHT: 'right'
    };


    var XrInputSource = function (manager, inputSource) {
        pc.EventHandler.call(this);

        this.id = ++inputSourceId;
        this.manager = manager;
        this._inputSource = inputSource;

        this._ray = new pc.Ray();
        this._grip = null;
    };
    XrInputSource.prototype = Object.create(pc.EventHandler.prototype);
    XrInputSource.prototype.constructor = XrInputSource;

    // EVENTS:
    // remove
    // select
    // selectstart
    // selectend

    XrInputSource.prototype.update = function (frame) {
        var targetRayPose = frame.getPose(this._inputSource.targetRaySpace, this.manager._referenceSpace);
        if (! targetRayPose) {
            console.log('no targetRayPose', i);
            return;
        }

        var camera = this.manager._camera;
        var parent = (camera.entity && camera.entity.parent) || null;
        var parentPosition = parent && parent.getPosition();

        // ray
        this._ray.origin.copy(targetRayPose.transform.position);
        // relative to XR camera parent
        if (parentPosition) this._ray.origin.add(parentPosition);

        this._ray.direction.set(0, 0, -1);
        quatA.copy(targetRayPose.transform.orientation);
        quatA.transformVector(this._ray.direction, this._ray.direction);

        // grip
        if (this._inputSource.gripSpace) {
            var gripPose = frame.getPose(this._inputSource.gripSpace, this.manager._referenceSpace);
            if (gripPose) {
                if (! this._grip) {
                    this._grip = {
                        position: new pc.Vec3(),
                        rotation: new pc.Quat()
                    };
                }

                this._grip.position.copy(gripPose.transform.position);
                this._grip.rotation.copy(gripPose.transform.orientation);
            }
        }
    };

    Object.defineProperty(XrInputSource.prototype, 'inputSource', {
        get: function () {
            return this._inputSource;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'targetRayMode', {
        get: function () {
            return this._inputSource.targetRayMode;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'handedness', {
        get: function () {
            return this._inputSource.handedness;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'profiles', {
        get: function () {
            return this._inputSource.profiles;
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

    Object.defineProperty(XrInputSource.prototype, 'gamepad', {
        get: function () {
            return this._inputSource.gamepad || null;
        }
    });


    var obj = {
        XrInputSource: XrInputSource
    };
    Object.assign(obj, targetRayModes);
    Object.assign(obj, handednessTypes);
    return obj;
}());
