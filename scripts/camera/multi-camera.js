(() => {
    const { createScript, BoundingBox, Vec2, Vec3, Ray, Plane, math } = pc;

    const tmpVa = new Vec2();
    const tmpV1 = new Vec3();
    const tmpV2 = new Vec3();
    const tmpR1 = new Ray();
    const tmpP1 = new Plane();

    const PASSIVE = { passive: false };

    const LOOK_MAX_ANGLE = 90;

    function calcEntityAABB(bbox, entity) {
        bbox.center.set(0, 0, 0);
        bbox.halfExtents.set(0, 0, 0);
        entity.findComponents('render').forEach((render) => {
            render.meshInstances.forEach((mi) => {
                bbox.add(mi.aabb);
            });
        });
        return bbox;
    }

    class BaseCamera {
        /**
         * @type {Entity}
         */
        entity;

        /**
         * @type {HTMLElement}
         */
        target = document.documentElement;

        /**
         * @type {number}
         */
        sceneSize = 100;

        /**
         * @type {number}
         */
        lookSensitivity = 0.2;

        /**
         * @type {number}
         */
        lookDamping = 0.97;

        /**
         * @type {number}
         */
        moveDamping = 0.98;

        /**
         * @type {Entity}
         * @protected
         */
        _camera = null;

        /**
         * @type {Vec3}
         * @protected
         */
        _origin = new Vec3(0, 1, 0);

        /**
         * @type {Vec3}
         * @protected
         */
        _position = new Vec3();

        /**
         * @type {Vec2}
         * @protected
         */
        _dir = new Vec2();

        /**
         * @type {Vec3}
         * @protected
         */
        _angles = new Vec3();

        /**
         * @param {Entity} entity - The entity to attach the camera to.
         * @param {HTMLElement} target - The target element to listen for pointer events.
         * @param {Record<string, any>} options - The options for the camera.
         */
        constructor(entity, target, options = {}) {
            this.entity = entity;
            this.target = target;
            this.sceneSize = options.sceneSize ?? this.sceneSize;
            this.lookSensitivity = options.lookSensitivity ?? this.lookSensitivity;
            this.lookDamping = options.lookDamping ?? this.lookDamping;
            this.moveDamping = options.moveDamping ?? this.moveDamping;

            this._onPointerDown = this._onPointerDown.bind(this);
            this._onPointerMove = this._onPointerMove.bind(this);
            this._onPointerUp = this._onPointerUp.bind(this);
        }

        /**
         * @param {number} dt - The delta time in seconds.
         * @private
         */
        _smoothLook(dt) {
            const lerpRate = 1 - Math.pow(this.lookDamping, dt * 1000);
            this._angles.x = math.lerp(this._angles.x, this._dir.x, lerpRate);
            this._angles.y = math.lerp(this._angles.y, this._dir.y, lerpRate);
            this.entity.setEulerAngles(this._angles);
        }

        /**
         * @param {number} dt - The delta time in seconds.
         * @private
         */
        _smoothMove(dt) {
            this._position.lerp(this._position, this._origin, 1 - Math.pow(this.moveDamping, dt * 1000));
            this.entity.setPosition(this._position);
        }

        /**
         * @param {MouseEvent} event - The mouse event.
         * @private
         */
        _onContextMenu(event) {
            event.preventDefault();
        }

        /**
         * @param {PointerEvent} event - The pointer event.
         * @protected
         * @abstract
         */
        _onPointerDown(event) {}

        /**
         * @param {PointerEvent} event - The pointer move event.
         * @protected
         * @abstract
         */
        _onPointerMove(event) {}

        /**
         * @param {PointerEvent} event - The pointer event.
         * @protected
         * @abstract
         */
        _onPointerUp(event) {}

        /**
         * @param {PointerEvent} event - The pointer move event.
         * @protected
         */
        _look(event) {
            if (event.target !== this.target) {
                return;
            }
            const movementX = event.movementX || 0;
            const movementY = event.movementY || 0;
            this._dir.x = math.clamp(this._dir.x - movementY * this.lookSensitivity, -LOOK_MAX_ANGLE, LOOK_MAX_ANGLE);
            this._dir.y -= movementX * this.lookSensitivity;
        }

        /**
         * @param {Entity} camera - The camera entity to attach.
         */
        attach(camera) {
            this._camera = camera;
            this._camera.setLocalEulerAngles(0, 0, 0);

            window.addEventListener('pointerdown', this._onPointerDown);
            window.addEventListener('pointermove', this._onPointerMove);
            window.addEventListener('pointerup', this._onPointerUp);
            window.addEventListener('contextmenu', this._onContextMenu);

            this.entity.addChild(camera);
        }

        detach() {
            window.removeEventListener('pointermove', this._onPointerMove);
            window.removeEventListener('pointerdown', this._onPointerDown);
            window.removeEventListener('pointerup', this._onPointerUp);
            window.removeEventListener('contextmenu', this._onContextMenu);

            this.entity.removeChild(this._camera);
            this._camera = null;

            this._dir.x = this._angles.x;
            this._dir.y = this._angles.y;

            this._origin.copy(this._position);
        }

        /**
         * @param {number} dt - The delta time in seconds.
         */
        update(dt) {
            if (!this._camera) {
                return;
            }

            this._smoothLook(dt);
            this._smoothMove(dt);
        }
    }

    class MultiCamera extends BaseCamera {
        /**
         * @type {number}
         */
        focusFov = 75;

        /**
         * @type {number}
         */
        lookSensitivity = 0.2;

        /**
         * @type {number}
         */
        lookDamping = 0.97;

        /**
         * @type {number}
         */
        moveDamping = 0.98;

        /**
         * @type {number}
         */
        pinchSpeed = 5;

        /**
         * @type {number}
         */
        wheelSpeed = 0.005;

        /**
         * @type {number}
         */
        zoomMin = 0.001;

        /**
         * @type {number}
         */
        zoomMax = 10;

        /**
         * @type {number}
         */
        zoomScaleMin = 0.01;

        /**
         * @type {number}
         */
        moveSpeed = 2;

        /**
         * @type {number}
         */
        sprintSpeed = 4;

        /**
         * @type {number}
         */
        crouchSpeed = 1;

        /**
         * @type {number}
         * @private
         */
        _zoom = 0;

        /**
         * @type {number}
         * @private
         */
        _cameraDist = 0;

        /**
         * @type {Map<number, PointerEvent>}
         * @private
         */
        _pointerEvents = new Map();

        /**
         * @type {number}
         * @private
         */
        _lastPinchDist = -1;

        /**
         * @type {Vec2}
         * @private
         */
        _lastPosition = new Vec2();

        /**
         * @type {boolean}
         */
        _panning = false;

        /**
         * @type {boolean}
         */
        _flying = false;

        /**
         * @type {Record<string, boolean>}
         * @private
         */
        _key = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            up: false,
            down: false,
            sprint: false,
            crouch: false
        };

        /**
         * @param {Entity} entity - The entity to attach the camera to.
         * @param {HTMLElement} target - The target element to listen for pointer events.
         * @param {Record<string, any>} options - The options for the camera.
         */
        constructor(entity, target, options = {}) {
            super(entity, target, options);

            this.pinchSpeed = options.pinchSpeed ?? this.pinchSpeed;
            this.wheelSpeed = options.wheelSpeed ?? this.wheelSpeed;
            this.zoomMin = options.zoomMin ?? this.zoomMin;
            this.zoomMax = options.zoomMax ?? this.zoomMax;
            this.moveSpeed = options.moveSpeed ?? this.moveSpeed;
            this.sprintSpeed = options.sprintSpeed ?? this.sprintSpeed;
            this.crouchSpeed = options.crouchSpeed ?? this.crouchSpeed;

            this._onWheel = this._onWheel.bind(this);
            this._onKeyDown = this._onKeyDown.bind(this);
            this._onKeyUp = this._onKeyUp.bind(this);
        }

        /**
         * @param {PointerEvent} event - The pointer event.
         * @protected
         */
        _onPointerDown(event) {
            if (!this._camera) {
                return;
            }
            this._pointerEvents.set(event.pointerId, event);
            if (this._pointerEvents.size === 2) {
                this._lastPinchDist = this._getPinchDist();
                this._getMidPoint(this._lastPosition);
                this._panning = true;
            }
            if (event.shiftKey || event.button === 1) {
                this._lastPosition.set(event.clientX, event.clientY);
                this._panning = true;
            }
            if (event.button === 2) {
                this._zoom = this._cameraDist;
                this._origin.copy(this._camera.getPosition());
                this._position.copy(this._origin);
                this._camera.setLocalPosition(0, 0, 0);
                this._flying = true;
            }
        }

        /**
         * @param {PointerEvent} event - The pointer event.
         * @protected
         */
        _onPointerMove(event) {
            if (this._pointerEvents.size === 0) {
                return;
            }

            this._pointerEvents.set(event.pointerId, event);

            if (this._pointerEvents.size === 1) {
                if (this._panning) {
                    // mouse pan
                    this._handlePan(tmpVa.set(event.clientX, event.clientY));
                } else {
                    super._look(event);
                }
                return;
            }

            if (this._pointerEvents.size === 2) {
                // touch pan
                this._handlePan(this._getMidPoint(tmpVa));

                // pinch zoom
                const pinchDist = this._getPinchDist();
                if (this._lastPinchDist > 0) {
                    this._handleZoom((this._lastPinchDist - pinchDist) * this.pinchSpeed);
                }
                this._lastPinchDist = pinchDist;
            }
        }

        /**
         * @param {PointerEvent} event - The pointer event.
         * @protected
         */
        _onPointerUp(event) {
            this._pointerEvents.delete(event.pointerId);
            if (this._pointerEvents.size < 2) {
                this._lastPinchDist = -1;
                this._panning = false;
            }
            if (this._panning) {
                this._panning = false;
            }
            if (this._flying) {
                tmpV1.copy(this.entity.forward).mulScalar(this._zoom);
                this._origin.add(tmpV1);
                this._position.add(tmpV1);
                this._flying = false;
            }
        }

        /**
         * @param {WheelEvent} event - The wheel event.
         * @private
         */
        _onWheel(event) {
            event.preventDefault();
            this._handleZoom(event.deltaY);
        }

        /**
         * @param {KeyboardEvent} event - The keyboard event.
         * @private
         */
        _onKeyDown(event) {
            event.stopPropagation();
            switch (event.key.toLowerCase()) {
                case 'w':
                    this._key.forward = true;
                    break;
                case 's':
                    this._key.backward = true;
                    break;
                case 'a':
                    this._key.left = true;
                    break;
                case 'd':
                    this._key.right = true;
                    break;
                case 'q':
                    this._key.up = true;
                    break;
                case 'e':
                    this._key.down = true;
                    break;
                case 'shift':
                    this._key.sprint = true;
                    break;
                case 'control':
                    this._key.crouch = true;
                    break;
            }
        }

        /**
         * @param {KeyboardEvent} event - The keyboard event.
         * @private
         */
        _onKeyUp(event) {
            event.stopPropagation();
            switch (event.key.toLowerCase()) {
                case 'w':
                    this._key.forward = false;
                    break;
                case 's':
                    this._key.backward = false;
                    break;
                case 'a':
                    this._key.left = false;
                    break;
                case 'd':
                    this._key.right = false;
                    break;
                case 'q':
                    this._key.up = false;
                    break;
                case 'e':
                    this._key.down = false;
                    break;
                case 'shift':
                    this._key.sprint = false;
                    break;
                case 'control':
                    this._key.crouch = false;
                    break;
            }
        }

        /**
         * @param {number} dt - The time delta.
         * @private
         */
        _handleMove(dt) {
            tmpV1.set(0, 0, 0);
            if (this._key.forward) {
                tmpV1.add(this.entity.forward);
            }
            if (this._key.backward) {
                tmpV1.sub(this.entity.forward);
            }
            if (this._key.left) {
                tmpV1.sub(this.entity.right);
            }
            if (this._key.right) {
                tmpV1.add(this.entity.right);
            }
            if (this._key.up) {
                tmpV1.add(this.entity.up);
            }
            if (this._key.down) {
                tmpV1.sub(this.entity.up);
            }
            tmpV1.normalize();
            const speed = this._key.crouch ? this.crouchSpeed : this._key.sprint ? this.sprintSpeed : this.moveSpeed;
            tmpV1.mulScalar(this.sceneSize * speed * dt);
            this._origin.add(tmpV1);
        }

        /**
         * @param {Vec2} out - The output vector.
         * @returns {Vec2} The mid point.
         * @private
         */
        _getMidPoint(out) {
            const [a, b] = this._pointerEvents.values();
            const dx = a.clientX - b.clientX;
            const dy = a.clientY - b.clientY;
            return out.set(b.clientX + dx * 0.5, b.clientY + dy * 0.5);
        }

        /**
         * @returns {number} The pinch distance.
         * @private
         */
        _getPinchDist() {
            const [a, b] = this._pointerEvents.values();
            const dx = a.clientX - b.clientX;
            const dy = a.clientY - b.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        }

        /**
         * @param {Vec2} pos - The position.
         * @param {Vec3} point - The output point.
         * @private
         */
        _screenToWorldPan(pos, point) {
            const mouseW = this._camera.camera.screenToWorld(pos.x, pos.y, 1);
            const cameraPos = this._camera.getPosition();

            const focusDirScaled = tmpV1.copy(this.entity.forward).mulScalar(this._zoom);
            const focalPos = tmpV2.add2(cameraPos, focusDirScaled);
            const planeNormal = focusDirScaled.mulScalar(-1).normalize();

            const plane = tmpP1.setFromPointNormal(focalPos, planeNormal);
            const ray = tmpR1.set(cameraPos, mouseW.sub(cameraPos).normalize());

            plane.intersectsRay(ray, point);
        }

        /**
         * @param {Vec2} pos - The position.
         * @private
         */
        _handlePan(pos) {
            const start = new Vec3();
            const end = new Vec3();

            this._screenToWorldPan(this._lastPosition, start);
            this._screenToWorldPan(pos, end);

            tmpV1.sub2(start, end);
            this._origin.add(tmpV1);

            this._lastPosition.copy(pos);
        }

        /**
         * @param {number} delta - The delta.
         * @private
         */
        _handleZoom(delta) {
            const min = this._camera.camera.nearClip + this.zoomMin * this.sceneSize;
            const max = this.zoomMax * this.sceneSize;
            const scale = math.clamp(this._zoom / (max - min), this.zoomScaleMin, 1);
            this._zoom += delta * this.wheelSpeed * this.sceneSize * scale;
            this._zoom = math.clamp(this._zoom, min, max);
        }

        /**
         * @returns {number} The zoom.
         * @private
         */
        _calcZoom() {
            const camera = this._camera.camera;
            const d1 = Math.tan(0.5 * this.focusFov * math.DEG_TO_RAD);
            const d2 = Math.tan(0.5 * camera.fov * math.DEG_TO_RAD);

            const scale = (d1 / d2) * (1 / camera.aspectRatio);
            return scale * this.sceneSize + this.sceneSize;
        }

        /**
         * @param {Vec3} point - The point to focus on.
         * @param {Vec3} [start] - The start point.
         * @param {boolean} [snap] - Whether to snap the focus.
         */
        focus(point, start, snap = false) {
            if (!this._camera) {
                return;
            }

            this._origin.copy(point);
            if (snap) {
                this._position.copy(point);
            }
            this._camera.setPosition(start);
            this._camera.setLocalEulerAngles(0, 0, 0);

            if (!start) {
                return;
            }

            tmpV1.sub2(start, point);
            const elev = Math.atan2(tmpV1.y, tmpV1.z) * math.RAD_TO_DEG;
            const azim = Math.atan2(tmpV1.x, tmpV1.z) * math.RAD_TO_DEG;
            this._dir.set(-elev, -azim);
            if (snap) {
                this._angles.copy(this._dir);
            }

            this._zoom = tmpV1.length();
        }

        /**
         * @param {Entity} entity - The entity to focus on.
         * @param {boolean} [snap] - Whether to snap the focus.
         */
        focusOnEntity(entity, snap = false) {
            const bbox = calcEntityAABB(new BoundingBox(), entity);
            this.sceneSize = bbox.halfExtents.length();
            this.focus(bbox.center, undefined, snap);
            this._zoom = this._calcZoom();
            if (snap) {
                this._cameraDist = this._zoom;
            }
        }

        /**
         * @param {Entity} camera - The camera entity to attach.
         */
        attach(camera) {
            super.attach(camera);
            this._camera.setPosition(0, 0, 0);
            this._camera.setLocalEulerAngles(0, 0, 0);

            window.addEventListener('wheel', this._onWheel, PASSIVE);
            window.addEventListener('keydown', this._onKeyDown, false);
            window.addEventListener('keyup', this._onKeyUp, false);
        }

        detach() {
            super.detach();

            window.removeEventListener('wheel', this._onWheel, PASSIVE);
            window.removeEventListener('keydown', this._onKeyDown, false);
            window.removeEventListener('keyup', this._onKeyUp, false);

            this._pointerEvents.clear();
            this._lastPinchDist = -1;
            this._panning = false;
            this._key = {
                forward: false,
                backward: false,
                left: false,
                right: false,
                up: false,
                down: false,
                sprint: false,
                crouch: false
            };
        }

        /**
         * @param {number} dt - The delta time in seconds.
         */
        update(dt) {
            if (!this._camera) {
                return;
            }

            if (!this._flying) {
                this._cameraDist = math.lerp(this._cameraDist, this._zoom, 1 - Math.pow(this.moveDamping, dt * 1000));
                this._camera.setLocalPosition(0, 0, this._cameraDist);
            }

            this._handleMove(dt);

            super.update(dt);
        }
    }

    const MultiCameraScript = createScript('multiCamera');

    MultiCameraScript.attributes.add('camera', { type: 'entity' });

    MultiCameraScript.prototype.initialize = function () {
        this.multiCamera = new MultiCamera(this.entity, this.app.graphicsDevice.canvas, {
            name: 'multi-camera'
        });
        this.multiCamera.attach(this.camera);

        this._onKeyDown = this._onKeyDown.bind(this);
        window.addEventListener('keydown', this._onKeyDown, false);

        this.on('destroy', () => {
            this.multiCamera.detach();
            window.removeEventListener('keydown', this._onKeyDown, false);
        });

    };

    MultiCameraScript.prototype._onKeyDown = function (event) {
        if (event.key === 'f') {
            this.focusOnEntity(this.focus);
        }
    };

    MultiCameraScript.prototype.focusOnEntity = function (entity, snap = false) {
        this.multiCamera.focusOnEntity(entity, snap);
    };

    MultiCameraScript.prototype.update = function (dt) {
        this.multiCamera.update(dt);
    };
})();
