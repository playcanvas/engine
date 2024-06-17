import { platform } from '../../core/platform.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { Ray } from '../../core/shape/ray.js';

import { Mouse } from '../../platform/input/mouse.js';

import { getApplication } from '../globals.js';

let targetX, targetY;
const vecA = new Vec3();
const vecB = new Vec3();

const rayA = new Ray();
const rayB = new Ray();
const rayC = new Ray();

rayA.end = new Vec3();
rayB.end = new Vec3();
rayC.end = new Vec3();

const _pq = new Vec3();
const _pa = new Vec3();
const _pb = new Vec3();
const _pc = new Vec3();
const _pd = new Vec3();
const _m = new Vec3();
const _au = new Vec3();
const _bv = new Vec3();
const _cw = new Vec3();
const _ir = new Vec3();
const _sct = new Vec3();
const _accumulatedScale = new Vec3();
const _paddingTop = new Vec3();
const _paddingBottom = new Vec3();
const _paddingLeft = new Vec3();
const _paddingRight = new Vec3();
const _cornerBottomLeft = new Vec3();
const _cornerBottomRight = new Vec3();
const _cornerTopRight = new Vec3();
const _cornerTopLeft = new Vec3();

const ZERO_VEC4 = new Vec4();

// pi x p2 * p3
function scalarTriple(p1, p2, p3) {
    return _sct.cross(p1, p2).dot(p3);
}

// Given line pq and ccw corners of a quad, return the square distance to the intersection point.
// If the line and quad do not intersect, return -1. (from Real-Time Collision Detection book)
function intersectLineQuad(p, q, corners) {
    _pq.sub2(q, p);
    _pa.sub2(corners[0], p);
    _pb.sub2(corners[1], p);
    _pc.sub2(corners[2], p);

    // Determine which triangle to test against by testing against diagonal first
    _m.cross(_pc, _pq);
    let v = _pa.dot(_m);
    let u;
    let w;

    if (v >= 0) {
        // Test intersection against triangle abc
        u = -_pb.dot(_m);
        if (u < 0)
            return -1;

        w = scalarTriple(_pq, _pb, _pa);
        if (w < 0)
            return -1;

        const denom = 1.0 / (u + v + w);

        _au.copy(corners[0]).mulScalar(u * denom);
        _bv.copy(corners[1]).mulScalar(v * denom);
        _cw.copy(corners[2]).mulScalar(w * denom);
        _ir.copy(_au).add(_bv).add(_cw);
    } else {
        // Test intersection against triangle dac
        _pd.sub2(corners[3], p);
        u = _pd.dot(_m);
        if (u < 0)
            return -1;

        w = scalarTriple(_pq, _pa, _pd);
        if (w < 0)
            return -1;

        v = -v;

        const denom = 1.0 / (u + v + w);

        _au.copy(corners[0]).mulScalar(u * denom);
        _bv.copy(corners[3]).mulScalar(v * denom);
        _cw.copy(corners[2]).mulScalar(w * denom);
        _ir.copy(_au).add(_bv).add(_cw);
    }

    // The algorithm above doesn't work if all the corners are the same
    // So do that test here by checking if the diagonals are 0 (since these are rectangles we're checking against)
    if (_pq.sub2(corners[0], corners[2]).lengthSq() < 0.0001 * 0.0001) return -1;
    if (_pq.sub2(corners[1], corners[3]).lengthSq() < 0.0001 * 0.0001) return -1;

    return _ir.sub(p).lengthSq();
}

/**
 * Represents an input event fired on a {@link ElementComponent}. When an event is raised on an
 * ElementComponent it bubbles up to its parent ElementComponents unless we call stopPropagation().
 *
 * @category User Interface
 */
class ElementInputEvent {
    /**
     * Create a new ElementInputEvent instance.
     *
     * @param {import('../../platform/input/mouse-event.js').MouseEvent
     * |import('../../platform/input/touch-event.js').TouchEvent} event - MouseEvent or TouchEvent
     * that was originally raised.
     * @param {import('../components/element/component.js').ElementComponent} element - The
     * ElementComponent that this event was originally raised on.
     * @param {import('../components/camera/component.js').CameraComponent} camera - The
     * CameraComponent that this event was originally raised via.
     */
    constructor(event, element, camera) {
        /**
         * MouseEvent or TouchEvent that was originally raised.
         *
         * @type {import('../../platform/input/mouse-event.js').MouseEvent
         * |import('../../platform/input/touch-event.js').TouchEvent}
         */
        this.event = event;

        /**
         * The ElementComponent that this event was originally raised on.
         *
         * @type {import('../components/element/component.js').ElementComponent}
         */
        this.element = element;

        /**
         * The CameraComponent that this event was originally raised via.
         *
         * @type {import('../components/camera/component.js').CameraComponent}
         */
        this.camera = camera;

        this._stopPropagation = false;
    }

