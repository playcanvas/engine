import { platform } from '../../../core/platform.js';
import { EventHandler } from '../../../core/event-handler.js';

import { Quat } from '../../../math/quat.js';
import { Vec2 } from '../../../math/vec2.js';
import { Vec3 } from '../../../math/vec3.js';

import { ElementComponent } from './component.js';

const _inputScreenPosition = new Vec2();
const _inputWorldPosition = new Vec3();
const _rayOrigin = new Vec3();
const _rayDirection = new Vec3();
const _planeOrigin = new Vec3();
const _planeNormal = new Vec3();
const _entityRotation = new Quat();

const OPPOSITE_AXIS = {
    x: 'y',
    y: 'x'
};

/**
 * @class
 * @name ElementDragHelper
 * @augments EventHandler
 * @description Create a new ElementDragHelper.
 * @classdesc Helper class that makes it easy to create Elements that can be dragged by the mouse or touch.
 * @param {ElementComponent} element - The Element that should become draggable.
 * @param {string} [axis] - Optional axis to constrain to, either 'x', 'y' or null.
 */
class ElementDragHelper extends EventHandler {
    constructor(element, axis) {
        super();

        if (!element || !(element instanceof ElementComponent)) {
            throw new Error('Element was null or not an ElementComponent');
        }

        if (axis && axis !== 'x' && axis !== 'y') {
            throw new Error('Unrecognized axis: ' + axis);
        }

        this._element = element;
        this._app = element.system.app;
        this._axis = axis || null;
        this._enabled = true;
        this._dragScale = new Vec3();
        this._dragStartMousePosition = new Vec3();
        this._dragStartHandlePosition = new Vec3();
        this._deltaMousePosition = new Vec3();
        this._deltaHandlePosition = new Vec3();
        this._isDragging = false;

        this._toggleLifecycleListeners('on');
    }

    _toggleLifecycleListeners(onOrOff) {
        this._element[onOrOff]('mousedown', this._onMouseDownOrTouchStart, this);
        this._element[onOrOff]('touchstart', this._onMouseDownOrTouchStart, this);
    }

    _toggleDragListeners(onOrOff) {
        const isOn = onOrOff === 'on';
        const addOrRemoveEventListener = isOn ? 'addEventListener' : 'removeEventListener';

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
        if (this._app.mouse) {
            this._app.mouse[onOrOff]('mousemove', this._onMove, this);
            window[addOrRemoveEventListener]('mouseup', this._handleMouseUpOrTouchEnd, false);
        }

        if (platform.touch) {
            this._app.touch[onOrOff]('touchmove', this._onMove, this);
            window[addOrRemoveEventListener]('touchend', this._handleMouseUpOrTouchEnd, false);
            window[addOrRemoveEventListener]('touchcancel', this._handleMouseUpOrTouchEnd, false);
        }

        this._hasDragListeners = isOn;
    }

    _onMouseDownOrTouchStart(event) {
        if (this._element && !this._isDragging && this.enabled) {
            this._dragCamera = event.camera;
            this._calculateDragScale();

            const currentMousePosition = this._screenToLocal(event);

            if (currentMousePosition) {
                this._toggleDragListeners('on');
                this._isDragging = true;
                this._dragStartMousePosition.copy(currentMousePosition);
                this._dragStartHandlePosition.copy(this._element.entity.getLocalPosition());

                this.fire('drag:start');
            }
        }
    }

    _onMouseUpOrTouchEnd() {
        if (this._isDragging) {
            this._isDragging = false;
            this._toggleDragListeners('off');

            this.fire('drag:end');
        }
    }

    _screenToLocal(event) {
        this._determineInputPosition(event);
        this._chooseRayOriginAndDirection();

        _planeOrigin.copy(this._element.entity.getPosition());
        _planeNormal.copy(this._element.entity.forward).mulScalar(-1);

        const denominator = _planeNormal.dot(_rayDirection);

        // If the ray and plane are not parallel
        if (Math.abs(denominator) > 0) {
            const rayOriginToPlaneOrigin = _planeOrigin.sub(_rayOrigin);
            const collisionDistance = rayOriginToPlaneOrigin.dot(_planeNormal) / denominator;
            const position = _rayOrigin.add(_rayDirection.mulScalar(collisionDistance));

            _entityRotation.copy(this._element.entity.getRotation()).invert().transformVector(position, position);

            position.mul(this._dragScale);

            return position;
        }

        return null;
    }

    _determineInputPosition(event) {
        const devicePixelRatio = this._app.graphicsDevice.maxPixelRatio;

        if (typeof event.x !== 'undefined' && typeof event.y !== 'undefined') {
            _inputScreenPosition.x = event.x * devicePixelRatio;
            _inputScreenPosition.y = event.y * devicePixelRatio;
        } else if (event.changedTouches) {
            _inputScreenPosition.x = event.changedTouches[0].x * devicePixelRatio;
            _inputScreenPosition.y = event.changedTouches[0].y * devicePixelRatio;
        } else {
            console.warn('Could not determine position from input event');
        }
    }

    _chooseRayOriginAndDirection() {
        if (this._element.screen && this._element.screen.screen.screenSpace) {
            _rayOrigin.set(_inputScreenPosition.x, -_inputScreenPosition.y, 0);
            _rayDirection.set(0, 0, -1);
        } else {
            _inputWorldPosition.copy(this._dragCamera.screenToWorld(_inputScreenPosition.x, _inputScreenPosition.y, 1));
            _rayOrigin.copy(this._dragCamera.entity.getPosition());
            _rayDirection.copy(_inputWorldPosition).sub(_rayOrigin).normalize();
        }
    }

    _calculateDragScale() {
        let current = this._element.entity.parent;
        const screen = this._element.screen && this._element.screen.screen;
        const isWithin2DScreen = screen && screen.screenSpace;
        const screenScale = isWithin2DScreen ? screen.scale : 1;
        const dragScale = this._dragScale;

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
    }

    _onMove(event) {
        if (this._element && this._isDragging && this.enabled && this._element.enabled && this._element.entity.enabled) {
            const currentMousePosition = this._screenToLocal(event);

            if (this._dragStartMousePosition && currentMousePosition) {
                this._deltaMousePosition.copy(currentMousePosition).sub(this._dragStartMousePosition);
                this._deltaHandlePosition.copy(this._dragStartHandlePosition).add(this._deltaMousePosition);

                if (this._axis) {
                    const currentPosition = this._element.entity.getLocalPosition();
                    const constrainedAxis = OPPOSITE_AXIS[this._axis];
                    this._deltaHandlePosition[constrainedAxis] = currentPosition[constrainedAxis];
                }

                this._element.entity.setLocalPosition(this._deltaHandlePosition);
                this.fire('drag:move', this._deltaHandlePosition);
            }
        }
    }

    destroy() {
        this._toggleLifecycleListeners('off');
        this._toggleDragListeners('off');
    }

    get enabled() {
        return this._enabled;
    }

    set enabled(value) {
        this._enabled = value;
    }

    get isDragging() {
        return this._isDragging;
    }

    /**
     * @event
     * @name ElementDragHelper#drag:start
     * @description Fired when a new drag operation starts.
     */

    /**
     * @event
     * @name ElementDragHelper#drag:end
     * @description Fired when the current new drag operation ends.
     */

    /**
     * @event
     * @name ElementDragHelper#drag:move
     * @description Fired whenever the position of the dragged element changes.
     * @param {Vec3} value - The current position.
     */
}

export { ElementDragHelper };
