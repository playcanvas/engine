////////////////////////////////////////////////////////////////////////////////
//                             Orbit Camera Script                            //
////////////////////////////////////////////////////////////////////////////////

const attributes = {

    distanceMax: { type: 'number', default: 0, title: 'Distance Max', description: 'Setting this at 0 will give an infinite distance limit' },
    distanceMin: { type: 'number', default: 0, title: 'Distance Min' },
    pitchAngleMax: { type: 'number', default: 90, title: 'Pitch Angle Max (degrees)' },
    pitchAngleMin: { type: 'number', default: -90, title: 'Pitch Angle Min (degrees)' },

    inertiaFactor: {
        type: 'number',
        default: 0,
        title: 'Inertia Factor',
        description: 'Higher value means that the camera will continue moving after the user has stopped dragging. 0 is fully responsive.'
    },
    focusEntity: {
        type: 'entity',
        title: 'Focus Entity',
        description: 'Entity for the camera to focus on. If blank, then the camera will use the whole scene'
    },
    frameOnStart: {
        type: 'boolean',
        default: true,
        title: 'Frame on Start',
        description: 'Frames the entity or scene at the start of the application."'
    }
};

export default class OrbitCamera {
    static attributes = attributes;

    /**
     * @type {pc.Entity} entity - The entity that has the camera component
     */
    entity;

    /**
     * @type {pc.AppBase} app - The app that the entity this script is attached to belongs to
     */
    app;

    // Reapply the clamps if they are changed in the editor
    set distanceMin(value) {
        this._distanceMin = value;
        this._distance = this._clampDistance(this._distance);
    }

    get distanceMin() {
        return this._distanceMin;
    }

    set distanceMax(value) {
        this._distanceMax = value;
        this._distance = this._clampDistance(this._distance);
    }

    get distanceMax() {
        return this._distanceMax;
    }

    set pitchAngleMin(value) {
        this._pitchAngleMin = value;
        this._pitch = this._clampPitchAngle(this._pitch);
    }

    get pitchAngleMin() {
        return this._pitchAngleMin;
    }

    set pitchAngleMax(value) {
        this._pitchAngleMax = value;
        this._pitch = this._clampPitchAngle(this._pitch);
    }

    get pitchAngleMax() {
        return this._pitchAngleMax;
    }

    set frameOnStart(value) {
        this._frameOnStart = value;
        if (value && this.app) {
            this.focus(this.focusEntity || this.app.root);
        }
    }

    get frameOnStart() {
        return this._frameOnStart;
    }

    set focusEntity(value) {
        this._focusEntity = value;
        if (this.frameOnStart) {
            this.focus(value || this.app.root);
        } else {
            this.resetAndLookAtEntity(this.entity.getPosition(), value || this.app.root);
        }
    }

    get focusEntity() {
        return this._focusEntity;
    }

    static distanceBetween = new pc.Vec3();

    // Property to get and set the distance between the pivot point and camera
    // Clamped between this.distanceMin and this.distanceMax
    set distance(value) {
        this._targetDistance = this._clampDistance(value);
    }

    get distance() {
        return this._targetDistance;
    }

    // Property to get and set the pitch of the camera around the pivot point (degrees)
    // Clamped between this.pitchAngleMin and this.pitchAngleMax
    // When set at 0, the camera angle is flat, looking along the horizon
    set pitch(value) {
        this._targetPitch = this._clampPitchAngle(value);
    }

    get pitch() {
        return this._targetPitch;
    }

    // Property to get and set the yaw of the camera around the pivot point (degrees)
    set yaw(value) {
        this._targetYaw = value;
        this._targetYaw = value;
        // Ensure that the yaw takes the shortest route by making sure that
        // the difference between the targetYaw and the actual is 180 degrees
        // in either direction
        const diff = this._targetYaw - this._yaw;
        const reminder = diff % 360;
        if (reminder > 180) {
            this._targetYaw = this._yaw - (360 - reminder);
        } else if (reminder < -180) {
            this._targetYaw = this._yaw + (360 + reminder);
        } else {
            this._targetYaw = this._yaw + reminder;
        }
    }

