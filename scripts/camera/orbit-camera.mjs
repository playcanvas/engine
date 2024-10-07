import { 
    Script, Entity, math, Vec3, BoundingBox, Quat, Vec2, PROJECTION_PERSPECTIVE,
    MOUSEBUTTON_LEFT, MOUSEBUTTON_RIGHT, MOUSEBUTTON_MIDDLE, EVENT_TOUCHCANCEL,
    EVENT_TOUCHSTART, EVENT_TOUCHEND, EVENT_TOUCHMOVE, EVENT_MOUSEDOWN, EVENT_MOUSEMOVE, EVENT_MOUSEUP, EVENT_MOUSEWHEEL
} from 'playcanvas';

export class OrbitCamera extends Script {
    /**
     * @attribute
     * @title Distance Max
     * @resource 
     * @range
     * @type {number}
     */
    set distanceMax(v) {
        this._distanceMax = v;
        this._distance = this._clampDistance(this._distance);
    }

    get distanceMax() {
        return this._distanceMax;
    }

    /**
     * @attribute
     * @title Distance Min
     * @type {number}
     */
    set distanceMin(v) {
        this._distanceMin = v;
        this._distance = this._clampDistance(this._distance);
    }

    get distanceMin() {
        return this._distanceMin;
    }

    /**
     * @attribute
     * @title Pitch Angle Max (degrees)
     * @type {number}
     */
    set pitchAngleMax(v) {
        this._pitchAngleMax = v;
        this._pitch = this._clampPitchAngle(this._pitch);
    }

    get pitchAngleMax() {
        return this._pitchAngleMax;
    }

    /**
     * @attribute
     * @title Pitch Angle Min (degrees)
     * @type {number}
     */
    set pitchAngleMin(v) {
        this._pitchAngleMin = v;
        this._pitch = this._clampPitchAngle(this._pitchAngleMin);
    }

    get pitchAngleMin() {
        return this._pitchAngleMin;
    }

    /**
     * Higher value means that the camera will continue moving after the user has stopped dragging. 0 is fully responsive.
     *
     * @attribute
     * @title Inertia Factor
     * @type {number}
     */
    inertiaFactor = 0;

    /**
     * Entity for the camera to focus on. If blank, then the camera will use the whole scene
     *
     * @attribute
     * @title Focus Entity
     * @type {Entity}
     */
    set focusEntity(value) {
        this._focusEntity = value || this.app.root;
        if (this.frameOnStart) {
            this.focus(this._focusEntity);
        } else {
            this.resetAndLookAtEntity(
                this.entity.getPosition(),
                this._focusEntity
            );
        }
    }

    get focusEntity() {
        return this._focusEntity;
    }

    /**
     * Frames the entity or scene at the start of the application."
     *
     * @attribute
     * @title Frame on Start
     * @type {boolean}
     */
    set frameOnStart(value) {
        this._frameOnStart = value;
        if (this._frameOnStart) {
            this.focus(this.focusEntity || this.app.root);
        }
    }

    get frameOnStart() {
        return this._frameOnStart;
    }

    /**
     * Property to get and set the distance between the pivot point and camera.
     * Clamped between this.distanceMin and this.distanceMax
     *
     * @type {number}
     */
    set distance(value) {
        this._targetDistance = this._clampDistance(value);
    }

    get distance() {
        return this._targetDistance;
    }

    /**
     * Property to get and set the camera orthoHeight
     *
     * @type {number}
     */
    set orthoHeight(value) {
        this.entity.camera.orthoHeight = Math.max(0, value);
    }

    get orthoHeight() {
        return this.entity.camera.orthoHeight;
    }


    /**
     * Property to get and set the pitch of the camera around the pivot point (degrees).
     * Clamped between this.pitchAngleMin and this.pitchAngleMax.
     * When set at 0, the camera angle is flat, looking along the horizon
     *
     * @type {number}
     */
    set pitch(value) {
        this._targetPitch = this._clampPitchAngle(value);
    }

    get pitch() {
        return this._targetPitch;
    }


