import { platform } from '../../../core/platform.js';
import { EventHandler } from '../../../core/event-handler.js';

import { Quat } from '../../../core/math/quat.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';

import { ElementComponent } from './component.js';
import { Ray } from '../../../core/shape/ray.js';
import { Plane } from '../../../core/shape/plane.js';

const _inputScreenPosition = new Vec2();
const _inputWorldPosition = new Vec3();
const _ray = new Ray();
const _plane = new Plane();
const _normal = new Vec3();
const _point = new Vec3();
const _entityRotation = new Quat();

const OPPOSITE_AXIS = {
    x: 'y',
    y: 'x'
};

/**
 * Helper class that makes it easy to create Elements that can be dragged by the mouse or touch.
 *
 * @category User Interface
 */
class ElementDragHelper extends EventHandler {
    /**
     * Fired when a new drag operation starts.
     *
     * @event
     * @example
     * elementDragHelper.on('drag:start', () => {
     *     console.log('Drag started');
     * });
     */
    static EVENT_DRAGSTART = 'drag:start';

    /**
     * Fired when the current new drag operation ends.
     *
     * @event
     * @example
     * elementDragHelper.on('drag:end', () => {
     *     console.log('Drag ended');
     * });
     */
    static EVENT_DRAGEND = 'drag:end';

    /**
     * Fired whenever the position of the dragged element changes. The handler is passed the
     * current {@link Vec3} position of the dragged element.
     *
     * @event
     * @example
     * elementDragHelper.on('drag:move', (position) => {
     *     console.log(`Dragged element position is ${position}`);
     * });
     */
    static EVENT_DRAGMOVE = 'drag:move';

    /**
     * Create a new ElementDragHelper instance.
     *
     * @param {ElementComponent} element - The Element that should become draggable.
     * @param {string} [axis] - Optional axis to constrain to, either 'x', 'y' or null.
     */
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

    /**
     * @param {'on'|'off'} onOrOff - Either 'on' or 'off'.
     * @private
     */
    _toggleLifecycleListeners(onOrOff) {
        this._element[onOrOff]('mousedown', this._onMouseDownOrTouchStart, this);
        this._element[onOrOff]('touchstart', this._onMouseDownOrTouchStart, this);
        this._element[onOrOff]('selectstart', this._onMouseDownOrTouchStart, this);
    }

    /**
     * @param {'on'|'off'} onOrOff - Either 'on' or 'off'.
     * @private
     */
    _toggleDragListeners(onOrOff) {
        const isOn = onOrOff === 'on';

        // Prevent multiple listeners
        if (this._hasDragListeners && isOn) {
            return;
        }

        // mouse events, if mouse is available
        if (this._app.mouse) {
            this._element[onOrOff]('mousemove', this._onMove, this);
            this._element[onOrOff]('mouseup', this._onMouseUpOrTouchEnd, this);
        }

        // touch events, if touch is available
        if (platform.touch) {
            this._element[onOrOff]('touchmove', this._onMove, this);
            this._element[onOrOff]('touchend', this._onMouseUpOrTouchEnd, this);
            this._element[onOrOff]('touchcancel', this._onMouseUpOrTouchEnd, this);
        }

        // webxr events
        this._element[onOrOff]('selectmove', this._onMove, this);
        this._element[onOrOff]('selectend', this._onMouseUpOrTouchEnd, this);

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

    /**
     * This method calculates the `Vec3` intersection point of plane/ray intersection based on
     * the mouse/touch input event. If there is no intersection, it returns `null`.
     *
     * @param {import('../../input/element-input').ElementTouchEvent | import('../../input/element-input').ElementMouseEvent | import('../../input/element-input').ElementSelectEvent} event - The event.
     * @returns {Vec3|null} The `Vec3` intersection point of plane/ray intersection, if there
     * is an intersection, otherwise `null`
     * @private
     */
    _screenToLocal(event) {
        if (event.inputSource) {
            _ray.set(event.inputSource.getOrigin(), event.inputSource.getDirection());
        } else {
            this._determineInputPosition(event);
            this._chooseRayOriginAndDirection();
        }

        _normal.copy(this._element.entity.forward).mulScalar(-1);
        _plane.setFromPointNormal(this._element.entity.getPosition(), _normal);

        if (_plane.intersectsRay(_ray, _point)) {
            _entityRotation.copy(this._element.entity.getRotation()).invert().transformVector(_point, _point);
            _point.mul(this._dragScale);
            return _point;
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
            _ray.origin.set(_inputScreenPosition.x, -_inputScreenPosition.y, 0);
            _ray.direction.copy(Vec3.FORWARD);
        } else {
            _inputWorldPosition.copy(this._dragCamera.screenToWorld(_inputScreenPosition.x, _inputScreenPosition.y, 1));
            _ray.origin.copy(this._dragCamera.entity.getPosition());
            _ray.direction.copy(_inputWorldPosition).sub(_ray.origin).normalize();
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
        dragScale.z = 0;
    }

    /**
     * This method is linked to `_element` events: `mousemove` and `touchmove`
     *
     * @param {import('../../input/element-input').ElementTouchEvent} event - The event.
     * @private
     */
    _onMove(event) {
        const {
            _element: element,
            _deltaMousePosition: deltaMousePosition,
            _deltaHandlePosition: deltaHandlePosition,
            _axis: axis
        } = this;
        if (element && this._isDragging && this.enabled && element.enabled && element.entity.enabled) {
            const currentMousePosition = this._screenToLocal(event);
            if (currentMousePosition) {
                deltaMousePosition.sub2(currentMousePosition, this._dragStartMousePosition);
                deltaHandlePosition.add2(this._dragStartHandlePosition, deltaMousePosition);

                if (axis) {
                    const currentPosition = element.entity.getLocalPosition();
                    const constrainedAxis = OPPOSITE_AXIS[axis];
                    deltaHandlePosition[constrainedAxis] = currentPosition[constrainedAxis];
                }

                element.entity.setLocalPosition(deltaHandlePosition);
                this.fire('drag:move', deltaHandlePosition);
            }
        }
    }

    destroy() {
        this._toggleLifecycleListeners('off');
        this._toggleDragListeners('off');
    }

    set enabled(value) {
        this._enabled = value;
    }

    get enabled() {
        return this._enabled;
    }

    get isDragging() {
        return this._isDragging;
    }
}

export { ElementDragHelper };