    /**
     * Stop propagation of the event to parent {@link ElementComponent}s. This also stops
     * propagation of the event to other event listeners of the original DOM Event.
     */
    stopPropagation() {
        this._stopPropagation = true;
        if (this.event) {
            this.event.stopImmediatePropagation();
            this.event.stopPropagation();
        }
    }
}

/**
 * Represents a Mouse event fired on a {@link ElementComponent}.
 *
 * @category User Interface
 */
class ElementMouseEvent extends ElementInputEvent {
    /**
     * Create an instance of an ElementMouseEvent.
     *
     * @param {import('../../platform/input/mouse-event.js').MouseEvent} event - The MouseEvent that
     * was originally raised.
     * @param {import('../components/element/component.js').ElementComponent} element - The
     * ElementComponent that this event was originally raised on.
     * @param {import('../components/camera/component.js').CameraComponent} camera - The
     * CameraComponent that this event was originally raised via.
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} lastX - The last x coordinate.
     * @param {number} lastY - The last y coordinate.
     */
    constructor(event, element, camera, x, y, lastX, lastY) {
        super(event, element, camera);

        this.x = x;
        this.y = y;

        /**
         * Whether the ctrl key was pressed.
         *
         * @type {boolean}
         */
        this.ctrlKey = event.ctrlKey || false;
        /**
         * Whether the alt key was pressed.
         *
         * @type {boolean}
         */
        this.altKey = event.altKey || false;
        /**
         * Whether the shift key was pressed.
         *
         * @type {boolean}
         */
        this.shiftKey = event.shiftKey || false;
        /**
         * Whether the meta key was pressed.
         *
         * @type {boolean}
         */
        this.metaKey = event.metaKey || false;

        /**
         * The mouse button.
         *
         * @type {number}
         */
        this.button = event.button;

        if (Mouse.isPointerLocked()) {
            /**
             * The amount of horizontal movement of the cursor.
             *
             * @type {number}
             */
            this.dx = event.movementX || event.webkitMovementX || event.mozMovementX || 0;
            /**
             * The amount of vertical movement of the cursor.
             *
             * @type {number}
             */
            this.dy = event.movementY || event.webkitMovementY || event.mozMovementY || 0;
        } else {
            this.dx = x - lastX;
            this.dy = y - lastY;
        }

        /**
         * The amount of the wheel movement.
         *
         * @type {number}
         */
        this.wheelDelta = 0;

        // deltaY is in a different range across different browsers. The only thing
        // that is consistent is the sign of the value so snap to -1/+1.
        if (event.type === 'wheel') {
            if (event.deltaY > 0) {
                this.wheelDelta = 1;
            } else if (event.deltaY < 0) {
                this.wheelDelta = -1;
            }
        }
    }
}

/**
 * Represents a TouchEvent fired on a {@link ElementComponent}.
 *
 * @category User Interface
 */
class ElementTouchEvent extends ElementInputEvent {
    /**
     * Create an instance of an ElementTouchEvent.
     *
     * @param {import('../../platform/input/touch-event.js').TouchEvent} event - The TouchEvent that was originally raised.
     * @param {import('../components/element/component.js').ElementComponent} element - The
     * ElementComponent that this event was originally raised on.
     * @param {import('../components/camera/component.js').CameraComponent} camera - The
     * CameraComponent that this event was originally raised via.
     * @param {number} x - The x coordinate of the touch that triggered the event.
     * @param {number} y - The y coordinate of the touch that triggered the event.
     * @param {import('../../platform/input/touch-event.js').Touch} touch - The touch object that triggered the event.
     */
    constructor(event, element, camera, x, y, touch) {
        super(event, element, camera);

        /**
         * The Touch objects representing all current points of contact with the surface,
         * regardless of target or changed status.
         *
         * @type {import('../../platform/input/touch-event.js').Touch[]}
         */
        this.touches = event.touches;
        /**
         * The Touch objects representing individual points of contact whose states changed between
         * the previous touch event and this one.
         *
         * @type {import('../../platform/input/touch-event.js').Touch[]}
         */
        this.changedTouches = event.changedTouches;
        this.x = x;
        this.y = y;
        /**
         * The touch object that triggered the event.
         *
         * @type {import('../../platform/input/touch-event.js').Touch}
         */
        this.touch = touch;
    }
}

/**
 * Represents a XRInputSourceEvent fired on a {@link ElementComponent}.
 *
 * @category User Interface
 */