    /**
     * Property to get and set the yaw of the camera around the pivot point (degrees)
     *
     * @type {number}
     */
    set yaw(value) {
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

    /**
     * Property to get and set the world position of the pivot point that the camera orbits around
     *
     * @type {number}
     */
    set pivotPoint(value) {
        this._pivotPoint.copy(value);
    }

    get pivotPoint() {
        return this._pivotPoint;
    }


    /** @private */
    _distance = 0;

    /** @private */
    _distanceMin = 0;

    /** @private */
    _distanceMax = 0;

    /** @private */
    _frameOnStart = true;

    /** @private */
    _focusEntity;

    static fromWorldPoint = new Vec3();

    static toWorldPoint = new Vec3();

    static worldDiff = new Vec3();

    static distanceBetween = new Vec3();

    static quatWithoutYaw = new Quat();

    static yawOffset = new Quat();

    focus(focusEntity) {
        // Calculate an bounding box that encompasses all the models to frame in the camera view
        this._buildAabb(focusEntity);

        const halfExtents = this._modelsAabb.halfExtents;
        const radius = Math.max(halfExtents.x, halfExtents.y, halfExtents.z);

        this.distance =
            (radius * 1.5) /
            Math.sin(0.5 * this.entity.camera.fov * math.DEG_TO_RAD);

        this._removeInertia();

        this._pivotPoint.copy(this._modelsAabb.center);
    }

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

    resetAndLookAtEntity(resetPoint, entity) {
        this._buildAabb(entity);
        this.resetAndLookAtPoint(resetPoint, this._modelsAabb.center);
    }

    reset(yaw, pitch, distance) {
        this.pitch = pitch;
        this.yaw = yaw;
        this.distance = distance;

        this._removeInertia();
    }

    initialize() {
        const onWindowResize = () => this._checkAspectRatio();

        window.addEventListener('resize', onWindowResize, false);

        this._checkAspectRatio();

        // Find all the models in the scene that are under the focused entity
        this._modelsAabb = new BoundingBox();
        this._buildAabb(this.focusEntity || this.app.root);

        this.entity.lookAt(this._modelsAabb.center);

        this._pivotPoint = new Vec3();
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
            const distanceBetween = new Vec3();
            distanceBetween.sub2(this.entity.getPosition(), this._pivotPoint);
            this._distance = this._clampDistance(distanceBetween.length());
        }

        this._targetDistance = this._distance;

        this.on('destroy', () => {
            window.removeEventListener('resize', onWindowResize, false);
        });
    }

    update(dt) {
        // Add inertia, if any
        const t =
            this.inertiaFactor === 0 ? 1 : Math.min(dt / this.inertiaFactor, 1);
        this._distance = math.lerp(this._distance, this._targetDistance, t);
        this._yaw = math.lerp(this._yaw, this._targetYaw, t);
        this._pitch = math.lerp(this._pitch, this._targetPitch, t);

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
        const height = this.app.graphicsDevice.height;
        const width = this.app.graphicsDevice.width;

        // Match the axis of FOV to match the aspect ratio of the canvas so
        // the focused entities is always in frame
        this.entity.camera.horizontalFov = height > width;
    }

