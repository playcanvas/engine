Object.assign(pc, function () {
    var inputSourceId = 0;
    var quatA = new pc.Quat();

    var XrInputSource = function(manager, inputSource) {
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

    XrInputSource.prototype.update = function(frame) {
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
                };

                this._grip.position.copy(gripPose.transform.position);
                this._grip.rotation.copy(gripPose.transform.orientation);
            }
        }
    };

    Object.defineProperty(XrInputSource.prototype, 'inputSource', {
        get: function() {
            return this._inputSource;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'targetRayMode', {
        get: function() {
            return this._inputSource.targetRayMode;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'handedness', {
        get: function() {
            return this._inputSource.handedness;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'profiles', {
        get: function() {
            return this._inputSource.profiles;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'ray', {
        get: function() {
            return this._ray;
        }
    });

    Object.defineProperty(XrInputSource.prototype, 'grip', {
        get: function() {
            return this._grip;
        }
    });

    return {
        XrInputSource: XrInputSource
    };
}());