    get yaw() {
        return this._targetYaw;
    }

    // Property to get and set the world position of the pivot point that the camera orbits around
    set pivotPoint(value) {
        this._pivotPoint.copy(value);
    }

    get pivotPoint() {
        return this._pivotPoint;
    }

    // Moves the camera to look at an entity and all its children so they are all in the view
    focus(focusEntity) {
        // Calculate an bounding box that encompasses all the models to frame in the camera view
        this._buildAabb(focusEntity);

        var halfExtents = this._modelsAabb.halfExtents;
        var radius = Math.max(halfExtents.x, Math.max(halfExtents.y, halfExtents.z));

        this.distance = (radius * 1.5) / Math.sin(0.5 * this.entity.camera.fov * pc.math.DEG_TO_RAD);

        this._removeInertia();

        this._pivotPoint.copy(this._modelsAabb.center);
    }

    // Set the camera position to a world position and look at a world position
    // Useful if you have multiple viewing angles to swap between in a scene
    resetAndLookAtPoint(resetPoint, lookAtPoint) {
        this.pivotPoint.copy(lookAtPoint);
        this.entity.setPosition(resetPoint);

        this.entity.lookAt(lookAtPoint);

        const distance = OrbitCamera.distanceBetween;
        distance.sub2(lookAtPoint, resetPoint);
        this.distance = distance.length();

        this.pivotPoint.copy(lookAtPoint);

        const cameraQuat = this.entity.getRotation();
        this.yaw = this._calcYaw(cameraQuat);
        this.pitch = this._calcPitch(cameraQuat, this.yaw);

        this._removeInertia();
        this._updatePosition();
    }

    // Set camera position to a world position and look at an entity in the scene
    // Useful if you have multiple models to swap between in a scene
    resetAndLookAtEntity(resetPoint, entity) {
        this._buildAabb(entity);
        this.resetAndLookAtPoint(resetPoint, this._modelsAabb.center);
    }

    // Set the camera at a specific, yaw, pitch and distance without inertia (instant cut)
    reset(yaw, pitch, distance) {
        this.pitch = pitch;
        this.yaw = yaw;
        this.distance = distance;

        this._removeInertia();
    }

    /////////////////////////////////////////////////////////////////////////////////////////////
    // Private methods
    /////////////////////////////////////////////////////////////////////////////////////////////

    initialize() {

        this.checkAspectRatioBound = _ => this._checkAspectRatio();

        window.addEventListener('resize', this.checkAspectRatioBound, false);

        this._checkAspectRatio();

        // Find all the models in the scene that are under the focused entity
        this._modelsAabb = new pc.BoundingBox();
        this._buildAabb(this.focusEntity || this.app.root);

        this.entity.lookAt(this._modelsAabb.center);

        this._pivotPoint = new pc.Vec3();
        this._pivotPoint.copy(this._modelsAabb.center);

        // Calculate the camera euler angle rotation around x and y axes
        // This allows us to place the camera at a particular rotation to begin with in the scene
        const cameraQuat = this.entity.getRotation();

        // Preset the camera
        this._yaw = this._calcYaw(cameraQuat);
        this._pitch = this._clampPitchAngle(this._calcPitch(cameraQuat, this._yaw));
        this.entity.setLocalEulerAngles(this._pitch, this._yaw, 0);

        this._distance = 0;

        this._targetYaw = this._yaw;
        this._targetPitch = this._pitch;

        // If we have ticked focus on start, then attempt to position the camera where it frames
        // the focused entity and move the pivot point to entity's position otherwise, set the distance
        // to be between the camera position in the scene and the pivot point
        if (this.frameOnStart) {
            this.focus(this.focusEntity || this.app.root);
        } else {
            const distanceBetween = new pc.Vec3();
            distanceBetween.sub2(this.entity.getPosition(), this._pivotPoint);
            this._distance = this._clampDistance(distanceBetween.length());
        }

        this._targetDistance = this._distance;

    }