class ElementSelectEvent extends ElementInputEvent {
    /**
     * Create an instance of a ElementSelectEvent.
     *
     * @param {XRInputSourceEvent} event - The XRInputSourceEvent that was originally raised.
     * @param {import('../components/element/component.js').ElementComponent} element - The
     * ElementComponent that this event was originally raised on.
     * @param {import('../components/camera/component.js').CameraComponent} camera - The
     * CameraComponent that this event was originally raised via.
     * @param {import('../xr/xr-input-source.js').XrInputSource} inputSource - The XR input source
     * that this event was originally raised from.
     */
    constructor(event, element, camera, inputSource) {
        super(event, element, camera);

        /**
         * The XR input source that this event was originally raised from.
         *
         * @type {import('../xr/xr-input-source.js').XrInputSource}
         */
        this.inputSource = inputSource;
    }
}

/**
 * Handles mouse and touch events for {@link ElementComponent}s. When input events occur on an
 * ElementComponent this fires the appropriate events on the ElementComponent.
 *
 * @category User Interface
 */
class ElementInput {
    /**
     * Create a new ElementInput instance.
     *
     * @param {Element} domElement - The DOM element.
     * @param {object} [options] - Optional arguments.
     * @param {boolean} [options.useMouse] - Whether to allow mouse input. Defaults to true.
     * @param {boolean} [options.useTouch] - Whether to allow touch input. Defaults to true.
     * @param {boolean} [options.useXr] - Whether to allow XR input sources. Defaults to true.
     */
    constructor(domElement, options) {
        this._app = null;
        this._attached = false;
        this._target = null;

        // force disable all element input events
        this._enabled = true;

        this._lastX = 0;
        this._lastY = 0;

        this._upHandler = this._handleUp.bind(this);
        this._downHandler = this._handleDown.bind(this);
        this._moveHandler = this._handleMove.bind(this);
        this._wheelHandler = this._handleWheel.bind(this);
        this._touchstartHandler = this._handleTouchStart.bind(this);
        this._touchendHandler = this._handleTouchEnd.bind(this);
        this._touchcancelHandler = this._touchendHandler;
        this._touchmoveHandler = this._handleTouchMove.bind(this);
        this._sortHandler = this._sortElements.bind(this);

        this._elements = [];
        this._hoveredElement = null;
        this._pressedElement = null;
        this._touchedElements = {};
        this._touchesForWhichTouchLeaveHasFired = {};
        this._selectedElements = {};
        this._selectedPressedElements = {};

        this._useMouse = !options || options.useMouse !== false;
        this._useTouch = !options || options.useTouch !== false;
        this._useXr = !options || options.useXr !== false;
        this._selectEventsAttached = false;

        if (platform.touch)
            this._clickedEntities = {};

        this.attach(domElement);
    }

    set enabled(value) {
        this._enabled = value;
    }

    get enabled() {
        return this._enabled;
    }

    set app(value) {
        this._app = value;
    }

    get app() {
        return this._app || getApplication();
    }

    /**
     * Attach mouse and touch events to a DOM element.
     *
     * @param {Element} domElement - The DOM element.
     */
    attach(domElement) {
        if (this._attached) {
            this._attached = false;
            this.detach();
        }

        this._target = domElement;
        this._attached = true;

        const opts = platform.passiveEvents ? { passive: true } : false;
        if (this._useMouse) {
            window.addEventListener('mouseup', this._upHandler, opts);
            window.addEventListener('mousedown', this._downHandler, opts);
            window.addEventListener('mousemove', this._moveHandler, opts);
            window.addEventListener('wheel', this._wheelHandler, opts);
        }

        if (this._useTouch && platform.touch) {
            this._target.addEventListener('touchstart', this._touchstartHandler, opts);
            // Passive is not used for the touchend event because some components need to be
            // able to call preventDefault(). See notes in button/component.js for more details.
            this._target.addEventListener('touchend', this._touchendHandler, false);
            this._target.addEventListener('touchmove', this._touchmoveHandler, false);
            this._target.addEventListener('touchcancel', this._touchcancelHandler, false);
        }

        this.attachSelectEvents();
    }

    attachSelectEvents() {
        if (!this._selectEventsAttached && this._useXr && this.app && this.app.xr && this.app.xr.supported) {
            if (!this._clickedEntities)
                this._clickedEntities = {};

            this._selectEventsAttached = true;
            this.app.xr.on('start', this._onXrStart, this);
        }
    }

    /**
     * Remove mouse and touch events from the DOM element that it is attached to.
     */
    detach() {
        if (!this._attached) return;
        this._attached = false;

        const opts = platform.passiveEvents ? { passive: true } : false;
        if (this._useMouse) {
            window.removeEventListener('mouseup', this._upHandler, opts);
            window.removeEventListener('mousedown', this._downHandler, opts);
            window.removeEventListener('mousemove', this._moveHandler, opts);
            window.removeEventListener('wheel', this._wheelHandler, opts);
        }

        if (this._useTouch) {
            this._target.removeEventListener('touchstart', this._touchstartHandler, opts);
            this._target.removeEventListener('touchend', this._touchendHandler, false);
            this._target.removeEventListener('touchmove', this._touchmoveHandler, false);
            this._target.removeEventListener('touchcancel', this._touchcancelHandler, false);
        }

        if (this._selectEventsAttached) {
            this._selectEventsAttached = false;
            this.app.xr.off('start', this._onXrStart, this);
            this.app.xr.off('end', this._onXrEnd, this);
            this.app.xr.off('update', this._onXrUpdate, this);
            this.app.xr.input.off('selectstart', this._onSelectStart, this);
            this.app.xr.input.off('selectend', this._onSelectEnd, this);
            this.app.xr.input.off('remove', this._onXrInputRemove, this);
        }

        this._target = null;
    }

