import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { Ray } from '../../core/shape/ray.js';
import { Mouse } from '../../platform/input/mouse.js';
import { Touch } from '../../platform/input/touch-event.js';
import { getApplication } from '../globals.js';

/**
 * @import { ButtonComponent } from '../components/button/component.js'
 * @import { CameraComponent } from '../components/camera/component.js'
 * @import { ElementComponent } from '../components/element/component.js'
 * @import { XrInputSource } from '../xr/xr-input-source.js'
 */

// furthest a touch or pen may move, in CSS pixels, and still count as a tap
const TAP_SLOP = 10;

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
        if (u < 0) {
            return -1;
        }

        w = scalarTriple(_pq, _pb, _pa);
        if (w < 0) {
            return -1;
        }

        const denom = 1.0 / (u + v + w);

        _au.copy(corners[0]).mulScalar(u * denom);
        _bv.copy(corners[1]).mulScalar(v * denom);
        _cw.copy(corners[2]).mulScalar(w * denom);
        _ir.copy(_au).add(_bv).add(_cw);
    } else {
        // Test intersection against triangle dac
        _pd.sub2(corners[3], p);
        u = _pd.dot(_m);
        if (u < 0) {
            return -1;
        }

        w = scalarTriple(_pq, _pa, _pd);
        if (w < 0) {
            return -1;
        }

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
     * @param {globalThis.PointerEvent|globalThis.WheelEvent|XRInputSourceEvent|null} event - The
     * browser event that was originally raised, or null if there was none.
     * @param {ElementComponent} element - The ElementComponent that this event was originally
     * raised on.
     * @param {CameraComponent} camera - The CameraComponent that this event was originally raised
     * via.
     */
    constructor(event, element, camera) {
        /**
         * The browser event that was originally raised: a PointerEvent, WheelEvent or
         * XRInputSourceEvent. It is null when no browser event caused this one, as for
         * `selectmove`.
         *
         * @type {globalThis.PointerEvent|globalThis.WheelEvent|XRInputSourceEvent|null}
         */
        this.event = event;

        /**
         * The ElementComponent that this event was originally raised on.
         *
         * @type {ElementComponent}
         */
        this.element = element;

        /**
         * The CameraComponent that this event was originally raised via.
         *
         * @type {CameraComponent}
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
     * @param {globalThis.PointerEvent|globalThis.WheelEvent} event - The browser PointerEvent or
     * WheelEvent that was originally raised.
     * @param {ElementComponent} element - The
     * ElementComponent that this event was originally raised on.
     * @param {CameraComponent} camera - The
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
 * Represents a TouchEvent fired on a {@link ElementComponent}. It carries the browser
 * PointerEvent of the touch, and a {@link Touch} for each active touch, whose coordinates are
 * relative to the element the touch started on.
 *
 * @category User Interface
 */
class ElementTouchEvent extends ElementInputEvent {
    /**
     * Create an instance of an ElementTouchEvent.
     *
     * @param {globalThis.PointerEvent} event - The browser PointerEvent that was originally
     * raised.
     * @param {ElementComponent} element - The
     * ElementComponent that this event was originally raised on.
     * @param {CameraComponent} camera - The
     * CameraComponent that this event was originally raised via.
     * @param {number} x - The x coordinate of the touch that triggered the event.
     * @param {number} y - The y coordinate of the touch that triggered the event.
     * @param {Touch} touch - The Touch that triggered the event.
     * @param {Touch[]} [touches] - All active touches. Defaults to the touch that triggered the
     * event.
     */
    constructor(event, element, camera, x, y, touch, touches = [touch]) {
        super(event, element, camera);

        /**
         * The Touch objects representing all active points of contact with the element, regardless
         * of changed status. A touch that ended is no longer in the list.
         *
         * @type {Touch[]}
         */
        this.touches = touches;
        /**
         * The Touch objects representing the points of contact whose states changed: the one
         * touch that triggered the event.
         *
         * @type {Touch[]}
         */
        this.changedTouches = [touch];
        this.x = x;
        this.y = y;
        /**
         * The Touch that triggered the event. Match a touch across events by its `id`.
         *
         * @type {Touch}
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
     * Create an instance of an ElementSelectEvent.
     *
     * @param {XRInputSourceEvent|null} event - The XRInputSourceEvent that was originally raised,
     * or null if there was none.
     * @param {ElementComponent} element - The
     * ElementComponent that this event was originally raised on.
     * @param {CameraComponent} camera - The
     * CameraComponent that this event was originally raised via.
     * @param {XrInputSource} inputSource - The XR input source
     * that this event was originally raised from.
     */
    constructor(event, element, camera, inputSource) {
        super(event, element, camera);

        /**
         * The XR input source that this event was originally raised from.
         *
         * @type {XrInputSource}
         */
        this.inputSource = inputSource;
    }
}

/**
 * Handles mouse and touch events for {@link ElementComponent}s. When input events occur on an
 * ElementComponent this fires the appropriate events on the ElementComponent.
 *
 * Events are driven by pointer events: mouse pointers fire the mouse events, and touch and pen
 * pointers fire the touch events. As browsers' compatibility mouse events do, a tap (a primary
 * touch or pen that lifts within a few pixels of where it went down) is followed by `mousemove`,
 * `mousedown` and `mouseup`, unless a handler of its `touchend` calls `preventDefault()` on the
 * event's PointerEvent, as {@link ButtonComponent} does. The tap's `click` fires once.
 *
 * Relevant Engine API examples:
 *
 * - [Input events](https://playcanvas.github.io/#/user-interface/input-events)
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

        // the pointer id of a touch or pen that may still become a tap, or -1
        this._tapId = -1;
        this._tapX = 0;
        this._tapY = 0;

        // the `touch-action` style of the target before it was attached, restored on detach
        this._touchAction = '';

        this._upHandler = this._handlePointerUp.bind(this);
        this._downHandler = this._handlePointerDown.bind(this);
        this._moveHandler = this._handlePointerMove.bind(this);
        this._cancelHandler = this._handlePointerCancel.bind(this);
        this._wheelHandler = this._handleWheel.bind(this);
        this._touchstartHandler = this._handleTouchStart.bind(this);
        this._touchendHandler = e => this._handleTouchEnd(e, 'touchend');
        this._touchcancelHandler = e => this._handleTouchEnd(e, 'touchcancel');
        this._touchmoveHandler = this._handleTouchMove.bind(this);
        this._sortHandler = this._sortElements.bind(this);

        this._elements = [];
        this._hoveredElement = null;
        this._pressedElement = null;

        /**
         * The start target and latest pointer event of each active touch by pointer id, in the
         * order the touches started.
         *
         * @type {Map<number, { target: Element, event: globalThis.PointerEvent }>}
         * @private
         */
        this._touches = new Map();
        this._touchedElements = {};
        this._touchesForWhichTouchLeaveHasFired = {};
        this._selectedElements = {};
        this._selectedPressedElements = {};

        this._useMouse = !options || options.useMouse !== false;
        this._useTouch = !options || options.useTouch !== false;
        this._useXr = !options || options.useXr !== false;
        this._selectEventsAttached = false;

        if (this._useTouch) {
            this._clickedEntities = {};
        }

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
     * Attach mouse and touch events to a DOM element. Mouse pointer events are listened for on
     * the window, and touch and pen pointer events on the element, whose `touch-action` style is
     * `none` until it is detached so the browser does not scroll or zoom it.
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

        /** @type {AddEventListenerOptions} */
        const options = { passive: true };
        if (this._useMouse) {
            window.addEventListener('pointerup', this._upHandler, options);
            window.addEventListener('pointerdown', this._downHandler, options);
            window.addEventListener('pointermove', this._moveHandler, options);
            window.addEventListener('pointercancel', this._cancelHandler, options);
            window.addEventListener('wheel', this._wheelHandler, options);
        }

        if (this._useTouch) {
            // pointer events cannot prevent default scrolling and zooming, unlike touch events
            const style = /** @type {HTMLElement} */ (domElement).style;
            if (style) {
                this._touchAction = style.touchAction;
                style.touchAction = 'none';
            }

            this._target.addEventListener('pointerdown', this._touchstartHandler, options);
            // Passive is not used for the end events because some components need to be able to
            // call preventDefault(). See notes in button/component.js for more details.
            this._target.addEventListener('pointerup', this._touchendHandler, false);
            this._target.addEventListener('pointermove', this._touchmoveHandler, false);
            this._target.addEventListener('pointercancel', this._touchcancelHandler, false);
            this._target.addEventListener('pointerleave', this._touchendHandler, false);
        }

        this.attachSelectEvents();
    }

    attachSelectEvents() {
        if (!this._selectEventsAttached && this._useXr && this.app && this.app.xr && this.app.xr.supported) {
            if (!this._clickedEntities) {
                this._clickedEntities = {};
            }

            this._selectEventsAttached = true;
            this.app.xr.on('start', this._onXrStart, this);
        }
    }

    /**
     * Remove mouse and touch events from the DOM element that it is attached to, and restore its
     * `touch-action` style.
     */
    detach() {
        if (!this._attached) return;
        this._attached = false;

        /** @type {AddEventListenerOptions} */
        const options = { passive: true };
        if (this._useMouse) {
            window.removeEventListener('pointerup', this._upHandler, options);
            window.removeEventListener('pointerdown', this._downHandler, options);
            window.removeEventListener('pointermove', this._moveHandler, options);
            window.removeEventListener('pointercancel', this._cancelHandler, options);
            window.removeEventListener('wheel', this._wheelHandler, options);
        }

        if (this._useTouch) {
            this._target.removeEventListener('pointerdown', this._touchstartHandler, options);
            this._target.removeEventListener('pointerup', this._touchendHandler, false);
            this._target.removeEventListener('pointermove', this._touchmoveHandler, false);
            this._target.removeEventListener('pointercancel', this._touchcancelHandler, false);
            this._target.removeEventListener('pointerleave', this._touchendHandler, false);

            const style = /** @type {HTMLElement} */ (this._target).style;
            if (style) {
                style.touchAction = this._touchAction;
            }
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

        this._touches.clear();
        this._tapId = -1;
        this._target = null;
    }

    /**
     * Add a {@link ElementComponent} to the internal list of ElementComponents that are being
     * checked for input.
     *
     * @param {ElementComponent} element - The
     * ElementComponent.
     */
    addElement(element) {
        if (this._elements.indexOf(element) === -1) {
            this._elements.push(element);
        }
    }

    /**
     * Remove a {@link ElementComponent} from the internal list of ElementComponents that are being
     * checked for input.
     *
     * @param {ElementComponent} element - The
     * ElementComponent.
     */
    removeElement(element) {
        const idx = this._elements.indexOf(element);
        if (idx !== -1) {
            this._elements.splice(idx, 1);
        }
    }

    // touch and pen pointers reach the mouse path only as an emulated tap, as the browser's
    // compatibility mouse events did
    _handlePointerDown(event) {
        if (event.pointerType === 'mouse') {
            this._handleDown(event);
            return;
        }

        // a second finger cancels a pending tap
        this._tapId = event.isPrimary ? event.pointerId : -1;
        this._tapX = event.clientX;
        this._tapY = event.clientY;
    }

    _handlePointerMove(event) {
        if (event.pointerType === 'mouse') {
            this._handleMove(event);
            return;
        }

        if (event.pointerId === this._tapId && this._tapMoved(event)) {
            this._tapId = -1;
        }
    }

    _handlePointerUp(event) {
        if (event.pointerType === 'mouse') {
            this._handleUp(event);
            return;
        }

        if (event.pointerId !== this._tapId) return;
        this._tapId = -1;

        // a default-prevented touch end suppressed the browser's compatibility mouse events too
        if (event.defaultPrevented || this._tapMoved(event)) return;

        this._handleMove(event);
        this._handleDown(event);
        this._handleUp(event);
    }

    _handlePointerCancel(event) {
        if (event.pointerId === this._tapId) {
            this._tapId = -1;
        }
    }

    _tapMoved(event) {
        const dx = event.clientX - this._tapX;
        const dy = event.clientY - this._tapY;
        return dx * dx + dy * dy >= TAP_SLOP * TAP_SLOP;
    }

    _handleUp(event) {
        if (!this._enabled) return;

        if (Mouse.isPointerLocked()) {
            return;
        }

        this._calcMouseCoords(event);

        this._onElementMouseEvent('mouseup', event);
    }

    _handleDown(event) {
        if (!this._enabled) return;

        if (Mouse.isPointerLocked()) {
            return;
        }

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

    _activeTouches() {
        return Array.from(this._touches.values(), t => new Touch(t.event, t.target));
    }

    _determineTouchedElement(touch) {
        const cameras = this.app.systems.camera.cameras;

        // check cameras from last to front
        // so that elements that are drawn above others
        // receive events first
        for (let i = cameras.length - 1; i >= 0; i--) {
            const camera = cameras[i];
            const element = this._getTargetElementByCoords(camera, touch.x, touch.y);
            if (element) {
                return { element, camera, x: touch.x, y: touch.y };
            }
        }

        return null;
    }

    _handleTouchStart(event) {
        const id = event.pointerId;
        if ((event.pointerType !== 'touch' && event.pointerType !== 'pen') || this._touches.has(id)) return;

        // no explicit capture: the browser implicitly captures a touch to its start target
        this._touches.set(id, { target: event.target, event });

        if (!this._enabled) return;

        const touch = new Touch(event);
        const newTouchInfo = this._determineTouchedElement(touch);
        const oldTouchInfo = this._touchedElements[id];

        if (newTouchInfo && (!oldTouchInfo || newTouchInfo.element !== oldTouchInfo.element)) {
            this._fireEvent('touchstart', new ElementTouchEvent(event, newTouchInfo.element, newTouchInfo.camera, newTouchInfo.x, newTouchInfo.y, touch, this._activeTouches()));
            this._touchesForWhichTouchLeaveHasFired[id] = false;
        }

        if (newTouchInfo) {
            this._touchedElements[id] = newTouchInfo;
        }
    }

    // pointerleave without pointerup or pointercancel ends the touch too, as both touches of a
    // two-handed pinch do in Safari on Apple Vision Pro
    _handleTouchEnd(event, eventType) {
        const id = event.pointerId;
        const start = this._touches.get(id);
        if (!start) return;
        this._touches.delete(id);

        if (!this._enabled) return;

        const cameras = this.app.systems.camera.cameras;

        // clear clicked entities first then store each clicked entity
        // in _clickedEntities so that we don't fire another click
        // on it in this handler or in the emulated mouseup which
        // follows
        for (const key in this._clickedEntities) {
            delete this._clickedEntities[key];
        }

        const touchInfo = this._touchedElements[id];
        if (!touchInfo) {
            return;
        }

        const element = touchInfo.element;
        const camera = touchInfo.camera;
        const x = touchInfo.x;
        const y = touchInfo.y;

        delete this._touchedElements[id];
        delete this._touchesForWhichTouchLeaveHasFired[id];

        const touch = new Touch(event, start.target);
        const touches = this._activeTouches();

        // check if touch was released over previously touch
        // element in order to fire click event
        for (let c = cameras.length - 1; c >= 0; c--) {
            const hovered = this._getTargetElementByCoords(cameras[c], touch.x, touch.y);
            if (hovered === element) {

                if (!this._clickedEntities[element.entity.guid]) {
                    this._fireEvent('click', new ElementTouchEvent(event, element, camera, x, y, touch, touches));
                    this._clickedEntities[element.entity.guid] = Date.now();
                }

            }
        }

        this._fireEvent(eventType, new ElementTouchEvent(event, element, camera, x, y, touch, touches));
    }

    _handleTouchMove(event) {
        const id = event.pointerId;
        const start = this._touches.get(id);
        if (!start) return;
        start.event = event;

        if (!this._enabled) return;

        const oldTouchInfo = this._touchedElements[id];
        if (!oldTouchInfo) return;

        const touch = new Touch(event, start.target);
        const touches = this._activeTouches();
        const newTouchInfo = this._determineTouchedElement(touch);

        // Fire touchleave if we've left the previously touched element
        if ((!newTouchInfo || newTouchInfo.element !== oldTouchInfo.element) && !this._touchesForWhichTouchLeaveHasFired[id]) {
            this._fireEvent('touchleave', new ElementTouchEvent(event, oldTouchInfo.element, oldTouchInfo.camera, touch.x, touch.y, touch, touches));

            // Flag that touchleave has been fired for this touch, so that we don't
            // re-fire it on the next touchmove. This is required because touchmove
            // events keep on firing for the same element until the touch ends, even
            // if the touch position moves away from the element. Touchleave, on the
            // other hand, should fire once when the touch position moves away from
            // the element and then not re-fire again within the same touch session.
            this._touchesForWhichTouchLeaveHasFired[id] = true;
        }

        this._fireEvent('touchmove', new ElementTouchEvent(event, oldTouchInfo.element, oldTouchInfo.camera, touch.x, touch.y, touch, touches));
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
            if (element) {
                break;
            }
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
                const guid = this._hoveredElement.entity.guid;
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
        this.app.xr.off('end', this._onXrEnd, this);
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
                if (element) {
                    break;
                }
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
            if (evt._stopPropagation) {
                break;
            }

            if (!element.entity.parent) {
                break;
            }

            element = element.entity.parent.element;
            if (!element) {
                break;
            }
        }
    }

    _calcMouseCoords(event) {
        const rect = this._target.getBoundingClientRect();
        const left = Math.floor(rect.left);
        const top = Math.floor(rect.top);
        targetX = (event.clientX - left);
        targetY = (event.clientY - top);
    }

    _sortElements(a, b) {
        const layerOrder = this.app.scene.layers.sortTransparentLayers(a.layers, b.layers);
        if (layerOrder !== 0) return layerOrder;

        if (a.screen && !b.screen) {
            return -1;
        }
        if (!a.screen && b.screen) {
            return 1;
        }
        if (!a.screen && !b.screen) {
            return 0;
        }

        if (a.screen.screen.screenSpace && !b.screen.screen.screenSpace) {
            return -1;
        }
        if (b.screen.screen.screenSpace && !a.screen.screen.screenSpace) {
            return 1;
        }
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

    /**
     * Gets the mouse wheel value.
     *
     * @type {number}
     * @ignore
     * @deprecated Use {@link ElementMouseEvent#wheelDelta} instead.
     */
    get wheel() {
        return this.wheelDelta * -2;
    }
}

export { ElementInput, ElementInputEvent, ElementMouseEvent, ElementSelectEvent, ElementTouchEvent };
