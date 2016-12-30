var OrbitCamera = pc.createScript('orbitCamera');

OrbitCamera.attributes.add('distanceMax', {type: 'number', default: 0, title: 'Distance Max', description: 'Setting this at 0 will give an infinite distance limit'});
OrbitCamera.attributes.add('distanceMin', {type: 'number', default: 0, title: 'Distance Min'});
OrbitCamera.attributes.add('pitchAngleMax', {type: 'number', default: 90, title: 'Pitch Angle Max (degrees)'});
OrbitCamera.attributes.add('pitchAngleMin', {type: 'number', default: -90, title: 'Pitch Angle Min (degrees)'});

OrbitCamera.attributes.add('focusEntity', {
    type: 'entity', 
    title: 'Focus Entity', 
    description: 'Entity for the camera to focus on. If blank, then the camera will use the whole scene'
});

OrbitCamera.attributes.add('frameOnStart', {
    type: 'boolean', 
    default: true, 
    title: 'Frame on Start',
    description: 'Frames the entity or scene at the start of the application."'
});


// Property to get and set the distance between the pivot point and camera
// Clamped between this.distanceMin and this.distanceMax
Object.defineProperty(OrbitCamera.prototype, "distance", {
    get: function() {
        return this._distance;
    },

    set: function(value) {
        this._distance = this._clampDistance(value);
    }
});


// Property to get and set the pitch of the camera around the pivot point (degrees)
// Clamped between this.pitchAngleMin and this.pitchAngleMax
// When set at 0, the camera angle is flat, looking along the horizon
Object.defineProperty(OrbitCamera.prototype, "pitch", {
    get: function() {
        return this._pitch;
    },

    set: function(value) {
        this._pitch = this._clampPitchAngle(value);
    }
});


// Property to get and set the yaw of the camera around the pivot point (degrees)
Object.defineProperty(OrbitCamera.prototype, "yaw", {
    get: function() {
        return this._yaw;
    },

    set: function(value) {
        this._yaw = value;
    }
});


// Property to get and set the world position of the pivot point that the camera orbits around
Object.defineProperty(OrbitCamera.prototype, "pivotPoint", {
    get: function() {
        return this._pivotPoint;
    },

    set: function(value) {
        this._pivotPoint.copy(value);
    }
});


// Moves the camera to look at an entity and all its children so they are all in the view
OrbitCamera.prototype.focus = function (focusEntity) {    
    // Calculate an bounding box that encompasses all the models to frame in the camera view
    this._buildAabb(focusEntity, 0);
    
    var halfExtents = this._modelsAabb.halfExtents;

    var distance = Math.max(halfExtents.x, Math.max(halfExtents.y, halfExtents.z));
    distance = (distance / Math.tan(0.5 * this.entity.camera.fov * pc.math.DEG_TO_RAD));        
    distance = (distance * 2);

    this.distance = distance;
    this._pivotPoint.copy(this._modelsAabb.center);
};


OrbitCamera.distanceBetween = new pc.Vec3();

// Set the camera position to a world position and look at a world position
// Useful if you have multiple viewing angles to swap between in a scene
OrbitCamera.prototype.resetAndLookAtPoint = function (resetPoint, lookAtPoint) {    
    this.pivotPoint.copy(lookAtPoint);
    this.entity.setPosition(resetPoint);

    this.entity.lookAt(lookAtPoint);

    var distance = OrbitCamera.distanceBetween;
    distance.sub2(lookAtPoint, resetPoint);
    this.distance = distance.length();

    this.pivotPoint.copy(lookAtPoint);

    var cameraQuat = this.entity.getRotation();
    this.yaw = this._calcYaw(cameraQuat);
    this.pitch = this._calcPitch(cameraQuat, this.yaw);

    this._updatePosition();
};


// Set camera position to a world position and look at an entity in the scene
// Useful if you have multiple models to swap between in a scene
OrbitCamera.prototype.resetAndLookAtEntity = function (resetPoint, entity) {
    this._buildAabb(entity, 0);
    this.resetAndLookAtPoint(resetPoint, this._modelsAabb.center);
};

/////////////////////////////////////////////////////////////////////////////////////////////
// Private methods