    /**
     * Add a {@link ElementComponent} to the internal list of ElementComponents that are being
     * checked for input.
     *
     * @param {import('../components/element/component.js').ElementComponent} element - The
     * ElementComponent.
     */
    addElement(element) {
        if (this._elements.indexOf(element) === -1)
            this._elements.push(element);
    }

    /**
     * Remove a {@link ElementComponent} from the internal list of ElementComponents that are being
     * checked for input.
     *
     * @param {import('../components/element/component.js').ElementComponent} element - The
     * ElementComponent.
     */
    removeElement(element) {
        const idx = this._elements.indexOf(element);
        if (idx !== -1)
            this._elements.splice(idx, 1);
    }

    _handleUp(event) {
        if (!this._enabled) return;

        if (Mouse.isPointerLocked())
            return;

        this._calcMouseCoords(event);

        this._onElementMouseEvent('mouseup', event);
    }

    _handleDown(event) {
        if (!this._enabled) return;

        if (Mouse.isPointerLocked())
            return;

        this._calcMouseCoords(event);

        this._onElementMouseEvent('mousedown', event);
    }

    _handleMove(event) {
        if (!this._enabled) return;

        this._calcMouseCoords(event);

        this._onElementMouseEvent('mousemove', event);

        this._lastX = targetX;
        this._lastY = targetY;
    }

    _handleWheel(event) {
        if (!this._enabled) return;

        this._calcMouseCoords(event);

        this._onElementMouseEvent('mousewheel', event);
    }

    _determineTouchedElements(event) {
        const touchedElements = {};
        const cameras = this.app.systems.camera.cameras;

        // check cameras from last to front
        // so that elements that are drawn above others
        // receive events first
        for (let i = cameras.length - 1; i >= 0; i--) {
            const camera = cameras[i];

            let done = 0;
            const len = event.changedTouches.length;
            for (let j = 0; j < len; j++) {
                if (touchedElements[event.changedTouches[j].identifier]) {
                    done++;
                    continue;
                }

                const coords = this._calcTouchCoords(event.changedTouches[j]);

                const element = this._getTargetElementByCoords(camera, coords.x, coords.y);
                if (element) {
                    done++;
                    touchedElements[event.changedTouches[j].identifier] = {
                        element: element,
                        camera: camera,
                        x: coords.x,
                        y: coords.y
                    };
                }
            }

            if (done === len) {
                break;
            }
        }

        return touchedElements;
    }

    _handleTouchStart(event) {
        if (!this._enabled) return;

        const newTouchedElements = this._determineTouchedElements(event);

        for (let i = 0, len = event.changedTouches.length; i < len; i++) {
            const touch = event.changedTouches[i];
            const newTouchInfo = newTouchedElements[touch.identifier];
            const oldTouchInfo = this._touchedElements[touch.identifier];

            if (newTouchInfo && (!oldTouchInfo || newTouchInfo.element !== oldTouchInfo.element)) {
                this._fireEvent(event.type, new ElementTouchEvent(event, newTouchInfo.element, newTouchInfo.camera, newTouchInfo.x, newTouchInfo.y, touch));
                this._touchesForWhichTouchLeaveHasFired[touch.identifier] = false;
            }
        }

        for (const touchId in newTouchedElements) {
            this._touchedElements[touchId] = newTouchedElements[touchId];
        }
    }

    _handleTouchEnd(event) {
        if (!this._enabled) return;

        const cameras = this.app.systems.camera.cameras;

        // clear clicked entities first then store each clicked entity
        // in _clickedEntities so that we don't fire another click
        // on it in this handler or in the mouseup handler which is
        // fired later
        for (const key in this._clickedEntities) {
            delete this._clickedEntities[key];
        }

        for (let i = 0, len = event.changedTouches.length; i < len; i++) {
            const touch = event.changedTouches[i];
            const touchInfo = this._touchedElements[touch.identifier];
            if (!touchInfo)
                continue;

            const element = touchInfo.element;
            const camera = touchInfo.camera;
            const x = touchInfo.x;
            const y = touchInfo.y;

            delete this._touchedElements[touch.identifier];
            delete this._touchesForWhichTouchLeaveHasFired[touch.identifier];

            // check if touch was released over previously touch
            // element in order to fire click event
            const coords = this._calcTouchCoords(touch);

            for (let c = cameras.length - 1; c >= 0; c--) {
                const hovered = this._getTargetElementByCoords(cameras[c], coords.x, coords.y);
                if (hovered === element) {

                    if (!this._clickedEntities[element.entity.getGuid()]) {
                        this._fireEvent('click', new ElementTouchEvent(event, element, camera, x, y, touch));
                        this._clickedEntities[element.entity.getGuid()] = Date.now();
                    }

                }
            }

            this._fireEvent(event.type, new ElementTouchEvent(event, element, camera, x, y, touch));
        }
    }