    _buildAabb(entity) {
        let i, m;
        const meshInstances = [];

        const renders = entity.findComponents('render');
        for (i = 0; i < renders.length; i++) {
            const render = renders[i];
            for (m = 0; m < render.meshInstances.length; m++) {
                meshInstances.push(render.meshInstances[m]);
            }
        }

        const models = entity.findComponents('model');
        for (i = 0; i < models.length; i++) {
            const model = models[i];
            for (m = 0; m < model.meshInstances.length; m++) {
                meshInstances.push(model.meshInstances[m]);
            }
        }

        const gsplats = entity.findComponents('gsplat');
        for (i = 0; i < gsplats.length; i++) {
            const gsplat = gsplats[i];
            const instance = gsplat.instance;
            if (instance?.meshInstance) {
                meshInstances.push(instance.meshInstance);
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
        const transformedForward = new Vec3();
        quat.transformVector(Vec3.FORWARD, transformedForward);

        return (
            Math.atan2(-transformedForward.x, -transformedForward.z) *
            math.RAD_TO_DEG
        );
    }

    _clampDistance(distance) {
        if (this.distanceMax > 0) {
            return math.clamp(distance, this.distanceMin, this.distanceMax);
        }
        return Math.max(distance, this.distanceMin);
    }

    _clampPitchAngle(pitch) {
        // Negative due as the pitch is inversed since the camera is orbiting the entity
        return math.clamp(pitch, -this.pitchAngleMax, -this.pitchAngleMin);
    }

    _calcPitch(quat, yaw) {
        const quatWithoutYaw = OrbitCamera.quatWithoutYaw;
        const yawOffset = OrbitCamera.yawOffset;

        yawOffset.setFromEulerAngles(0, -yaw, 0);
        quatWithoutYaw.mul2(yawOffset, quat);

        const transformedForward = new Vec3();

        quatWithoutYaw.transformVector(Vec3.FORWARD, transformedForward);

        return (
            Math.atan2(transformedForward.y, -transformedForward.z) *
            math.RAD_TO_DEG
        );
    }
}


export class OrbitCameraInputMouse extends Script {
    /**
     * How fast the camera moves around the orbit. Higher is faster
     *
     * @attribute
     * @type {number}
     */
    orbitSensitivity = 0.3;

    /**
     * How fast the camera moves in and out. Higher is faster
     *
     * @attribute
     * @type {number}
     */
    distanceSensitivity = 0.15;

    static fromWorldPoint = new Vec3();

    static toWorldPoint = new Vec3();

    static worldDiff = new Vec3();

    initialize() {
        this.orbitCamera = this.entity.script.orbitCamera;

        if (this.orbitCamera) {
            const onMouseOut = () => this.onMouseOut();

            this.app.mouse.on(EVENT_MOUSEDOWN, this.onMouseDown, this);
            this.app.mouse.on(EVENT_MOUSEUP, this.onMouseUp, this);
            this.app.mouse.on(EVENT_MOUSEMOVE, this.onMouseMove, this);
            this.app.mouse.on(EVENT_MOUSEWHEEL, this.onMouseWheel, this);

            // Listen to when the mouse travels out of the window
            window.addEventListener('mouseout', onMouseOut, false);

            // Remove the listeners so if this entity is destroyed
            this.on('destroy', function () {
                this.app.mouse.off(EVENT_MOUSEDOWN, this.onMouseDown, this);
                this.app.mouse.off(EVENT_MOUSEUP, this.onMouseUp, this);
                this.app.mouse.off(EVENT_MOUSEMOVE, this.onMouseMove, this);
                this.app.mouse.off(EVENT_MOUSEWHEEL, this.onMouseWheel, this);

                window.removeEventListener('mouseout', onMouseOut, false);
            });
        }

        // Disabling the context menu stops the browser displaying a menu when
        // you right-click the page
        this.app.mouse.disableContextMenu();

        this.lookButtonDown = false;
        this.panButtonDown = false;
        this.lastPoint = new Vec2();
    }

    pan(screenPoint) {
        const fromWorldPoint = OrbitCameraInputMouse.fromWorldPoint;
        const toWorldPoint = OrbitCameraInputMouse.toWorldPoint;
        const worldDiff = OrbitCameraInputMouse.worldDiff;

        // For panning to work at any zoom level, we use screen point to world projection
        // to work out how far we need to pan the pivotEntity in world space
        const camera = this.entity.camera;
        const distance = this.orbitCamera.distance;

        camera.screenToWorld(screenPoint.x, screenPoint.y, distance, fromWorldPoint);
        camera.screenToWorld(this.lastPoint.x, this.lastPoint.y, distance, toWorldPoint);

        worldDiff.sub2(toWorldPoint, fromWorldPoint);

        this.orbitCamera.pivotPoint.add(worldDiff);
    }

    onMouseDown(event) {
        switch (event.button) {
            case MOUSEBUTTON_LEFT:
                this.lookButtonDown = true;
                break;
            case MOUSEBUTTON_MIDDLE:
            case MOUSEBUTTON_RIGHT:
                this.panButtonDown = true;
                break;
        }
    }

    onMouseUp(event) {
        switch (event.button) {
            case MOUSEBUTTON_LEFT:
                this.lookButtonDown = false;
                break;
            case MOUSEBUTTON_MIDDLE:
            case MOUSEBUTTON_RIGHT:
                this.panButtonDown = false;
                break;
        }
    }

    onMouseMove(event) {
        if (this.lookButtonDown) {
            this.orbitCamera.pitch -= event.dy * this.orbitSensitivity;
            this.orbitCamera.yaw -= event.dx * this.orbitSensitivity;
        } else if (this.panButtonDown) {
            this.pan(event);
        }

        this.lastPoint.set(event.x, event.y);
    }

    onMouseWheel(event) {
        if (this.entity.camera.projection === PROJECTION_PERSPECTIVE) {
            this.orbitCamera.distance -=
                event.wheel *
                this.distanceSensitivity *
                (this.orbitCamera.distance * 0.1);
        } else {
            this.orbitCamera.orthoHeight -=
                event.wheel * this.distanceSensitivity;
        }
        event.event.preventDefault();
    }

    onMouseOut() {
        this.lookButtonDown = false;
        this.panButtonDown = false;
    }
}

export class OrbitCameraInputTouch extends Script {
    /**
     * How fast the camera moves around the orbit. Higher is faster
     *
     * @attribute
     * @type {number}
     */
    orbitSensitivity = 0.4;

    /**
     * How fast the camera moves in and out. Higher is faster
     *
     * @attribute
     * @type {number}
     */
    distanceSensitivity = 0.2;

    static pinchMidPoint = new Vec2();

    static fromWorldPoint = new Vec3();

    static toWorldPoint = new Vec3();

    static worldDiff = new Vec3();

    initialize() {
        this.orbitCamera = this.entity.script.orbitCamera;

        // Store the position of the touch so we can calculate the distance moved
        this.lastTouchPoint = new Vec2();
        this.lastPinchMidPoint = new Vec2();
        this.lastPinchDistance = 0;

        if (this.orbitCamera && this.app.touch) {
            // Use the same callback for the touchStart, touchEnd and touchCancel events as they
            // all do the same thing which is to deal the possible multiple touches to the screen
            this.app.touch.on(EVENT_TOUCHSTART, this.onTouchStartEndCancel, this);
            this.app.touch.on(EVENT_TOUCHEND, this.onTouchStartEndCancel, this);
            this.app.touch.on(EVENT_TOUCHCANCEL, this.onTouchStartEndCancel, this);
            this.app.touch.on(EVENT_TOUCHMOVE, this.onTouchMove, this);

            this.on('destroy', function () {
                this.app.touch.off(EVENT_TOUCHSTART, this.onTouchStartEndCancel, this);
                this.app.touch.off(EVENT_TOUCHEND, this.onTouchStartEndCancel, this);
                this.app.touch.off(EVENT_TOUCHCANCEL, this.onTouchStartEndCancel, this);
                this.app.touch.off(EVENT_TOUCHMOVE, this.onTouchMove, this);
            });
        }
    }

    getPinchDistance(pointA, pointB) {
        // Return the distance between the two points
        const dx = pointA.x - pointB.x;
        const dy = pointA.y - pointB.y;

        return Math.sqrt(dx * dx + dy * dy);
    }

    calcMidPoint(pointA, pointB, result) {
        result.set(pointB.x - pointA.x, pointB.y - pointA.y);
        result.mulScalar(0.5);
        result.x += pointA.x;
        result.y += pointA.y;
    }

    onTouchStartEndCancel(event) {
        // We only care about the first touch for camera rotation. As the user touches the screen,
        // we stored the current touch position
        const touches = event.touches;
        if (touches.length === 1) {
            this.lastTouchPoint.set(touches[0].x, touches[0].y);
        } else if (touches.length === 2) {
            // If there are 2 touches on the screen, then set the pinch distance
            this.lastPinchDistance = this.getPinchDistance(
                touches[0],
                touches[1]
            );
            this.calcMidPoint(touches[0], touches[1], this.lastPinchMidPoint);
        }
    }

    pan(midPoint) {
        const fromWorldPoint = OrbitCameraInputTouch.fromWorldPoint;
        const toWorldPoint = OrbitCameraInputTouch.toWorldPoint;
        const worldDiff = OrbitCameraInputTouch.worldDiff;

        // For panning to work at any zoom level, we use screen point to world projection
        // to work out how far we need to pan the pivotEntity in world space
        const camera = this.entity.camera;
        const distance = this.orbitCamera.distance;

        camera.screenToWorld(midPoint.x, midPoint.y, distance, fromWorldPoint);
        camera.screenToWorld(
            this.lastPinchMidPoint.x,
            this.lastPinchMidPoint.y,
            distance,
            toWorldPoint
        );

        worldDiff.sub2(toWorldPoint, fromWorldPoint);

        this.orbitCamera.pivotPoint.add(worldDiff);
    }

    onTouchMove(event) {
        const pinchMidPoint = OrbitCameraInputTouch.pinchMidPoint;

        // We only care about the first touch for camera rotation. Work out the difference moved since the last event
        // and use that to update the camera target position
        const touches = event.touches;
        if (touches.length === 1) {
            const touch = touches[0];

            this.orbitCamera.pitch -=
                (touch.y - this.lastTouchPoint.y) * this.orbitSensitivity;
            this.orbitCamera.yaw -=
                (touch.x - this.lastTouchPoint.x) * this.orbitSensitivity;

            this.lastTouchPoint.set(touch.x, touch.y);
        } else if (touches.length === 2) {
            // Calculate the difference in pinch distance since the last event
            const currentPinchDistance = this.getPinchDistance(
                touches[0],
                touches[1]
            );
            const diffInPinchDistance =
                currentPinchDistance - this.lastPinchDistance;
            this.lastPinchDistance = currentPinchDistance;

            this.orbitCamera.distance -=
                diffInPinchDistance *
                this.distanceSensitivity *
                0.1 *
                (this.orbitCamera.distance * 0.1);

            // Calculate pan difference
            this.calcMidPoint(touches[0], touches[1], pinchMidPoint);
            this.pan(pinchMidPoint);
            this.lastPinchMidPoint.copy(pinchMidPoint);
        }
    }
}