OrbitCamera.prototype.initialize = function () {
    var self = this;
    var onWindowResize = function () {
        self._checkAspectRatio();
    };

    window.addEventListener('resize', onWindowResize, false);

    this._checkAspectRatio();

    // Find all the models in the scene that are under the focused entity
    this._modelsAabb = new pc.BoundingBox();
    this._buildAabb(this.focusEntity || this.app.root, 0);

    this.entity.lookAt(this._modelsAabb.center);

    this._pivotPoint = new pc.Vec3(); 
    this._pivotPoint.copy(this._modelsAabb.center);

    // Calculate the camera euler angle rotation around x and y axes
    // This allows us to place the camera at a particular rotation to begin with in the scene
    var cameraQuat = this.entity.getRotation();

    // Preset the camera
    this._yaw = this._calcYaw(cameraQuat);
    this._pitch = this._clampPitchAngle(this._calcPitch(cameraQuat, this._yaw));
    this.entity.setLocalEulerAngles(this._pitch, this._yaw, 0);

    this._distance = 0;

    // If we have ticked focus on start, then attempt to position the camera where it frames
    // the focused entity and move the pivot point to entity's position otherwise, set the distance
    // to be between the camera position in the scene and the pivot point
    if (this.frameOnStart) {
        this.focus(this.focusEntity || this.app.root);
    } else {
        var distanceBetween = new pc.Vec3();
        distanceBetween.sub2(this.entity.getPosition(), this._pivotPoint);
        this.distance = distanceBetween.length();
    }

    // Reapply the clamps if they are changed in the editor
    this.on('attr:distanceMin', function (value, prev) {
        this._distance = this._clampDistance(this._distance);
    });

    this.on('attr:distanceMax', function (value, prev) {
        this._distance = this._clampDistance(this._distance);
    });

    this.on('attr:pitchAngleMin', function (value, prev) {
        this._pitch = this._clampPitchAngle(this._pitch);
    });

    this.on('attr:pitchAngleMax', function (value, prev) {
        this._pitch = this._clampPitchAngle(this._pitch);
    });

    // Focus on the entity if we change the focus entity
    this.on('attr:focusEntity', function (value, prev) {
        if (this.frameOnStart) {
            this.focus(value || this.app.root);
        } else {
            this.resetAndLookAtEntity(this.entity.getPosition(), value || this.app.root);
        }
    });

    this.on('attr:frameOnStart', function (value, prev) {
        if (value) {
            this.focus(this.focusEntity || this.app.root); 
        }
    });

    this.on('destroy', function() {
        window.removeEventListener('resize', onWindowResize, false);
    });
};


OrbitCamera.prototype.update = function(dt) {
    this._updatePosition();
};


OrbitCamera.prototype._updatePosition = function () {
    // Work out the camera position based on the pivot point, pitch, yaw and distance
    this.entity.setLocalPosition(0,0,0);
    this.entity.setLocalEulerAngles(this.pitch, this.yaw, 0);

    var position = this.entity.getPosition();
    position.copy(this.entity.forward);
    position.scale(-this.distance);
    position.add(this.pivotPoint);
    this.entity.setPosition(position);
};


OrbitCamera.prototype._checkAspectRatio = function () {
    var height = this.app.graphicsDevice.height;
    var width = this.app.graphicsDevice.width;

    // Match the axis of FOV to match the aspect ratio of the canvas so
    // the focused entities is always in frame 
    this.entity.camera.horizontalFov = height > width;
};


OrbitCamera.prototype._buildAabb = function (entity, modelsAdded) {
    var i = 0;

    if (entity.model) {
        var mi = entity.model.meshInstances;
        for (i = 0; i < mi.length; i++) {
            if (modelsAdded === 0) {
                this._modelsAabb.copy(mi[i].aabb);
            } else {
                this._modelsAabb.add(mi[i].aabb);
            }

            modelsAdded += 1;
        }
    }

    for (i = 0; i < entity.children.length; ++i) {
        modelsAdded += this._buildAabb(entity.children[i], modelsAdded);
    }

    return modelsAdded;
};


OrbitCamera.prototype._calcYaw = function (quat) {
    var transformedForward = new pc.Vec3();
    quat.transformVector(pc.Vec3.FORWARD, transformedForward);

    return Math.atan2(-transformedForward.x, -transformedForward.z) * pc.math.RAD_TO_DEG;    
};


OrbitCamera.prototype._clampDistance = function (distance) {
    if (this.distanceMax > 0) {
        return pc.math.clamp(distance, this.distanceMin, this.distanceMax);     
    } else {
        return Math.max(distance, this.distanceMin);
    }
};


OrbitCamera.prototype._clampPitchAngle = function (pitch) {
    // Negative due as the pitch is inversed since the camera is orbiting the entity
    return pc.math.clamp(pitch, -this.pitchAngleMax, -this.pitchAngleMin);
};


OrbitCamera.quatWithoutYaw = new pc.Quat();
OrbitCamera.yawOffset = new pc.Quat();

OrbitCamera.prototype._calcPitch = function(quat, yaw) {
    var quatWithoutYaw = OrbitCamera.quatWithoutYaw;
    var yawOffset = OrbitCamera.yawOffset;

    yawOffset.setFromEulerAngles(0, -yaw, 0);
    quatWithoutYaw.mul2(yawOffset, quat);

    var transformedForward = new pc.Vec3();

    quatWithoutYaw.transformVector(pc.Vec3.FORWARD, transformedForward);

    return Math.atan2(transformedForward.y, -transformedForward.z) * pc.math.RAD_TO_DEG;
};