    _handleTouchMove(event) {
        // call preventDefault to avoid issues in Chrome Android:
        // http://wilsonpage.co.uk/touch-events-in-chrome-android/
        event.preventDefault();

        if (!this._enabled) return;

        const newTouchedElements = this._determineTouchedElements(event);

        for (let i = 0, len = event.changedTouches.length; i < len; i++) {
            const touch = event.changedTouches[i];
            const newTouchInfo = newTouchedElements[touch.identifier];
            const oldTouchInfo = this._touchedElements[touch.identifier];

            if (oldTouchInfo) {
                const coords = this._calcTouchCoords(touch);

                // Fire touchleave if we've left the previously touched element
                if ((!newTouchInfo || newTouchInfo.element !== oldTouchInfo.element) && !this._touchesForWhichTouchLeaveHasFired[touch.identifier]) {
                    this._fireEvent('touchleave', new ElementTouchEvent(event, oldTouchInfo.element, oldTouchInfo.camera, coords.x, coords.y, touch));

                    // Flag that touchleave has been fired for this touch, so that we don't
                    // re-fire it on the next touchmove. This is required because touchmove
                    // events keep on firing for the same element until the touch ends, even
                    // if the touch position moves away from the element. Touchleave, on the
                    // other hand, should fire once when the touch position moves away from
                    // the element and then not re-fire again within the same touch session.
                    this._touchesForWhichTouchLeaveHasFired[touch.identifier] = true;
                }

                this._fireEvent('touchmove', new ElementTouchEvent(event, oldTouchInfo.element, oldTouchInfo.camera, coords.x, coords.y, touch));
            }
        }
    }

    _onElementMouseEvent(eventType, event) {
        let element = null;

        const lastHovered = this._hoveredElement;
        this._hoveredElement = null;

        const cameras = this.app.systems.camera.cameras;
        let camera;

        // check cameras from last to front
        // so that elements that are drawn above others
        // receive events first
        for (let i = cameras.length - 1; i >= 0; i--) {
            camera = cameras[i];

            element = this._getTargetElementByCoords(camera, targetX, targetY);
            if (element)
                break;
        }

        // currently hovered element is whatever's being pointed by mouse (which may be null)
        this._hoveredElement = element;

        // if there was a pressed element, it takes full priority of 'move' and 'up' events
        if ((eventType === 'mousemove' || eventType === 'mouseup') && this._pressedElement) {
            this._fireEvent(eventType, new ElementMouseEvent(event, this._pressedElement, camera, targetX, targetY, this._lastX, this._lastY));
        } else if (element) {
            // otherwise, fire it to the currently hovered event
            this._fireEvent(eventType, new ElementMouseEvent(event, element, camera, targetX, targetY, this._lastX, this._lastY));

            if (eventType === 'mousedown') {
                this._pressedElement = element;
            }
        }

        if (lastHovered !== this._hoveredElement) {
            // mouseleave event
            if (lastHovered) {
                this._fireEvent('mouseleave', new ElementMouseEvent(event, lastHovered, camera, targetX, targetY, this._lastX, this._lastY));
            }

            // mouseenter event
            if (this._hoveredElement) {
                this._fireEvent('mouseenter', new ElementMouseEvent(event, this._hoveredElement, camera, targetX, targetY, this._lastX, this._lastY));
            }
        }

        if (eventType === 'mouseup' && this._pressedElement) {
            // click event
            if (this._pressedElement === this._hoveredElement) {
                // fire click event if it hasn't been fired already by the touchend handler
                const guid = this._hoveredElement.entity.getGuid();
                // Always fire, if there are no clicked entities
                let fireClick = !this._clickedEntities;
                // But if there are, we need to check how long ago touchend added a "click brake"
                if (this._clickedEntities) {
                    const lastTouchUp = this._clickedEntities[guid] || 0;
                    const dt = Date.now() - lastTouchUp;
                    fireClick = dt > 300;

                    // We do not check another time, so the worst thing that can happen is one ignored click in 300ms.
                    delete this._clickedEntities[guid];
                }
                if (fireClick) {
                    this._fireEvent('click', new ElementMouseEvent(event, this._hoveredElement, camera, targetX, targetY, this._lastX, this._lastY));
                }
            }
            this._pressedElement = null;
        }
    }

