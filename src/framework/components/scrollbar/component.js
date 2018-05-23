pc.extend(pc, function () {
    var _inputScreenPosition = new pc.Vec2();
    var _inputWorldPosition = new pc.Vec3();
    var _rayOrigin = new pc.Vec3();
    var _rayDirection = new pc.Vec3();
    var _planeOrigin = new pc.Vec3();
    var _planeNormal = new pc.Vec3();
    var _entityRotation = new pc.Quat();

    /**
     * @component
     * @name pc.ScrollbarComponent
     * @description Create a new ScrollbarComponent
     * @classdesc A ScrollbarComponent enables a group of entities to behave like a draggable scrollbar.
     * @param {pc.ScrollbarComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * @property {pc.ORIENTATION} orientation Whether the scrollbar moves horizontally or vertically.
     * @property {Number} value The current position value of the scrollbar, in the range 0...1.
     * @property {Number} handleSize The size of the handle relative to the size of the track, in the range 0...1. For a vertical scrollbar, a value of 1 means that the handle will take up the full height of the track.
     * @property {pc.Entity} handleEntity The entity to be used as the scrollbar handle. This entity must have a Scrollbar component.
     */
    var ScrollbarComponent = function ScrollbarComponent(system, entity) {
        this._app = system.app;

        this._handleReference = new pc.EntityReference(this, 'handleEntity', {
            'button#gain': this._onHandleButtonGain,
            'button#press': this._onHandleButtonPress
        });

        this._dragScale = new pc.Vec3();
        this._dragStartMousePosition = new pc.Vec3();
        this._dragStartHandlePosition = new pc.Vec3();
        this._deltaMousePosition = new pc.Vec3();
        this._deltaHandlePosition = new pc.Vec3();

        this._toggleLifecycleListeners('on');
    };
    ScrollbarComponent = pc.inherits(ScrollbarComponent, pc.Component);

    pc.extend(ScrollbarComponent.prototype, {
        _toggleLifecycleListeners: function(onOrOff) {
            if (!this._handleRelease) {
                this._handleRelease = this._onRelease.bind(this);
            }

            var addOrRemoveEventListener = onOrOff === 'on' ? 'addEventListener' : 'removeEventListener';

            // Note that we handle release events directly on the window object, rather than
            // on app.mouse or app.touch. This is in order to correctly handle cases where the
            // user releases the mouse/touch outside of the window.
            this._app.mouse[onOrOff]('mousemove', this._onMove, this);
            window[addOrRemoveEventListener]('mouseup', this._handleRelease, false);

            if ('ontouchstart' in window) {
                this._app.touch[onOrOff]('touchmove', this._onMove, this);
                window[addOrRemoveEventListener]('touchend', this._handleRelease, false);
                window[addOrRemoveEventListener]('touchcancel', this._handleRelease, false);
            }

            this[onOrOff]('set_value', this._onSetValue, this);
            this[onOrOff]('set_handleSize', this._onSetHandleSize, this);

            // TODO Handle scrollwheel events
        },

        _onHandleButtonGain: function() {
            this._updateHandlePositionAndSize();
        },

        _onHandleButtonPress: function(event) {
            if (this._handleReference.entity) {
                this._isDragging = true;

                this._calculateDragScale();
                this._dragCamera = event.camera;
                this._dragStartMousePosition.copy(this._screenToLocal(event));
                this._dragStartHandlePosition.copy(this._handleReference.entity.getLocalPosition());
            }
        },

        _screenToLocal: function(event) {
            this._determineInputPosition(event);
            this._chooseRayOriginAndDirection();

            _planeOrigin.copy(this.entity.getPosition());
            _planeNormal.copy(this.entity.forward).scale(-1);

            var denominator = _planeNormal.dot(_rayDirection);

            // If the ray and plane are not parallel
            if (Math.abs(denominator) > 0) {
                var rayOriginToPlaneOrigin = _planeOrigin.sub(_rayOrigin);
                var collisionDistance = rayOriginToPlaneOrigin.dot(_planeNormal) / denominator;
                var position = _rayOrigin.add(_rayDirection.scale(collisionDistance));

                _entityRotation.copy(this.entity.getRotation()).invert().transformVector(position, position);

                position.mul(this._dragScale);

                return position;
            }

            return null;
        },

        _determineInputPosition: function(event) {
            if (typeof event.x !== 'undefined' && typeof event.y !== 'undefined') {
                _inputScreenPosition.x = event.x;
                _inputScreenPosition.y = event.y;
            } else if (event.changedTouches) {
                _inputScreenPosition.x = event.changedTouches[0].x;
                _inputScreenPosition.y = event.changedTouches[0].y;
            } else {
                console.warn('Could not determine position from input event');
            }
        },

        _chooseRayOriginAndDirection: function() {
            if (this.entity.element.screen && this.entity.element.screen.screen.screenSpace) {
                _rayOrigin.set(_inputScreenPosition.x, -_inputScreenPosition.y, 0);
                _rayDirection.set(0, 0, -1);
            } else {
                _inputWorldPosition.copy(this._dragCamera.screenToWorld(_inputScreenPosition.x, _inputScreenPosition.y, 1));
                _rayOrigin.copy(this._dragCamera.entity.getPosition());
                _rayDirection.copy(_inputWorldPosition).sub(_rayOrigin).normalize();
            }
        },

        _calculateDragScale: function() {
            var current = this.entity;
            var screen = this.entity.element.screen && this.entity.element.screen.screen;
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

            dragScale.data[0] = 1 / dragScale.data[0];
            dragScale.data[1] = 1 / dragScale.data[1];
            dragScale.data[2] = 1 / dragScale.data[2];
        },

        _onRelease: function() {
            this._isDragging = false;
        },

        _onMove: function(event) {
            if (this._handleReference.entity && this._isDragging && this.enabled && this.entity.enabled) {
                var currentMousePosition = this._screenToLocal(event);

                if (this._dragStartMousePosition && currentMousePosition) {
                    this._deltaMousePosition.copy(currentMousePosition).sub(this._dragStartMousePosition);
                    this._deltaHandlePosition.copy(this._dragStartHandlePosition).add(this._deltaMousePosition);

                    this.value = this._handlePositionToScrollValue(this._deltaHandlePosition[this._getAxis()]);
                }
            }
        },

        _onSetValue: function(name, oldValue, newValue) {
            if (Math.abs(newValue - oldValue) > 1e-3) {
                this._updateHandlePositionAndSize();
                this.fire('set:value', newValue);
            }
        },

        _onSetHandleSize: function(name, oldValue, newValue) {
            if (Math.abs(newValue - oldValue) > 1e-3) {
                this._updateHandlePositionAndSize();
            }
        },

        _updateHandlePositionAndSize: function() {
            var handleEntity = this._handleReference.entity;
            var handleElement = handleEntity && handleEntity.element;

            if (handleEntity) {
                var position = handleEntity.getLocalPosition();
                position[this._getAxis()] = this._getHandlePosition();
                this._handleReference.entity.setLocalPosition(position);
            }

            if (handleElement) {
                handleElement[this._getDimension()] = this._getHandleLength();
            }
        },

        _handlePositionToScrollValue: function(handlePosition) {
            return pc.math.clamp(handlePosition * this._getSign() / this._getUsableTrackLength(), 0, 1);
        },

        _scrollValueToHandlePosition: function(value) {
            return value * this._getSign() * this._getUsableTrackLength();
        },

        _getUsableTrackLength: function() {
            return Math.max(this._getTrackLength() - this._getHandleLength(), 1e-3);
        },

        _getTrackLength: function() {
            return this.orientation === pc.ORIENTATION_HORIZONTAL ? this.entity.element.calculatedWidth : this.entity.element.calculatedHeight;
        },

        _getHandleLength: function() {
            return this._getTrackLength() * this.handleSize;
        },

        _getHandlePosition: function() {
            return this._scrollValueToHandlePosition(this.value);
        },

        _getSign: function() {
            return this.orientation === pc.ORIENTATION_HORIZONTAL ? 1 : -1;
        },

        _getAxis: function() {
            return this.orientation === pc.ORIENTATION_HORIZONTAL ? 'x' : 'y';
        },

        _getDimension: function() {
            return this.orientation === pc.ORIENTATION_HORIZONTAL ? 'width' : 'height';
        },

        onRemove: function () {
            this._toggleLifecycleListeners('off');
        }
    });

    return {
        ScrollbarComponent: ScrollbarComponent
    };
}());

/**
 * @event
 * @name pc.ScrollbarComponent#set:value
 * @description Fired whenever the scroll value changes.
 * @param {Number} value The current scroll value.
 */
