Object.assign(pc, function () {
    var _inputScreenPosition = new pc.Vec2();
    var _inputWorldPosition = new pc.Vec3();
    var _rayOrigin = new pc.Vec3();
    var _rayDirection = new pc.Vec3();
    var _planeOrigin = new pc.Vec3();
    var _planeNormal = new pc.Vec3();
    var _entityRotation = new pc.Quat();

    var OPPOSITE_AXIS = {
        x: 'y',
        y: 'x'
    };

    /**
     * @component
     * @name pc.ElementDragHelper
     * @description Create a new ElementDragHelper
     * @classdesc Helper class that makes it easy to create Elements that can be dragged by the mouse or touch.
     * @param {pc.ElementComponent} element The Element that should become draggable.
     * @param {String} [axis] Optional axis to constrain to, either 'x', 'y' or null.
     */
    var ElementDragHelper = function ElementDragHelper(element, axis) {
        if (!element || !(element instanceof pc.ElementComponent)) {
            throw new Error('Element was null or not an ElementComponent');
        }

        if (axis && axis !== 'x' && axis !== 'y') {
            throw new Error('Unrecognized axis: ' + axis);
        }

        this._element = element;
        this._app = element.system.app;
        this._axis = axis || null;
        this._enabled = true;
        this._dragScale = new pc.Vec3();
        this._dragStartMousePosition = new pc.Vec3();
        this._dragStartHandlePosition = new pc.Vec3();
        this._deltaMousePosition = new pc.Vec3();
        this._deltaHandlePosition = new pc.Vec3();
        this._isDragging = false;

        pc.events.attach(this);

        this._toggleLifecycleListeners('on');
    };

    Object.assign(ElementDragHelper.prototype, {
        _toggleLifecycleListeners: function (onOrOff) {
            this._element[onOrOff]('mousedown', this._onMouseDownOrTouchStart, this);
            this._element[onOrOff]('touchstart', this._onMouseDownOrTouchStart, this);
        },

        _toggleDragListeners: function (onOrOff) {
            var isOn = onOrOff === 'on';
            var addOrRemoveEventListener = isOn ? 'addEventListener' : 'removeEventListener';

            // Prevent multiple listeners
            if (this._hasDragListeners && isOn) {
                return;
            }

            if (!this._handleMouseUpOrTouchEnd) {
                this._handleMouseUpOrTouchEnd = this._onMouseUpOrTouchEnd.bind(this);
            }

            // Note that we handle release events directly on the window object, rather than
            // on app.mouse or app.touch. This is in order to correctly handle cases where the
            // user releases the mouse/touch outside of the window.
            this._app.mouse[onOrOff]('mousemove', this._onMove, this);
            window[addOrRemoveEventListener]('mouseup', this._handleMouseUpOrTouchEnd, false);

            if (pc.platform.touch) {
                this._app.touch[onOrOff]('touchmove', this._onMove, this);
                window[addOrRemoveEventListener]('touchend', this._handleMouseUpOrTouchEnd, false);
                window[addOrRemoveEventListener]('touchcancel', this._handleMouseUpOrTouchEnd, false);
            }

            this._hasDragListeners = isOn;
        },

        _onMouseDownOrTouchStart: function (event) {
            if (this._element && !this._isDragging && this.enabled) {
                this._dragCamera = event.camera;
                this._calculateDragScale();

                var currentMousePosition = this._screenToLocal(event);

                if (currentMousePosition) {
                    this._toggleDragListeners('on');
                    this._isDragging = true;
                    this._dragStartMousePosition.copy(currentMousePosition);
                    this._dragStartHandlePosition.copy(this._element.entity.getLocalPosition());

                    this.fire('drag:start');
                }
            }
        },

        _onMouseUpOrTouchEnd: function () {
            if (this._isDragging) {
                this._isDragging = false;
                this._toggleDragListeners('off');

                this.fire('drag:end');
            }
        },

        _screenToLocal: function (event) {
            this._determineInputPosition(event);
            this._chooseRayOriginAndDirection();

            _planeOrigin.copy(this._element.entity.getPosition());
            _planeNormal.copy(this._element.entity.forward).scale(-1);

            var denominator = _planeNormal.dot(_rayDirection);

            // If the ray and plane are not parallel
            if (Math.abs(denominator) > 0) {
                var rayOriginToPlaneOrigin = _planeOrigin.sub(_rayOrigin);
                var collisionDistance = rayOriginToPlaneOrigin.dot(_planeNormal) / denominator;
                var position = _rayOrigin.add(_rayDirection.scale(collisionDistance));

                _entityRotation.copy(this._element.entity.getRotation()).invert().transformVector(position, position);

                position.mul(this._dragScale);

                return position;
            }

            return null;
        },

        _determineInputPosition: function (event) {
            var devicePixelRatio = this._app.graphicsDevice.maxPixelRatio;

            if (typeof event.x !== 'undefined' && typeof event.y !== 'undefined') {
                _inputScreenPosition.x = event.x * devicePixelRatio;
                _inputScreenPosition.y = event.y * devicePixelRatio;
            } else if (event.changedTouches) {
                _inputScreenPosition.x = event.changedTouches[0].x * devicePixelRatio;
                _inputScreenPosition.y = event.changedTouches[0].y * devicePixelRatio;
            } else {
                console.warn('Could not determine position from input event');
            }
        },

        _chooseRayOriginAndDirection: function () {
            if (this._element.screen && this._element.screen.screen.screenSpace) {
                _rayOrigin.set(_inputScreenPosition.x, -_inputScreenPosition.y, 0);
                _rayDirection.set(0, 0, -1);
            } else {
                _inputWorldPosition.copy(this._dragCamera.screenToWorld(_inputScreenPosition.x, _inputScreenPosition.y, 1));
                _rayOrigin.copy(this._dragCamera.entity.getPosition());
                _rayDirection.copy(_inputWorldPosition).sub(_rayOrigin).normalize();
            }
        },

        _calculateDragScale: function () {
            var current = this._element.entity.parent;
            var screen = this._element.screen && this._element.screen.screen;
            var isWithin2DScreen = screen && screen.screenSpace;
            var screenScale = isWithin2DScreen ? screen.scale : 1;
            var dragScale = this._dragScale;

            dragScale.set(screenScale, screenScale, screenScale);

            while (current) {
                dragScale.mul(current.getLocalScale());
                current = current.parent;

                if (isWithin2DScreen && current.screen) {
                    break;
                }
            }

            dragScale.x = 1 / dragScale.x;
            dragScale.y = 1 / dragScale.y;
            dragScale.z = 1 / dragScale.z;
        },

        _onMove: function (event) {
            if (this._element && this._isDragging && this.enabled && this._element.enabled && this._element.entity.enabled) {
                var currentMousePosition = this._screenToLocal(event);

                if (this._dragStartMousePosition && currentMousePosition) {
                    this._deltaMousePosition.copy(currentMousePosition).sub(this._dragStartMousePosition);
                    this._deltaHandlePosition.copy(this._dragStartHandlePosition).add(this._deltaMousePosition);

                    if (this._axis) {
                        var currentPosition = this._element.entity.getLocalPosition();
                        var constrainedAxis = OPPOSITE_AXIS[this._axis];
                        this._deltaHandlePosition[constrainedAxis] = currentPosition[constrainedAxis];
                    }

                    this._element.entity.setLocalPosition(this._deltaHandlePosition);
                    this.fire('drag:move', this._deltaHandlePosition);
                }
            }
        },

        destroy: function () {
            this._toggleLifecycleListeners('off');
            this._toggleDragListeners('off');
        }
    });

    Object.defineProperty(ElementDragHelper.prototype, 'enabled', {
        get: function () {
            return this._enabled;
        },

        set: function (value) {
            this._enabled = value;
        }
    });

    Object.defineProperty(ElementDragHelper.prototype, 'isDragging', {
        get: function () {
            return this._isDragging;
        }
    });

    return {
        ElementDragHelper: ElementDragHelper
    };
}());

/**
 * @event
 * @name pc.ElementDragHelper#drag:start
 * @description Fired when a new drag operation starts.
 */

/**
 * @event
 * @name pc.ElementDragHelper#drag:end
 * @description Fired when the current new drag operation ends.
 */

/**
 * @event
 * @name pc.ElementDragHelper#drag:move
 * @description Fired whenever the position of the dragged element changes.
 * @param {pc.Vec3} value The current position.
 */