    _onXrStart() {
        this.app.xr.on('end', this._onXrEnd, this);
        this.app.xr.on('update', this._onXrUpdate, this);
        this.app.xr.input.on('selectstart', this._onSelectStart, this);
        this.app.xr.input.on('selectend', this._onSelectEnd, this);
        this.app.xr.input.on('remove', this._onXrInputRemove, this);
    }

    _onXrEnd() {
        this.app.xr.off('update', this._onXrUpdate, this);
        this.app.xr.input.off('selectstart', this._onSelectStart, this);
        this.app.xr.input.off('selectend', this._onSelectEnd, this);
        this.app.xr.input.off('remove', this._onXrInputRemove, this);
    }

    _onXrUpdate() {
        if (!this._enabled) return;

        const inputSources = this.app.xr.input.inputSources;
        for (let i = 0; i < inputSources.length; i++) {
            this._onElementSelectEvent('selectmove', inputSources[i], null);
        }
    }

    _onXrInputRemove(inputSource) {
        const hovered = this._selectedElements[inputSource.id];
        if (hovered) {
            inputSource._elementEntity = null;
            this._fireEvent('selectleave', new ElementSelectEvent(null, hovered, null, inputSource));
        }

        delete this._selectedElements[inputSource.id];
        delete this._selectedPressedElements[inputSource.id];
    }

    _onSelectStart(inputSource, event) {
        if (!this._enabled) return;
        this._onElementSelectEvent('selectstart', inputSource, event);
    }

    _onSelectEnd(inputSource, event) {
        if (!this._enabled) return;
        this._onElementSelectEvent('selectend', inputSource, event);
    }

    _onElementSelectEvent(eventType, inputSource, event) {
        let element;

        const hoveredBefore = this._selectedElements[inputSource.id];
        let hoveredNow;

        const cameras = this.app.systems.camera.cameras;
        let camera;

        if (inputSource.elementInput) {
            rayC.set(inputSource.getOrigin(), inputSource.getDirection());

            for (let i = cameras.length - 1; i >= 0; i--) {
                camera = cameras[i];

                element = this._getTargetElementByRay(rayC, camera);
                if (element)
                    break;
            }
        }

        inputSource._elementEntity = element || null;

        if (element) {
            this._selectedElements[inputSource.id] = element;
            hoveredNow = element;
        } else {
            delete this._selectedElements[inputSource.id];
        }

        if (hoveredBefore !== hoveredNow) {
            if (hoveredBefore) this._fireEvent('selectleave', new ElementSelectEvent(event, hoveredBefore, camera, inputSource));
            if (hoveredNow) this._fireEvent('selectenter', new ElementSelectEvent(event, hoveredNow, camera, inputSource));
        }

        const pressed = this._selectedPressedElements[inputSource.id];
        if (eventType === 'selectmove' && pressed) {
            this._fireEvent('selectmove', new ElementSelectEvent(event, pressed, camera, inputSource));
        }

        if (eventType === 'selectstart') {
            this._selectedPressedElements[inputSource.id] = hoveredNow;
            if (hoveredNow) this._fireEvent('selectstart', new ElementSelectEvent(event, hoveredNow, camera, inputSource));
        }

        if (!inputSource.elementInput && pressed) {
            delete this._selectedPressedElements[inputSource.id];
            if (hoveredBefore) {
                this._fireEvent('selectend', new ElementSelectEvent(event, pressed, camera, inputSource));
            }
        }

        if (eventType === 'selectend' && inputSource.elementInput) {
            delete this._selectedPressedElements[inputSource.id];

            if (pressed) {
                this._fireEvent('selectend', new ElementSelectEvent(event, pressed, camera, inputSource));
            }

            if (pressed && pressed === hoveredBefore) {
                this._fireEvent('click', new ElementSelectEvent(event, pressed, camera, inputSource));
            }
        }
    }

    _fireEvent(name, evt) {
        let element = evt.element;
        while (true) {
            element.fire(name, evt);
            if (evt._stopPropagation)
                break;

            if (!element.entity.parent)
                break;

            element = element.entity.parent.element;
            if (!element)
                break;
        }
    }

    _calcMouseCoords(event) {
        const rect = this._target.getBoundingClientRect();
        const left = Math.floor(rect.left);
        const top = Math.floor(rect.top);
        targetX = (event.clientX - left);
        targetY = (event.clientY - top);
    }

    _calcTouchCoords(touch) {
        let totalOffsetX = 0;
        let totalOffsetY = 0;
        let target = touch.target;
        while (!(target instanceof HTMLElement)) {
            target = target.parentNode;
        }
        let currentElement = target;

        do {
            totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
            totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
            currentElement = currentElement.offsetParent;
        } while (currentElement);

        // calculate coords and scale them to the graphicsDevice size
        return {
            x: (touch.pageX - totalOffsetX),
            y: (touch.pageY - totalOffsetY)
        };
    }