    destroy() {
        window.removeEventListener('resize', this.checkAspectRatioBound, false);
    }

    update(dt) {
        // Add inertia, if any
        var t = this.inertiaFactor === 0 ? 1 : Math.min(dt / this.inertiaFactor, 1);
        this._distance = pc.math.lerp(this._distance, this._targetDistance, t);
        this._yaw = pc.math.lerp(this._yaw, this._targetYaw, t);
        this._pitch = pc.math.lerp(this._pitch, this._targetPitch, t);

        this._updatePosition();
    }


    _updatePosition() {
        // Work out the camera position based on the pivot point, pitch, yaw and distance
        this.entity.setLocalPosition(0, 0, 0);
        this.entity.setLocalEulerAngles(this._pitch, this._yaw, 0);

        const position = this.entity.getPosition();
        position.copy(this.entity.forward);
        position.mulScalar(-this._distance);
        position.add(this.pivotPoint);
        this.entity.setPosition(position);
    }

    _removeInertia() {
        this._yaw = this._targetYaw;
        this._pitch = this._targetPitch;
        this._distance = this._targetDistance;
    }

    _checkAspectRatio() {
        var height = this.app.graphicsDevice.height;
        var width = this.app.graphicsDevice.width;

        // Match the axis of FOV to match the aspect ratio of the canvas so
        // the focused entities is always in frame
        this.entity.camera.horizontalFov = height > width;
    }

    _buildAabb(entity) {
        var i, m, meshInstances = [];

        var renders = entity.findComponents("render");
        for (i = 0; i < renders.length; i++) {
            var render = renders[i];
            for (m = 0; m < render.meshInstances.length; m++) {
                meshInstances.push(render.meshInstances[m]);
            }
        }

        var models = entity.findComponents("model");
        for (i = 0; i < models.length; i++) {
            var model = models[i];
            for (m = 0; m < model.meshInstances.length; m++) {
                meshInstances.push(model.meshInstances[m]);
            }
        }

        for (i = 0; i < meshInstances.length; i++) {
            if (i === 0) {
                this._modelsAabb.copy(meshInstances[i].aabb);
            } else {
                this._modelsAabb.add(meshInstances[i].aabb);
            }
        }
    }

    _calcYaw(quat) {
        const transformedForward = new pc.Vec3();
        quat.transformVector(pc.Vec3.FORWARD, transformedForward);

        return Math.atan2(-transformedForward.x, -transformedForward.z) * pc.math.RAD_TO_DEG;
    }

    _clampDistance(distance) {
        if (this.distanceMax > 0) {
            return pc.math.clamp(distance, this.distanceMin, this.distanceMax);
        }
        return Math.max(distance, this.distanceMin);

    }


    _clampPitchAngle(pitch) {
        // Negative due as the pitch is inversed since the camera is orbiting the entity
        return pc.math.clamp(pitch, -this.pitchAngleMax, -this.pitchAngleMin);
    }


    static quatWithoutYaw = new pc.Quat();

    static yawOffset = new pc.Quat();

    _calcPitch(quat, yaw) {
        var quatWithoutYaw = OrbitCamera.quatWithoutYaw;
        var yawOffset = OrbitCamera.yawOffset;

        yawOffset.setFromEulerAngles(0, -yaw, 0);
        quatWithoutYaw.mul2(yawOffset, quat);

        const transformedForward = new pc.Vec3();

        quatWithoutYaw.transformVector(pc.Vec3.FORWARD, transformedForward);

        return Math.atan2(transformedForward.y, -transformedForward.z) * pc.math.RAD_TO_DEG;
    }
}
