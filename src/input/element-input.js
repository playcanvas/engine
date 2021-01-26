import { platform } from '../core/platform.js';

import { Vec2 } from '../math/vec2.js';
import { Vec3 } from '../math/vec3.js';
import { Vec4 } from '../math/vec4.js';

import { Ray } from '../shape/ray.js';

import { getApplication } from '../framework/globals.js';

import { Mouse } from './mouse.js';

var targetX, targetY;
var vecA = new Vec3();
var vecB = new Vec3();

var rayA = new Ray();
var rayB = new Ray();
var rayC = new Ray();

rayA.end = new Vec3();
rayB.end = new Vec3();
rayC.end = new Vec3();

var _pq = new Vec3();
var _pa = new Vec3();
var _pb = new Vec3();
var _pc = new Vec3();
var _pd = new Vec3();
var _m = new Vec3();
var _sct = new Vec3();
var _accumulatedScale = new Vec2();
var _paddingTop = new Vec3();
var _paddingBottom = new Vec3();
var _paddingLeft = new Vec3();
var _paddingRight = new Vec3();
var _cornerBottomLeft = new Vec3();
var _cornerBottomRight = new Vec3();
var _cornerTopRight = new Vec3();
var _cornerTopLeft = new Vec3();

var ZERO_VEC4 = new Vec4();

// pi x p2 * p3
function scalarTriple(p1, p2, p3) {
    return _sct.cross(p1, p2).dot(p3);
}

// Given line pq and ccw corners of a quad, return whether the line
// intersects it. (from Real-Time Collision Detection book)
function intersectLineQuad(p, q, corners) {
    _pq.sub2(q, p);
    _pa.sub2(corners[0], p);
    _pb.sub2(corners[1], p);
    _pc.sub2(corners[2], p);

    // Determine which triangle to test against by testing against diagonal first
    _m.cross(_pc, _pq);
    var v = _pa.dot(_m);
    if (v >= 0) {
        // Test intersection against triangle abc
        if (-_pb.dot(_m) < 0)
            return false;

        if (scalarTriple(_pq, _pb, _pa) < 0)
            return false;
    } else {
        // Test intersection against triangle dac
        _pd.sub2(corners[3], p);
        if (_pd.dot(_m) < 0)
            return false;

        if (scalarTriple(_pq, _pa, _pd) < 0)
            return false;
    }

    // The algorithm above doesn't work if all the corners are the same
    // So do that test here by checking if the diagonals are 0 (since these are rectangles we're checking against)
    if (_pq.sub2(corners[0], corners[2]).lengthSq() < 0.0001 * 0.0001) return false;
    if (_pq.sub2(corners[1], corners[3]).lengthSq() < 0.0001 * 0.0001) return false;

    return true;
}

/**
 * @class
 * @name pc.ElementInputEvent
 * @classdesc Represents an input event fired on a {@link pc.ElementComponent}. When an event is raised
 * on an ElementComponent it bubbles up to its parent ElementComponents unless we call stopPropagation().
 * @description Create an instance of a pc.ElementInputEvent.
 * @param {MouseEvent|TouchEvent} event - The MouseEvent or TouchEvent that was originally raised.
 * @param {pc.ElementComponent} element - The ElementComponent that this event was originally raised on.
 * @param {pc.CameraComponent} camera - The CameraComponent that this event was originally raised via.
 * @property {MouseEvent|TouchEvent} event The MouseEvent or TouchEvent that was originally raised.
 * @property {pc.ElementComponent} element The ElementComponent that this event was originally raised on.
 * @property {pc.CameraComponent} camera The CameraComponent that this event was originally raised via.
 */
class ElementInputEvent {
    constructor(event, element, camera) {
        this.event = event;
        this.element = element;
        this.camera = camera;
        this._stopPropagation = false;
    }