    _sortElements(a, b) {
        const layerOrder = this.app.scene.layers.sortTransparentLayers(a.layers, b.layers);
        if (layerOrder !== 0) return layerOrder;

        if (a.screen && !b.screen)
            return -1;
        if (!a.screen && b.screen)
            return 1;
        if (!a.screen && !b.screen)
            return 0;

        if (a.screen.screen.screenSpace && !b.screen.screen.screenSpace)
            return -1;
        if (b.screen.screen.screenSpace && !a.screen.screen.screenSpace)
            return 1;
        return b.drawOrder - a.drawOrder;
    }

    _getTargetElementByCoords(camera, x, y) {
        // calculate screen-space and 3d-space rays
        const rayScreen = this._calculateRayScreen(x, y, camera, rayA) ? rayA : null;
        const ray3d = this._calculateRay3d(x, y, camera, rayB) ? rayB : null;

        return this._getTargetElement(camera, rayScreen, ray3d);
    }

    _getTargetElementByRay(ray, camera) {
        // 3d ray is copied from input ray
        rayA.origin.copy(ray.origin);
        rayA.direction.copy(ray.direction);
        rayA.end.copy(rayA.direction).mulScalar(camera.farClip * 2).add(rayA.origin);
        const ray3d = rayA;

        // screen-space ray is built from input ray's origin, converted to screen-space
        const screenPos = camera.worldToScreen(ray3d.origin, vecA);
        const rayScreen = this._calculateRayScreen(screenPos.x, screenPos.y, camera, rayB) ? rayB : null;

        return this._getTargetElement(camera, rayScreen, ray3d);
    }

    _getTargetElement(camera, rayScreen, ray3d) {
        let result = null;
        let closestDistance3d = Infinity;

        // sort elements based on layers and draw order
        this._elements.sort(this._sortHandler);

        for (let i = 0, len = this._elements.length; i < len; i++) {
            const element = this._elements[i];

            // check if any of the layers this element renders to is being rendered by the camera
            if (!element.layers.some(v => camera.layersSet.has(v))) {
                continue;
            }

            if (element.screen && element.screen.screen.screenSpace) {
                if (!rayScreen) {
                    continue;
                }

                // 2d screen elements take precedence - if hit, immediately return
                const currentDistance = this._checkElement(rayScreen, element, true);
                if (currentDistance >= 0) {
                    result = element;
                    break;
                }
            } else {
                if (!ray3d) {
                    continue;
                }

                const currentDistance = this._checkElement(ray3d, element, false);
                if (currentDistance >= 0) {
                    // store the closest one in world space
                    if (currentDistance < closestDistance3d) {
                        result = element;
                        closestDistance3d = currentDistance;
                    }

                    // if the element is on a Screen, it takes precedence
                    if (element.screen) {
                        result = element;
                        break;
                    }
                }
            }
        }

        return result;
    }

    _calculateRayScreen(x, y, camera, ray) {
        const sw = this.app.graphicsDevice.width;
        const sh = this.app.graphicsDevice.height;

        const cameraWidth = camera.rect.z * sw;
        const cameraHeight = camera.rect.w * sh;
        const cameraLeft = camera.rect.x * sw;
        const cameraRight = cameraLeft + cameraWidth;
        // camera bottom (origin is bottom left of window)
        const cameraBottom = (1 - camera.rect.y) * sh;
        const cameraTop = cameraBottom - cameraHeight;

        let _x = x * sw / this._target.clientWidth;
        let _y = y * sh / this._target.clientHeight;

        if (_x >= cameraLeft && _x <= cameraRight &&
            _y <= cameraBottom && _y >= cameraTop) {

            // limit window coords to camera rect coords
            _x = sw * (_x - cameraLeft) / cameraWidth;
            _y = sh * (_y - cameraTop) / cameraHeight;

            // reverse _y
            _y = sh - _y;

            ray.origin.set(_x, _y, 1);
            ray.direction.set(0, 0, -1);
            ray.end.copy(ray.direction).mulScalar(2).add(ray.origin);

            return true;
        }
        return false;
    }

    _calculateRay3d(x, y, camera, ray) {
        const sw = this._target.clientWidth;
        const sh = this._target.clientHeight;

        const cameraWidth = camera.rect.z * sw;
        const cameraHeight = camera.rect.w * sh;
        const cameraLeft = camera.rect.x * sw;
        const cameraRight = cameraLeft + cameraWidth;
        // camera bottom - origin is bottom left of window
        const cameraBottom = (1 - camera.rect.y) * sh;
        const cameraTop = cameraBottom - cameraHeight;

        let _x = x;
        let _y = y;

        // check window coords are within camera rect
        if (x >= cameraLeft && x <= cameraRight &&
            y <= cameraBottom && _y >= cameraTop) {

            // limit window coords to camera rect coords
            _x = sw * (_x - cameraLeft) / cameraWidth;
            _y = sh * (_y - (cameraTop)) / cameraHeight;

            // 3D screen
            camera.screenToWorld(_x, _y, camera.nearClip, vecA);
            camera.screenToWorld(_x, _y, camera.farClip, vecB);

            ray.origin.copy(vecA);
            ray.direction.set(0, 0, -1);
            ray.end.copy(vecB);

            return true;
        }
        return false;
    }

