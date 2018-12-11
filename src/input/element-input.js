Object.assign(pc, function () {
    var targetX, targetY;
    var vecA = new pc.Vec3();
    var vecB = new pc.Vec3();

    var _pq = new pc.Vec3();
    var _pa = new pc.Vec3();
    var _pb = new pc.Vec3();
    var _pc = new pc.Vec3();
    var _pd = new pc.Vec3();
    var _m = new pc.Vec3();
    var _sct = new pc.Vec3();
    var _accumulatedScale = new pc.Vec2();
    var _paddingTop = new pc.Vec3();
    var _paddingBottom = new pc.Vec3();
    var _paddingLeft = new pc.Vec3();
    var _paddingRight = new pc.Vec3();
    var _cornerBottomLeft = new pc.Vec3();
    var _cornerBottomRight = new pc.Vec3();
    var _cornerTopRight = new pc.Vec3();
    var _cornerTopLeft = new pc.Vec3();

    var ZERO_VEC4 = new pc.Vec4();

    // pi x p2 * p3
    var scalarTriple = function (p1, p2, p3) {
        return _sct.cross(p1, p2).dot(p3);
    };

    // Given line pq and ccw corners of a quad, return whether the line
    // intersects it. (from Real-Time Collision Detection book)
    var intersectLineQuad = function (p, q, corners) {
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
    };

    /**
     * @constructor
     * @name pc.ElementInputEvent
     * @classdesc Represents an input event fired on a {@link pc.ElementComponent}. When an event is raised
     * on an ElementComponent it bubbles up to its parent ElementComponents unless we call stopPropagation().
     * @description Create an instance of a pc.ElementInputEvent.
     * @param {MouseEvent|TouchEvent} event The MouseEvent or TouchEvent that was originally raised.
     * @param {pc.ElementComponent} element The ElementComponent that this event was originally raised on.
     * @param {pc.CameraComponent} camera The CameraComponent that this event was originally raised via.
     * @property {MouseEvent|TouchEvent} event The MouseEvent or TouchEvent that was originally raised.
     * @property {pc.ElementComponent} element The ElementComponent that this event was originally raised on.
     */
    var ElementInputEvent = function (event, element, camera) {
        this.event = event;
        this.element = element;
        this.camera = camera;
        this._stopPropagation = false;
    };

    Object.assign(ElementInputEvent.prototype, {
        /**
         * @function
         * @name pc.ElementInputEvent#stopPropagation
         * @description Stop propagation of the event to parent {@link pc.ElementComponent}s. This also stops propagation of the event to other event listeners of the original DOM Event.
         */
        stopPropagation: function () {
            this._stopPropagation = true;
            this.event.stopImmediatePropagation();
            this.event.stopPropagation();
        }
    });

    /**
     * @constructor
     * @name pc.ElementMouseEvent
     * @classdesc Represents a Mouse event fired on a {@link pc.ElementComponent}.
     * @extends pc.ElementInputEvent
     * @description Create an instance of a pc.ElementMouseEvent.
     * @param {MouseEvent} event The MouseEvent that was originally raised.
     * @param {pc.ElementComponent} element The ElementComponent that this event was originally raised on.
     * @param {pc.CameraComponent} camera The CameraComponent that this event was originally raised via.
     * @param {Number} x The x coordinate
     * @param {Number} y The y coordinate
     * @param {Number} lastX The last x coordinate
     * @param {Number} lastY The last y coordinate
     * @property {Boolean} ctrlKey Whether the ctrl key was pressed
     * @property {Boolean} altKey Whether the alt key was pressed
     * @property {Boolean} shiftKey Whether the shift key was pressed
     * @property {Boolean} metaKey Whether the meta key was pressed
     * @property {Number} button The mouse button
     * @property {Number} dx The amount of horizontal movement of the cursor
     * @property {Number} dy The amount of vertical movement of the cursor
     * @property {Number} wheel The amount of the wheel movement
     */
    var ElementMouseEvent = function (event, element, camera, x, y, lastX, lastY) {
        ElementInputEvent.call(this, event, element, camera);

        this.x = x;
        this.y = y;

        this.ctrlKey = event.ctrlKey || false;
        this.altKey = event.altKey || false;
        this.shiftKey = event.shiftKey || false;
        this.metaKey = event.metaKey || false;

        this.button = event.button;

        if (pc.Mouse.isPointerLocked()) {
            this.dx = event.movementX || event.webkitMovementX || event.mozMovementX || 0;
            this.dy = event.movementY || event.webkitMovementY || event.mozMovementY || 0;
        } else {
            this.dx = x - lastX;
            this.dy = y - lastY;
        }

        // FF uses 'detail' and returns a value in 'no. of lines' to scroll
        // WebKit and Opera use 'wheelDelta', WebKit goes in multiples of 120 per wheel notch
        if (event.detail) {
            this.wheel = -1 * event.detail;
        } else if (event.wheelDelta) {
            this.wheel = event.wheelDelta / 120;
        } else {
            this.wheel = 0;
        }
    };
    ElementMouseEvent.prototype = Object.create(ElementInputEvent.prototype);
    ElementMouseEvent.prototype.constructor = ElementMouseEvent;

    /**
     * @constructor
     * @name pc.ElementTouchEvent
     * @classdesc Represents a TouchEvent fired on a {@link pc.ElementComponent}.
     * @extends pc.ElementInputEvent
     * @description Create an instance of a pc.ElementTouchEvent.
     * @param {TouchEvent} event The TouchEvent that was originally raised.
     * @param {pc.ElementComponent} element The ElementComponent that this event was originally raised on.
     * @param {pc.CameraComponent} camera The CameraComponent that this event was originally raised via.
     * @param {Number} x The x coordinate of the touch that triggered the event
     * @param {Number} y The y coordinate of the touch that triggered the event
     * @param {pc.ElementInput} input The pc.ElementInput instance
     * @property {Touch[]} touches The Touch objects representing all current points of contact with the surface, regardless of target or changed status.
     * @property {Touch[]} changedTouches The Touch objects representing individual points of contact whose states changed between the previous touch event and this one.
     */
    var ElementTouchEvent = function (event, element, camera, x, y, input) {
        ElementInputEvent.call(this, event, element, camera);

        this.touches = event.touches;
        this.changedTouches = event.changedTouches;
        this.x = x;
        this.y = y;
    };
    ElementTouchEvent.prototype = Object.create(ElementInputEvent.prototype);
    ElementTouchEvent.prototype.constructor = ElementTouchEvent;

    /**
     * @constructor
     * @name pc.ElementInput
     * @classdesc Handles mouse and touch events for {@link pc.ElementComponent}s. When input events
     * occur on an ElementComponent this fires the appropriate events on the ElementComponent.
     * @description Create a new pc.ElementInput instance.
     * @param {Element} domElement The DOM element
     * @param {Object} [options] Optional arguments
     * @param {Object} [options.useMouse] Whether to allow mouse input. Defaults to true.
     * @param {Object} [options.useTouch] Whether to allow touch input. Defaults to true.
     */
    var ElementInput = function (domElement, options) {
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

        this._useMouse = !options || options.useMouse !== false;
        this._useTouch = !options || options.useTouch !== false;

        if (pc.platform.touch) {
            this._clickedEntities = {};
        }

        this.attach(domElement, options);
    };

    Object.assign(ElementInput.prototype, {
        /**
         * @function
         * @name pc.ElementInput#attach
         * @description Attach mouse and touch events to a DOM element.
         * @param {Element} domElement The DOM element
         */
        attach: function (domElement) {
            if (this._attached) {
                this._attached = false;
                this.detach();
            }

            this._target = domElement;
            this._attached = true;

            if (this._useMouse) {
                window.addEventListener('mouseup', this._upHandler, { passive: true });
                window.addEventListener('mousedown', this._downHandler, { passive: true });
                window.addEventListener('mousemove', this._moveHandler, { passive: true });
                window.addEventListener('mousewheel', this._wheelHandler, { passive: true });
                window.addEventListener('DOMMouseScroll', this._wheelHandler, { passive: true });
            }

            if (this._useTouch && pc.platform.touch) {
                this._target.addEventListener('touchstart', this._touchstartHandler, { passive: true });
                // Passive is not used for the touchend event because some components need to be
                // able to call preventDefault(). See notes in button/component.js for more details.
                this._target.addEventListener('touchend', this._touchendHandler, false);
                this._target.addEventListener('touchmove', this._touchmoveHandler, false);
                this._target.addEventListener('touchcancel', this._touchcancelHandler, false);
            }
        },

        /**
         * @function
         * @name pc.ElementInput#detach
         * @description Remove mouse and touch events from the DOM element that it is attached to
         */
        detach: function () {
            if (!this._attached) return;
            this._attached = false;

            if (this._useMouse) {
                window.removeEventListener('mouseup', this._upHandler, false);
                window.removeEventListener('mousedown', this._downHandler, false);
                window.removeEventListener('mousemove', this._moveHandler, false);
                window.removeEventListener('mousewheel', this._wheelHandler, false);
                window.removeEventListener('DOMMouseScroll', this._wheelHandler, false);
            }

            if (this._useTouch) {
                this._target.removeEventListener('touchstart', this._touchstartHandler, false);
                this._target.removeEventListener('touchend', this._touchendHandler, false);
                this._target.removeEventListener('touchmove', this._touchmoveHandler, false);
                this._target.removeEventListener('touchcancel', this._touchcancelHandler, false);
            }

            this._target = null;
        },

        /**
         * @function
         * @name pc.ElementInput#addElement
         * @description Add a {@link pc.ElementComponent} to the internal list of ElementComponents that are being checked for input.
         * @param {pc.ElementComponent} element The ElementComponent
         */
        addElement: function (element) {
            if (this._elements.indexOf(element) === -1)
                this._elements.push(element);
        },

        /**
         * @function
         * @name pc.ElementInput#removeElement
         * @description Remove a {@link pc.ElementComponent} from the internal list of ElementComponents that are being checked for input.
         * @param {pc.ElementComponent} element The ElementComponent
         */
        removeElement: function (element) {
            var idx = this._elements.indexOf(element);
            if (idx !== -1)
                this._elements.splice(idx, 1);
        },

        _handleUp: function (event) {
            if (!this._enabled) return;

            if (pc.Mouse.isPointerLocked())
                return;

            this._calcMouseCoords(event);
            if (targetX === null)
                return;

            this._onElementMouseEvent(event);
        },

        _handleDown: function (event) {
            if (!this._enabled) return;

            if (pc.Mouse.isPointerLocked())
                return;

            this._calcMouseCoords(event);
            if (targetX === null)
                return;

            this._onElementMouseEvent(event);
        },

        _handleMove: function (event) {
            if (!this._enabled) return;

            this._calcMouseCoords(event);
            if (targetX === null)
                return;

            this._onElementMouseEvent(event);

            this._lastX = targetX;
            this._lastY = targetY;
        },

        _handleWheel: function (event) {
            if (!this._enabled) return;

            this._calcMouseCoords(event);
            if (targetX === null)
                return;

            this._onElementMouseEvent(event);
        },

        _determineTouchedElements: function (event) {
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
        },

        _handleTouchStart: function (event) {
            if (!this._enabled) return;

            var newTouchedElements = this._determineTouchedElements(event);

            for (var i = 0, len = event.changedTouches.length; i < len; i++) {
                var touch = event.changedTouches[i];
                var newTouchInfo = newTouchedElements[touch.identifier];
                var oldTouchInfo = this._touchedElements[touch.identifier];

                if (newTouchInfo && (!oldTouchInfo || newTouchInfo.element !== oldTouchInfo.element)) {
                    this._fireEvent(event.type, new ElementTouchEvent(event, newTouchInfo.element, newTouchInfo.camera, newTouchInfo.x, newTouchInfo.y, this));
                    this._touchesForWhichTouchLeaveHasFired[touch.identifier] = false;
                }
            }

            for (var touchId in newTouchedElements) {
                this._touchedElements[touchId] = newTouchedElements[touchId];
            }
        },

        _handleTouchEnd: function (event) {
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

                this._fireEvent(event.type, new ElementTouchEvent(event, element, camera, x, y, this));

                // check if touch was released over previously touch
                // element in order to fire click event
                if (event.touches.length === 0) {
                    var coords = this._calcTouchCoords(touch);

                    for (var c = cameras.length - 1; c >= 0; c--) {
                        var hovered = this._getTargetElement(cameras[c], coords.x, coords.y);
                        if (hovered === element) {

                            if (!this._clickedEntities[element.entity.getGuid()]) {
                                this._fireEvent('click', new ElementTouchEvent(event, element, camera, x, y, this));
                                this._clickedEntities[element.entity.getGuid()] = true;
                            }

                        }
                    }
                }
            }
        },

        _handleTouchMove: function (event) {
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
                        this._fireEvent('touchleave', new ElementTouchEvent(event, oldTouchInfo.element, oldTouchInfo.camera, coords.x, coords.y, this));

                        // Flag that touchleave has been fired for this touch, so that we don't
                        // re-fire it on the next touchmove. This is required because touchmove
                        // events keep on firing for the same element until the touch ends, even
                        // if the touch position moves away from the element. Touchleave, on the
                        // other hand, should fire once when the touch position moves away from
                        // the element and then not re-fire again within the same touch session.
                        this._touchesForWhichTouchLeaveHasFired[touch.identifier] = true;
                    }

                    this._fireEvent('touchmove', new ElementTouchEvent(event, oldTouchInfo.element, oldTouchInfo.camera, coords.x, coords.y, this));
                }
            }
        },

        _onElementMouseEvent: function (event) {
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
                this._fireEvent(event.type, new ElementMouseEvent(event, element, camera, targetX, targetY, this._lastX, this._lastY));

                this._hoveredElement = element;

                if (event.type === pc.EVENT_MOUSEDOWN) {
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

            if (event.type === pc.EVENT_MOUSEUP && this._pressedElement) {
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
        },

        _fireEvent: function (name, evt) {
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

        },

        _calcMouseCoords: function (event) {
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
        },

        _calcTouchCoords: function (touch) {
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
        },

        _sortElements: function (a, b) {
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
        },

        _getTargetElement: function (camera, x, y) {
            var result = null;

            // sort elements
            this._elements.sort(this._sortHandler);

            for (var i = 0, len = this._elements.length; i < len; i++) {
                var element = this._elements[i];

                // scale x, y based on the camera's rect

                if (element.screen && element.screen.screen.screenSpace) {
                    // 2D screen
                    if (this._checkElement2d(x, y, element, camera)) {
                        result = element;
                        break;
                    }
                } else {
                    // 3d
                    if (this._checkElement3d(x, y, element, camera)) {
                        result = element;
                        break;
                    }
                }
            }

            return result;
        },

        // In most cases the corners used for hit testing will just be the element's
        // screen corners. However, in cases where the element has additional hit
        // padding specified, we need to expand the screenCorners to incorporate the
        // padding.
        _buildHitCorners: function (element, screenOrWorldCorners, scaleX, scaleY) {
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
        },

        _calculateScaleToScreen: function (element) {
            var current = element.entity;
            var screenScale = element.screen.screen.scale;

            _accumulatedScale.set(screenScale, screenScale);

            while (current && !current.screen) {
                _accumulatedScale.mul(current.getLocalScale());
                current = current.parent;
            }

            return _accumulatedScale;
        },

        _checkElement2d: function (x, y, element, camera) {
            // ensure click is contained by any mask first
            if (element.maskedBy) {
                var result = this._checkElement2d(x, y, element.maskedBy.element, camera);
                if (!result) return false;
            }

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

            // check window coords are within camera rect
            if (_x >= cameraLeft && _x <= cameraRight &&
                _y <= cameraBottom && _y >= cameraTop) {

                // limit window coords to camera rect coords
                _x = sw * (_x - cameraLeft) / cameraWidth;
                _y = sh * (_y - cameraTop) / cameraHeight;

                // reverse _y
                _y = sh - _y;

                var scale = this._calculateScaleToScreen(element);
                var hitCorners = this._buildHitCorners(element, element.screenCorners, scale.x, scale.y);
                vecA.set(_x, _y, 1);
                vecB.set(_x, _y, -1);

                if (intersectLineQuad(vecA, vecB, hitCorners)) {
                    return true;
                }
            }

            return false;
        },

        _checkElement3d: function (x, y, element, camera) {
            // ensure click is contained by any mask first
            if (element.maskedBy) {
                var result = this._checkElement3d(x, y, element.maskedBy.element, camera);
                if (!result) return false;
            }

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
                var scale = element.entity.getWorldTransform().getScale();
                var worldCorners = this._buildHitCorners(element, element.worldCorners, scale.x, scale.y);
                var start = vecA;
                var end = vecB;
                camera.screenToWorld(_x, _y, camera.nearClip, start);
                camera.screenToWorld(_x, _y, camera.farClip, end);

                if (intersectLineQuad(start, end, worldCorners)) {
                    return true;
                }
            }

            return false;
        }
    });

    Object.defineProperty(ElementInput.prototype, 'enabled', {
        get: function () {
            return this._enabled;
        },
        set: function (value) {
            this._enabled = value;
        }
    });

    Object.defineProperty(ElementInput.prototype, 'app', {
        get: function () {
            return this._app || pc.app;
        },
        set: function (value) {
            this._app = value;
        }
    });

    return {
        ElementInput: ElementInput,
        ElementInputEvent: ElementInputEvent,
        ElementMouseEvent: ElementMouseEvent,
        ElementTouchEvent: ElementTouchEvent
    };
}());