    /**
     * @function
     * @name pc.ElementInputEvent#stopPropagation
     * @description Stop propagation of the event to parent {@link pc.ElementComponent}s. This also stops propagation of the event to other event listeners of the original DOM Event.
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
 * @class
 * @name pc.ElementMouseEvent
 * @augments pc.ElementInputEvent
 * @classdesc Represents a Mouse event fired on a {@link pc.ElementComponent}.
 * @description Create an instance of a pc.ElementMouseEvent.
 * @param {MouseEvent} event - The MouseEvent that was originally raised.
 * @param {pc.ElementComponent} element - The ElementComponent that this event was originally raised on.
 * @param {pc.CameraComponent} camera - The CameraComponent that this event was originally raised via.
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} lastX - The last x coordinate.
 * @param {number} lastY - The last y coordinate.
 * @property {boolean} ctrlKey Whether the ctrl key was pressed.
 * @property {boolean} altKey Whether the alt key was pressed.
 * @property {boolean} shiftKey Whether the shift key was pressed.
 * @property {boolean} metaKey Whether the meta key was pressed.
 * @property {number} button The mouse button.
 * @property {number} dx The amount of horizontal movement of the cursor.
 * @property {number} dy The amount of vertical movement of the cursor.
 * @property {number} wheelDelta The amount of the wheel movement.
 */
class ElementMouseEvent extends ElementInputEvent {
    constructor(event, element, camera, x, y, lastX, lastY) {
        super(event, element, camera);

        this.x = x;
        this.y = y;

        this.ctrlKey = event.ctrlKey || false;
        this.altKey = event.altKey || false;
        this.shiftKey = event.shiftKey || false;
        this.metaKey = event.metaKey || false;

        this.button = event.button;

        if (Mouse.isPointerLocked()) {
            this.dx = event.movementX || event.webkitMovementX || event.mozMovementX || 0;
            this.dy = event.movementY || event.webkitMovementY || event.mozMovementY || 0;
        } else {
            this.dx = x - lastX;
            this.dy = y - lastY;
        }

        // deltaY is in a different range across different browsers. The only thing
        // that is consistent is the sign of the value so snap to -1/+1.
        this.wheelDelta = 0;
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
 * @class
 * @name pc.ElementTouchEvent
 * @augments pc.ElementInputEvent
 * @classdesc Represents a TouchEvent fired on a {@link pc.ElementComponent}.
 * @description Create an instance of a pc.ElementTouchEvent.
 * @param {TouchEvent} event - The TouchEvent that was originally raised.
 * @param {pc.ElementComponent} element - The ElementComponent that this event was originally raised on.
 * @param {pc.CameraComponent} camera - The CameraComponent that this event was originally raised via.
 * @param {number} x - The x coordinate of the touch that triggered the event.
 * @param {number} y - The y coordinate of the touch that triggered the event.
 * @param {Touch} touch - The touch object that triggered the event.
 * @property {Touch[]} touches The Touch objects representing all current points of contact with the surface, regardless of target or changed status.
 * @property {Touch[]} changedTouches The Touch objects representing individual points of contact whose states changed between the previous touch event and this one.
 * @property {Touch} touch The touch object that triggered the event.
 */
class ElementTouchEvent extends ElementInputEvent {
    constructor(event, element, camera, x, y, touch) {
        super(event, element, camera);

        this.touches = event.touches;
        this.changedTouches = event.changedTouches;
        this.x = x;
        this.y = y;
        this.touch = touch;
    }
}

/**
 * @class
 * @name pc.ElementSelectEvent
 * @augments pc.ElementInputEvent
 * @classdesc Represents a XRInputSourceEvent fired on a {@link pc.ElementComponent}.
 * @description Create an instance of a pc.ElementSelectEvent.
 * @param {object} event - The XRInputSourceEvent that was originally raised.
 * @param {pc.ElementComponent} element - The ElementComponent that this event was originally raised on.
 * @param {pc.CameraComponent} camera - The CameraComponent that this event was originally raised via.
 * @param {pc.XrInputSource} inputSource - The XR input source that this event was originally raised from.
 * @property {pc.XrInputSource} inputSource The XR input source that this event was originally raised from.
 */
class ElementSelectEvent extends ElementInputEvent {
    constructor(event, element, camera, inputSource) {
        super(event, element, camera);
        this.inputSource = inputSource;
    }
}

/**
 * @class
 * @name pc.ElementInput
 * @classdesc Handles mouse and touch events for {@link pc.ElementComponent}s. When input events
 * occur on an ElementComponent this fires the appropriate events on the ElementComponent.
 * @description Create a new pc.ElementInput instance.
 * @param {Element} domElement - The DOM element.
 * @param {object} [options] - Optional arguments.
 * @param {boolean} [options.useMouse] - Whether to allow mouse input. Defaults to true.
 * @param {boolean} [options.useTouch] - Whether to allow touch input. Defaults to true.
 * @param {boolean} [options.useXr] - Whether to allow XR input sources. Defaults to true.
 */
class ElementInput {
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

    /**
     * @function
     * @name pc.ElementInput#attach
     * @description Attach mouse and touch events to a DOM element.
     * @param {Element} domElement - The DOM element.
     */
    attach(domElement) {
        if (this._attached) {
            this._attached = false;
            this.detach();
        }

        this._target = domElement;
        this._attached = true;

        var opts = platform.passiveEvents ? { passive: true } : false;
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
        if (! this._selectEventsAttached && this._useXr && this.app && this.app.xr && this.app.xr.supported) {
            if (! this._clickedEntities)
                this._clickedEntities = {};

            this._selectEventsAttached = true;
            this.app.xr.on('start', this._onXrStart, this);
        }
    }

    /**
     * @function
     * @name pc.ElementInput#detach
     * @description Remove mouse and touch events from the DOM element that it is attached to.
     */
    detach() {
        if (!this._attached) return;
        this._attached = false;

        var opts = platform.passiveEvents ? { passive: true } : false;
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
     * @function
     * @name pc.ElementInput#addElement
     * @description Add a {@link pc.ElementComponent} to the internal list of ElementComponents that are being checked for input.
     * @param {pc.ElementComponent} element - The ElementComponent.
     */
    addElement(element) {
        if (this._elements.indexOf(element) === -1)
            this._elements.push(element);
    }

    /**
     * @function
     * @name pc.ElementInput#removeElement
     * @description Remove a {@link pc.ElementComponent} from the internal list of ElementComponents that are being checked for input.
     * @param {pc.ElementComponent} element - The ElementComponent.
     */
    removeElement(element) {
        var idx = this._elements.indexOf(element);
        if (idx !== -1)
            this._elements.splice(idx, 1);
    }

    _handleUp(event) {
        if (!this._enabled) return;

        if (Mouse.isPointerLocked())
            return;

        this._calcMouseCoords(event);
        if (targetX === null)
            return;

        this._onElementMouseEvent('mouseup', event);
    }

    _handleDown(event) {
        if (!this._enabled) return;

        if (Mouse.isPointerLocked())
            return;

        this._calcMouseCoords(event);
        if (targetX === null)
            return;

        this._onElementMouseEvent('mousedown', event);
    }

    _handleMove(event) {
        if (!this._enabled) return;

        this._calcMouseCoords(event);
        if (targetX === null)
            return;

        this._onElementMouseEvent('mousemove', event);

        this._lastX = targetX;
        this._lastY = targetY;
    }

    _handleWheel(event) {
        if (!this._enabled) return;

        this._calcMouseCoords(event);
        if (targetX === null)
            return;

        this._onElementMouseEvent('mousewheel', event);
    }

    _determineTouchedElements(event) {
        var touchedElements = {};
        var cameras = this.app.systems.camera.cameras;
        var i, j, len;

        // check cameras from last to front
        // so that elements that are drawn above others
        // receive events first
        for (i = cameras.length - 1; i >= 0; i--) {
            var camera = cameras[i];

            var done = 0;
            for (j = 0, len = event.changedTouches.length; j < len; j++) {
                if (touchedElements[event.changedTouches[j].identifier]) {
                    done++;
                    continue;
                }

                var coords = this._calcTouchCoords(event.changedTouches[j]);

                var element = this._getTargetElement(camera, coords.x, coords.y);
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

        var newTouchedElements = this._determineTouchedElements(event);

        for (var i = 0, len = event.changedTouches.length; i < len; i++) {
            var touch = event.changedTouches[i];
            var newTouchInfo = newTouchedElements[touch.identifier];
            var oldTouchInfo = this._touchedElements[touch.identifier];

            if (newTouchInfo && (!oldTouchInfo || newTouchInfo.element !== oldTouchInfo.element)) {
                this._fireEvent(event.type, new ElementTouchEvent(event, newTouchInfo.element, newTouchInfo.camera, newTouchInfo.x, newTouchInfo.y, touch));
                this._touchesForWhichTouchLeaveHasFired[touch.identifier] = false;
            }
        }

        for (var touchId in newTouchedElements) {
            this._touchedElements[touchId] = newTouchedElements[touchId];
        }
    }

    _handleTouchEnd(event) {
        if (!this._enabled) return;

        var cameras = this.app.systems.camera.cameras;

        // clear clicked entities first then store each clicked entity
        // in _clickedEntities so that we don't fire another click
        // on it in this handler or in the mouseup handler which is
        // fired later
        for (var key in this._clickedEntities) {
            delete this._clickedEntities[key];
        }

        for (var i = 0, len = event.changedTouches.length; i < len; i++) {
            var touch = event.changedTouches[i];
            var touchInfo = this._touchedElements[touch.identifier];
            if (!touchInfo)
                continue;

            var element = touchInfo.element;
            var camera = touchInfo.camera;
            var x = touchInfo.x;
            var y = touchInfo.y;

            delete this._touchedElements[touch.identifier];
            delete this._touchesForWhichTouchLeaveHasFired[touch.identifier];

            this._fireEvent(event.type, new ElementTouchEvent(event, element, camera, x, y, touch));

            // check if touch was released over previously touch
            // element in order to fire click event
            if (event.touches.length === 0) {
                var coords = this._calcTouchCoords(touch);

                for (var c = cameras.length - 1; c >= 0; c--) {
                    var hovered = this._getTargetElement(cameras[c], coords.x, coords.y);
                    if (hovered === element) {

                        if (!this._clickedEntities[element.entity.getGuid()]) {
                            this._fireEvent('click', new ElementTouchEvent(event, element, camera, x, y, touch));
                            this._clickedEntities[element.entity.getGuid()] = true;
                        }

                    }
                }
            }
        }
    }

    _handleTouchMove(event) {
        // call preventDefault to avoid issues in Chrome Android:
        // http://wilsonpage.co.uk/touch-events-in-chrome-android/
        event.preventDefault();

        if (!this._enabled) return;

        var newTouchedElements = this._determineTouchedElements(event);

        for (var i = 0, len = event.changedTouches.length; i < len; i++) {
            var touch = event.changedTouches[i];
            var newTouchInfo = newTouchedElements[touch.identifier];
            var oldTouchInfo = this._touchedElements[touch.identifier];

            if (oldTouchInfo) {
                var coords = this._calcTouchCoords(touch);

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
        var element;

        var hovered = this._hoveredElement;
        this._hoveredElement = null;

        var cameras = this.app.systems.camera.cameras;
        var camera;

        // check cameras from last to front
        // so that elements that are drawn above others
        // receive events first
        for (var i = cameras.length - 1; i >= 0; i--) {
            camera = cameras[i];

            element = this._getTargetElement(camera, targetX, targetY);
            if (element)
                break;
        }

        // fire mouse event
        if (element) {
            this._fireEvent(eventType, new ElementMouseEvent(event, element, camera, targetX, targetY, this._lastX, this._lastY));

            this._hoveredElement = element;

            if (eventType === 'mousedown') {
                this._pressedElement = element;
            }
        }

        if (hovered !== this._hoveredElement) {
            // mouseleave event
            if (hovered) {
                this._fireEvent('mouseleave', new ElementMouseEvent(event, hovered, camera, targetX, targetY, this._lastX, this._lastY));
            }

            // mouseenter event
            if (this._hoveredElement) {
                this._fireEvent('mouseenter', new ElementMouseEvent(event, this._hoveredElement, camera, targetX, targetY, this._lastX, this._lastY));
            }
        }

        if (eventType === 'mouseup' && this._pressedElement) {
            // click event
            if (this._pressedElement === this._hoveredElement) {
                this._pressedElement = null;

                // fire click event if it hasn't been fired already by the touchup handler
                if (!this._clickedEntities || !this._clickedEntities[this._hoveredElement.entity.getGuid()]) {
                    this._fireEvent('click', new ElementMouseEvent(event, this._hoveredElement, camera, targetX, targetY, this._lastX, this._lastY));
                }
            } else {
                this._pressedElement = null;
            }
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

        var inputSources = this.app.xr.input.inputSources;
        for (var i = 0; i < inputSources.length; i++) {
            this._onElementSelectEvent('selectmove', inputSources[i], null);
        }
    }

    _onXrInputRemove(inputSource) {
        var hovered = this._selectedElements[inputSource.id];
        if (hovered) {
            inputSource._elementEntity = null;
            this._fireEvent('selectleave', new ElementSelectEvent(null, hovered, null, inputSource));
        }

        delete this._selectedElements[inputSource.id];
        delete this._selectedPressedElements[inputSource.id];
    }

    _onSelectStart(inputSource, event) {
        if (! this._enabled) return;
        this._onElementSelectEvent('selectstart', inputSource, event);
    }

    _onSelectEnd(inputSource, event) {
        if (! this._enabled) return;
        this._onElementSelectEvent('selectend', inputSource, event);
    }

    _onElementSelectEvent(eventType, inputSource, event) {
        var element;

        var hoveredBefore = this._selectedElements[inputSource.id];
        var hoveredNow;

        var cameras = this.app.systems.camera.cameras;
        var camera;

        if (inputSource.elementInput) {
            rayC.set(inputSource.getOrigin(), inputSource.getDirection());

            for (var i = cameras.length - 1; i >= 0; i--) {
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

        if (eventType === 'selectstart') {
            this._selectedPressedElements[inputSource.id] = hoveredNow;
            if (hoveredNow) this._fireEvent('selectstart', new ElementSelectEvent(event, hoveredNow, camera, inputSource));
        }

        var pressed = this._selectedPressedElements[inputSource.id];
        if (! inputSource.elementInput && pressed) {
            delete this._selectedPressedElements[inputSource.id];
            if (hoveredBefore) this._fireEvent('selectend', new ElementSelectEvent(event, hoveredBefore, camera, inputSource));
        }

        if (eventType === 'selectend' && inputSource.elementInput) {
            delete this._selectedPressedElements[inputSource.id];

            if (hoveredBefore) this._fireEvent('selectend', new ElementSelectEvent(event, hoveredBefore, camera, inputSource));

            if (pressed && pressed === hoveredBefore) {
                this._fireEvent('click', new ElementSelectEvent(event, pressed, camera, inputSource));
            }
        }
    }

    _fireEvent(name, evt) {
        var element = evt.element;
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
        var rect = this._target.getBoundingClientRect();
        var left = Math.floor(rect.left);
        var top = Math.floor(rect.top);

        // mouse is outside of canvas
        if (event.clientX < left ||
            event.clientX >= left + this._target.clientWidth ||
            event.clientY < top ||
            event.clientY >= top + this._target.clientHeight) {

            targetX = null;
            targetY = null;
        } else {
            // calculate coords and scale them to the graphicsDevice size
            targetX = (event.clientX - left);
            targetY = (event.clientY - top);
        }
    }

    _calcTouchCoords(touch) {
        var totalOffsetX = 0;
        var totalOffsetY = 0;
        var target = touch.target;
        while (!(target instanceof HTMLElement)) {
            target = target.parentNode;
        }
        var currentElement = target;

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
        var layerOrder = this.app.scene.layers.sortTransparentLayers(a.layers, b.layers);
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

    _getTargetElement(camera, x, y) {
        var result = null;

        // sort elements
        this._elements.sort(this._sortHandler);

        var rayScreen, ray3d;

        for (var i = 0, len = this._elements.length; i < len; i++) {
            var element = this._elements[i];
            var screen = false;
            var ray;

            // cache rays
            if (element.screen && element.screen.screen.screenSpace) {
                // 2D screen
                if (rayScreen === undefined) {
                    rayScreen = rayA;
                    if (this._calculateRayScreen(x, y, camera, rayScreen) === false) {
                        rayScreen = null;
                    }
                }
                ray = rayScreen;
                screen = true;
            } else {
                // 3d
                if (ray3d === undefined) {
                    ray3d = rayB;
                    if (this._calculateRay3d(x, y, camera, ray3d) === false) {
                        ray3d = null;
                    }
                }
                ray = ray3d;
            }

            if (ray && this._checkElement(ray, element, screen)) {
                result = element;
                break;
            }
        }

        return result;
    }

    _getTargetElementByRay(ray, camera) {
        var result = null;

        rayA.origin.copy(ray.origin);
        rayA.direction.copy(ray.direction);
        rayA.end.copy(rayA.direction).scale(camera.farClip * 2).add(rayA.origin);

        // sort elements
        this._elements.sort(this._sortHandler);

        for (var i = 0, len = this._elements.length; i < len; i++) {
            var element = this._elements[i];

            if (! element.screen || ! element.screen.screen.screenSpace) {
                if (this._checkElement(rayA, element, false)) {
                    result = element;
                    break;
                }
            }
        }

        return result;
    }

    // In most cases the corners used for hit testing will just be the element's
    // screen corners. However, in cases where the element has additional hit
    // padding specified, we need to expand the screenCorners to incorporate the
    // padding.
    _buildHitCorners(element, screenOrWorldCorners, scaleX, scaleY) {
        var hitCorners = screenOrWorldCorners;
        var button = element.entity && element.entity.button;

        if (button) {
            var hitPadding = element.entity.button.hitPadding || ZERO_VEC4;

            _paddingTop.copy(element.entity.up);
            _paddingBottom.copy(_paddingTop).scale(-1);
            _paddingRight.copy(element.entity.right);
            _paddingLeft.copy(_paddingRight).scale(-1);

            _paddingTop.scale(hitPadding.w * scaleY);
            _paddingBottom.scale(hitPadding.y * scaleY);
            _paddingRight.scale(hitPadding.z * scaleX);
            _paddingLeft.scale(hitPadding.x * scaleX);

            _cornerBottomLeft.copy(hitCorners[0]).add(_paddingBottom).add(_paddingLeft);
            _cornerBottomRight.copy(hitCorners[1]).add(_paddingBottom).add(_paddingRight);
            _cornerTopRight.copy(hitCorners[2]).add(_paddingTop).add(_paddingRight);
            _cornerTopLeft.copy(hitCorners[3]).add(_paddingTop).add(_paddingLeft);

            hitCorners = [_cornerBottomLeft, _cornerBottomRight, _cornerTopRight, _cornerTopLeft];
        }

        return hitCorners;
    }

    _calculateScaleToScreen(element) {
        var current = element.entity;
        var screenScale = element.screen.screen.scale;

        _accumulatedScale.set(screenScale, screenScale);

        while (current && !current.screen) {
            _accumulatedScale.mul(current.getLocalScale());
            current = current.parent;
        }

        return _accumulatedScale;
    }

    _calculateRayScreen(x, y, camera, ray) {
        var sw = this.app.graphicsDevice.width;
        var sh = this.app.graphicsDevice.height;

        var cameraWidth = camera.rect.z * sw;
        var cameraHeight = camera.rect.w * sh;
        var cameraLeft = camera.rect.x * sw;
        var cameraRight = cameraLeft + cameraWidth;
        // camera bottom (origin is bottom left of window)
        var cameraBottom = (1 - camera.rect.y) * sh;
        var cameraTop = cameraBottom - cameraHeight;

        var _x = x * sw / this._target.clientWidth;
        var _y = y * sh / this._target.clientHeight;

        if (_x >= cameraLeft && _x <= cameraRight &&
            _y <= cameraBottom && _y >= cameraTop) {

            // limit window coords to camera rect coords
            _x = sw * (_x - cameraLeft) / cameraWidth;
            _y = sh * (_y - cameraTop) / cameraHeight;

            // reverse _y
            _y = sh - _y;

            ray.origin.set(_x, _y, 1);
            ray.direction.set(0, 0, -1);
            ray.end.copy(ray.direction).scale(2).add(ray.origin);

            return true;
        }
        return false;
    }

    _calculateRay3d(x, y, camera, ray) {
        var sw = this._target.clientWidth;
        var sh = this._target.clientHeight;

        var cameraWidth = camera.rect.z * sw;
        var cameraHeight = camera.rect.w * sh;
        var cameraLeft = camera.rect.x * sw;
        var cameraRight = cameraLeft + cameraWidth;
        // camera bottom - origin is bottom left of window
        var cameraBottom = (1 - camera.rect.y) * sh;
        var cameraTop = cameraBottom - cameraHeight;

        var _x = x;
        var _y = y;

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
            var result = this._checkElement(ray, element.maskedBy.element, screen);
            if (!result) return false;
        }

        var scale;

        if (screen) {
            scale = this._calculateScaleToScreen(element);
        } else {
            scale = element.entity.getWorldTransform().getScale();
        }

        var corners = this._buildHitCorners(element, screen ? element.screenCorners : element.worldCorners, scale.x, scale.y);

        if (intersectLineQuad(ray.origin, ray.end, corners))
            return true;

        return false;
    }

    get enabled() {
        return this._enabled;
    }

    set enabled(value) {
        this._enabled = value;
    }

    get app() {
        return this._app || getApplication();
    }

    set app(value) {
        this._app = value;
    }
}

export { ElementInput, ElementInputEvent, ElementMouseEvent, ElementSelectEvent, ElementTouchEvent };