    _checkElement(ray, element, screen) {
        // ensure click is contained by any mask first
        if (element.maskedBy) {
            if (this._checkElement(ray, element.maskedBy.element, screen) < 0) {
                return -1;
            }
        }

        let scale;
        if (screen) {
            scale = ElementInput.calculateScaleToScreen(element);
        } else {
            scale = ElementInput.calculateScaleToWorld(element);
        }

        const corners = ElementInput.buildHitCorners(element, screen ? element.screenCorners : element.worldCorners, scale);

        return intersectLineQuad(ray.origin, ray.end, corners);
    }

    // In most cases the corners used for hit testing will just be the element's
    // screen corners. However, in cases where the element has additional hit
    // padding specified, we need to expand the screenCorners to incorporate the
    // padding.
    // NOTE: Used by Editor for visualization in the viewport
    static buildHitCorners(element, screenOrWorldCorners, scale) {
        let hitCorners = screenOrWorldCorners;
        const button = element.entity && element.entity.button;

        if (button) {
            const hitPadding = element.entity.button.hitPadding || ZERO_VEC4;

            _paddingTop.copy(element.entity.up);
            _paddingBottom.copy(_paddingTop).mulScalar(-1);
            _paddingRight.copy(element.entity.right);
            _paddingLeft.copy(_paddingRight).mulScalar(-1);

            _paddingTop.mulScalar(hitPadding.w * scale.y);
            _paddingBottom.mulScalar(hitPadding.y * scale.y);
            _paddingRight.mulScalar(hitPadding.z * scale.x);
            _paddingLeft.mulScalar(hitPadding.x * scale.x);

            _cornerBottomLeft.copy(hitCorners[0]).add(_paddingBottom).add(_paddingLeft);
            _cornerBottomRight.copy(hitCorners[1]).add(_paddingBottom).add(_paddingRight);
            _cornerTopRight.copy(hitCorners[2]).add(_paddingTop).add(_paddingRight);
            _cornerTopLeft.copy(hitCorners[3]).add(_paddingTop).add(_paddingLeft);

            hitCorners = [_cornerBottomLeft, _cornerBottomRight, _cornerTopRight, _cornerTopLeft];
        }

        // make sure the corners are in the right order [bl, br, tr, tl]
        // for x and y: simply invert what is considered "left/right" and "top/bottom"
        if (scale.x < 0) {
            const left = hitCorners[2].x;
            const right = hitCorners[0].x;
            hitCorners[0].x = left;
            hitCorners[1].x = right;
            hitCorners[2].x = right;
            hitCorners[3].x = left;
        }
        if (scale.y < 0) {
            const bottom = hitCorners[2].y;
            const top = hitCorners[0].y;
            hitCorners[0].y = bottom;
            hitCorners[1].y = bottom;
            hitCorners[2].y = top;
            hitCorners[3].y = top;
        }
        // if z is inverted, entire element is inverted, so flip it around by swapping corner points 2 and 0
        if (scale.z < 0) {
            const x = hitCorners[2].x;
            const y = hitCorners[2].y;
            const z = hitCorners[2].z;

            hitCorners[2].x = hitCorners[0].x;
            hitCorners[2].y = hitCorners[0].y;
            hitCorners[2].z = hitCorners[0].z;
            hitCorners[0].x = x;
            hitCorners[0].y = y;
            hitCorners[0].z = z;
        }

        return hitCorners;
    }

    // NOTE: Used by Editor for visualization in the viewport
    static calculateScaleToScreen(element) {
        let current = element.entity;
        const screenScale = element.screen.screen.scale;

        _accumulatedScale.set(screenScale, screenScale, screenScale);

        while (current && !current.screen) {
            _accumulatedScale.mul(current.getLocalScale());
            current = current.parent;
        }

        return _accumulatedScale;
    }

    // NOTE: Used by Editor for visualization in the viewport
    static calculateScaleToWorld(element) {
        let current = element.entity;
        _accumulatedScale.set(1, 1, 1);

        while (current) {
            _accumulatedScale.mul(current.getLocalScale());
            current = current.parent;
        }

        return _accumulatedScale;
    }
}

export { ElementInput, ElementInputEvent, ElementMouseEvent, ElementSelectEvent, ElementTouchEvent };
