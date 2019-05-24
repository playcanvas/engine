Object.assign(pc, function () {
    var _tempScrollValue = new pc.Vec2();

    /**
     * @component
     * @name pc.ScrollViewComponent
     * @description Create a new ScrollViewComponent
     * @classdesc A ScrollViewComponent enables a group of entities to behave like a masked scrolling area, with optional horizontal and vertical scroll bars.
     * @param {pc.ScrollViewComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * @property {Boolean} horizontal Whether to enable horizontal scrolling.
     * @property {Boolean} vertical Whether to enable vertical scrolling.
     * @property {pc.SCROLL_MODE} scrollMode Specifies how the scroll view should behave when the user scrolls past the end of the content. Modes are defined as follows:
     * <ul>
     *     <li>{@link pc.SCROLL_MODE_CLAMP}: Content does not scroll any further than its bounds.</li>
     *     <li>{@link pc.SCROLL_MODE_BOUNCE}: Content scrolls past its bounds and then gently bounces back.</li>
     *     <li>{@link pc.SCROLL_MODE_INFINITE}: Content can scroll forever.</li>
     * </ul>
     * @property {Number} bounceAmount Controls how far the content should move before bouncing back.
     * @property {Number} friction Controls how freely the content should move if thrown, i.e. by flicking on a phone or by flinging the scroll wheel on a mouse. A value of 1 means that content will stop immediately; 0 means that content will continue moving forever (or until the bounds of the content are reached, depending on the scrollMode).
     * @property {pc.SCROLLBAR_VISIBILITY} horizontalScrollbarVisibility Controls whether the horizontal scrollbar should be visible all the time, or only visible when the content exceeds the size of the viewport.
     * @property {pc.SCROLLBAR_VISIBILITY} verticalScrollbarVisibility Controls whether the vertical scrollbar should be visible all the time, or only visible when the content exceeds the size of the viewport.
     * @property {pc.Entity} viewportEntity The entity to be used as the masked viewport area, within which the content will scroll. This entity must have an ElementGroup component.
     * @property {pc.Entity} contentEntity The entity which contains the scrolling content itself. This entity must have an Element component.
     * @property {pc.Entity} horizontalScrollbarEntity The entity to be used as the vertical scrollbar. This entity must have a Scrollbar component.
     * @property {pc.Entity} verticalScrollbarEntity The entity to be used as the vertical scrollbar. This entity must have a Scrollbar component.
     */
    var ScrollViewComponent = function ScrollViewComponent(system, entity) {
        pc.Component.call(this, system, entity);

        this._viewportReference = new pc.EntityReference(this, 'viewportEntity', {
            'element#gain': this._onViewportElementGain,
            'element#resize': this._onSetContentOrViewportSize
        });

        this._contentReference = new pc.EntityReference(this, 'contentEntity', {
            'element#gain': this._onContentElementGain,
            'element#lose': this._onContentElementLose,
            'element#resize': this._onSetContentOrViewportSize
        });

        this._scrollbarUpdateFlags = {};
        this._scrollbarReferences = {};
        this._scrollbarReferences[pc.ORIENTATION_HORIZONTAL] = new pc.EntityReference(this, 'horizontalScrollbarEntity', {
            'scrollbar#set:value': this._onSetHorizontalScrollbarValue,
            'scrollbar#gain': this._onHorizontalScrollbarGain
        });
        this._scrollbarReferences[pc.ORIENTATION_VERTICAL] = new pc.EntityReference(this, 'verticalScrollbarEntity', {
            'scrollbar#set:value': this._onSetVerticalScrollbarValue,
            'scrollbar#gain': this._onVerticalScrollbarGain
        });

        this._prevContentSizes = {};
        this._prevContentSizes[pc.ORIENTATION_HORIZONTAL] = null;
        this._prevContentSizes[pc.ORIENTATION_VERTICAL] = null;

        this._scroll = new pc.Vec2();
        this._velocity = new pc.Vec3();

        this._dragStartPosition = new pc.Vec3();
        this._disabledContentInput = false;
        this._disabledContentInputEntities = [];

        this._toggleLifecycleListeners('on', system);
        this._toggleElementListeners('on');
    };
    ScrollViewComponent.prototype = Object.create(pc.Component.prototype);
    ScrollViewComponent.prototype.constructor = ScrollViewComponent;

    Object.assign(ScrollViewComponent.prototype, {
        _toggleLifecycleListeners: function (onOrOff, system) {
            this[onOrOff]('set_horizontal', this._onSetHorizontalScrollingEnabled, this);
            this[onOrOff]('set_vertical', this._onSetVerticalScrollingEnabled, this);

            system.app.systems.element[onOrOff]('add', this._onElementComponentAdd, this);
            system.app.systems.element[onOrOff]('beforeremove', this._onElementComponentRemove, this);

            // TODO Handle scrollwheel events
        },

        _toggleElementListeners: function (onOrOff) {
            if (this.entity.element) {
                if (onOrOff === 'on' && this._hasElementListeners) {
                    return;
                }

                this.entity.element[onOrOff]('resize', this._onSetContentOrViewportSize, this);

                this._hasElementListeners = (onOrOff === 'on');
            }
        },

        _onElementComponentAdd: function (entity) {
            if (this.entity === entity) {
                this._toggleElementListeners('on');
            }
        },

        _onElementComponentRemove: function (entity) {
            if (this.entity === entity) {
                this._toggleElementListeners('off');
            }
        },

        _onViewportElementGain: function () {
            this._syncAll();
        },

        _onContentElementGain: function () {
            this._destroyDragHelper();
            this._contentDragHelper = new pc.ElementDragHelper(this._contentReference.entity.element);
            this._contentDragHelper.on('drag:start', this._onContentDragStart, this);
            this._contentDragHelper.on('drag:end', this._onContentDragEnd, this);
            this._contentDragHelper.on('drag:move', this._onContentDragMove, this);

            this._prevContentSizes[pc.ORIENTATION_HORIZONTAL] = null;
            this._prevContentSizes[pc.ORIENTATION_VERTICAL] = null;

            this._syncAll();
        },

        _onContentElementLose: function () {
            this._destroyDragHelper();
        },

        _onContentDragStart: function () {
            if (this._contentReference.entity && this.enabled && this.entity.enabled) {
                this._dragStartPosition.copy(this._contentReference.entity.getLocalPosition());
            }
        },

        _onContentDragEnd: function () {
            this._prevContentDragPosition = null;
            this._enableContentInput();
        },

        _onContentDragMove: function (position) {
            if (this._contentReference.entity && this.enabled && this.entity.enabled) {
                this._wasDragged = true;
                this._setScrollFromContentPosition(position);
                this._setVelocityFromContentPositionDelta(position);

                // if we haven't already, when scrolling starts
                // disable input on all child elements
                if (!this._disabledContentInput) {

                    // Disable input events on content after we've moved past a threshold value
                    var dx = (position.x - this._dragStartPosition.x);
                    var dy = (position.y - this._dragStartPosition.y);

                    if (Math.abs(dx) > this.dragThreshold ||
                        Math.abs(dy) > this.dragThreshold) {
                        this._disableContentInput();
                    }

                }
            }
        },

        _onSetContentOrViewportSize: function () {
            this._syncAll();
        },

        _onSetHorizontalScrollbarValue: function (scrollValueX) {
            if (!this._scrollbarUpdateFlags[pc.ORIENTATION_HORIZONTAL] && this.enabled && this.entity.enabled) {
                this._onSetScroll(scrollValueX, null);
            }
        },

        _onSetVerticalScrollbarValue: function (scrollValueY) {
            if (!this._scrollbarUpdateFlags[pc.ORIENTATION_VERTICAL] && this.enabled && this.entity.enabled) {
                this._onSetScroll(null, scrollValueY);
            }
        },

        _onSetHorizontalScrollingEnabled: function () {
            this._syncScrollbarEnabledState(pc.ORIENTATION_HORIZONTAL);
        },

        _onSetVerticalScrollingEnabled: function () {
            this._syncScrollbarEnabledState(pc.ORIENTATION_VERTICAL);
        },

        _onHorizontalScrollbarGain: function () {
            this._syncScrollbarEnabledState(pc.ORIENTATION_HORIZONTAL);
            this._syncScrollbarPosition(pc.ORIENTATION_HORIZONTAL);
        },

        _onVerticalScrollbarGain: function () {
            this._syncScrollbarEnabledState(pc.ORIENTATION_VERTICAL);
            this._syncScrollbarPosition(pc.ORIENTATION_VERTICAL);
        },

        _onSetScroll: function (x, y, resetVelocity) {
            if (resetVelocity !== false) {
                this._velocity.set(0, 0, 0);
            }

            var hasChanged = false;
            hasChanged |= this._updateAxis(x, 'x', pc.ORIENTATION_HORIZONTAL);
            hasChanged |= this._updateAxis(y, 'y', pc.ORIENTATION_VERTICAL);

            if (hasChanged) {
                this.fire('set:scroll', this._scroll);
            }
        },

        _updateAxis: function (scrollValue, axis, orientation) {
            var hasChanged = (scrollValue !== null && Math.abs(scrollValue - this._scroll[axis]) > 1e-5);

            // always update if dragging because drag helper directly updates the entity position
            // always update if scrollValue === 0 because it will be clamped to 0
            // if viewport is larger than content and position could be moved by drag helper but
            // hasChanged will never be true
            if (hasChanged || this._isDragging() || scrollValue === 0) {
                this._scroll[axis] = this._determineNewScrollValue(scrollValue, axis, orientation);
                this._syncContentPosition(orientation);
                this._syncScrollbarPosition(orientation);
            }

            return hasChanged;
        },

        _determineNewScrollValue: function (scrollValue, axis, orientation) {
            // If scrolling is disabled for the selected orientation, force the
            // scroll position to remain at the current value
            if (!this._getScrollingEnabled(orientation)) {
                return this._scroll[axis];
            }

            switch (this.scrollMode) {
                case pc.SCROLL_MODE_CLAMP:
                    return pc.math.clamp(scrollValue, 0, this._getMaxScrollValue(orientation));

                case pc.SCROLL_MODE_BOUNCE:
                    this._setVelocityFromOvershoot(scrollValue, axis, orientation);
                    return scrollValue;

                case pc.SCROLL_MODE_INFINITE:
                    return scrollValue;

                default:
                    console.warn('Unhandled scroll mode:' + this.scrollMode);
                    return scrollValue;
            }
        },

        _syncAll: function () {
            this._syncContentPosition(pc.ORIENTATION_HORIZONTAL);
            this._syncContentPosition(pc.ORIENTATION_VERTICAL);
            this._syncScrollbarPosition(pc.ORIENTATION_HORIZONTAL);
            this._syncScrollbarPosition(pc.ORIENTATION_VERTICAL);
            this._syncScrollbarEnabledState(pc.ORIENTATION_HORIZONTAL);
            this._syncScrollbarEnabledState(pc.ORIENTATION_VERTICAL);
        },

        _syncContentPosition: function (orientation) {
            var axis = this._getAxis(orientation);
            var sign = this._getSign(orientation);
            var contentEntity = this._contentReference.entity;

            if (contentEntity) {
                var prevContentSize = this._prevContentSizes[orientation];
                var currContentSize = this._getContentSize(orientation);

                // If the content size has changed, adjust the scroll value so that the content will
                // stay in the same place from the user's perspective.
                if (prevContentSize !== null && Math.abs(prevContentSize - currContentSize) > 1e-4) {
                    var prevMaxOffset = this._getMaxOffset(orientation, prevContentSize);
                    var currMaxOffset = this._getMaxOffset(orientation, currContentSize);
                    if (currMaxOffset === 0) {
                        this._scroll[axis] = 1;
                    } else {
                        this._scroll[axis] = pc.math.clamp(this._scroll[axis] * prevMaxOffset / currMaxOffset, 0, 1);
                    }
                }

                var offset = this._scroll[axis] * this._getMaxOffset(orientation);
                var contentPosition = contentEntity.getLocalPosition();
                contentPosition[axis] = offset * sign;

                contentEntity.setLocalPosition(contentPosition);

                this._prevContentSizes[orientation] = currContentSize;
            }
        },

        _syncScrollbarPosition: function (orientation) {
            var axis = this._getAxis(orientation);
            var scrollbarEntity = this._scrollbarReferences[orientation].entity;

            if (scrollbarEntity && scrollbarEntity.scrollbar) {
                // Setting the value of the scrollbar will fire a 'set:value' event, which in turn
                // will call the _onSetHorizontalScrollbarValue/_onSetVerticalScrollbarValue handlers
                // and cause a cycle. To avoid this we keep track of the fact that we're in the process
                // of updating the scrollbar value.
                this._scrollbarUpdateFlags[orientation] = true;
                scrollbarEntity.scrollbar.value = this._scroll[axis];
                scrollbarEntity.scrollbar.handleSize = this._getScrollbarHandleSize(axis, orientation);
                this._scrollbarUpdateFlags[orientation] = false;
            }
        },

        // Toggles the scrollbar entities themselves to be enabled/disabled based
        // on whether the user has enabled horizontal/vertical scrolling on the
        // scroll view.
        _syncScrollbarEnabledState: function (orientation) {
            var entity = this._scrollbarReferences[orientation].entity;

            if (entity) {
                var isScrollingEnabled = this._getScrollingEnabled(orientation);
                var requestedVisibility = this._getScrollbarVisibility(orientation);

                switch (requestedVisibility) {
                    case pc.SCROLLBAR_VISIBILITY_SHOW_ALWAYS:
                        entity.enabled = isScrollingEnabled;
                        return;

                    case pc.SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED:
                        entity.enabled = isScrollingEnabled && this._contentIsLargerThanViewport(orientation);
                        return;

                    default:
                        console.warn('Unhandled scrollbar visibility:' + requestedVisibility);
                        entity.enabled = isScrollingEnabled;
                }
            }
        },

        _contentIsLargerThanViewport: function (orientation) {
            return this._getContentSize(orientation) > this._getViewportSize(orientation);
        },

        _contentPositionToScrollValue: function (contentPosition) {
            var maxOffsetH = this._getMaxOffset(pc.ORIENTATION_HORIZONTAL);
            var maxOffsetV = this._getMaxOffset(pc.ORIENTATION_VERTICAL);

            if (maxOffsetH === 0) {
                _tempScrollValue.x = 0;
            } else {
                _tempScrollValue.x = contentPosition.x / maxOffsetH;
            }

            if (maxOffsetV === 0) {
                _tempScrollValue.y = 0;
            } else {
                _tempScrollValue.y = contentPosition.y / -maxOffsetV;
            }

            return _tempScrollValue;
        },

        _getMaxOffset: function (orientation, contentSize) {
            contentSize = contentSize === undefined ? this._getContentSize(orientation) : contentSize;

            var viewportSize = this._getViewportSize(orientation);

            if (contentSize < viewportSize) {
                return -this._getViewportSize(orientation);
            }

            return viewportSize - contentSize;
        },

        _getMaxScrollValue: function (orientation) {
            return this._contentIsLargerThanViewport(orientation) ? 1 : 0;
        },

        _getScrollbarHandleSize: function (axis, orientation) {
            var viewportSize = this._getViewportSize(orientation);
            var contentSize = this._getContentSize(orientation);

            if (Math.abs(contentSize) < 0.001) {
                return 1;
            }

            var handleSize = Math.min(viewportSize / contentSize, 1);
            var overshoot = this._toOvershoot(this._scroll[axis], orientation);

            if (overshoot === 0) {
                return handleSize;
            }

            // Scale the handle down when the content has been dragged past the bounds
            return handleSize / (1 + Math.abs(overshoot));
        },

        _getViewportSize: function (orientation) {
            return this._getSize(orientation, this._viewportReference);
        },

        _getContentSize: function (orientation) {
            return this._getSize(orientation, this._contentReference);
        },

        _getSize: function (orientation, entityReference) {
            if (entityReference.entity && entityReference.entity.element) {
                return entityReference.entity.element[this._getCalculatedDimension(orientation)];
            }

            return 0;
        },

        _getScrollingEnabled: function (orientation) {
            if (orientation === pc.ORIENTATION_HORIZONTAL) {
                return this.horizontal;
            } else if (orientation === pc.ORIENTATION_VERTICAL) {
                return this.vertical;
            }

            console.warn('Unrecognized orientation: ' + orientation);
        },

        _getScrollbarVisibility: function (orientation) {
            if (orientation === pc.ORIENTATION_HORIZONTAL) {
                return this.horizontalScrollbarVisibility;
            } else if (orientation === pc.ORIENTATION_VERTICAL) {
                return this.verticalScrollbarVisibility;
            }

            console.warn('Unrecognized orientation: ' + orientation);
        },

        _getSign: function (orientation) {
            return orientation === pc.ORIENTATION_HORIZONTAL ? 1 : -1;
        },

        _getAxis: function (orientation) {
            return orientation === pc.ORIENTATION_HORIZONTAL ? 'x' : 'y';
        },

        _getCalculatedDimension: function (orientation) {
            return orientation === pc.ORIENTATION_HORIZONTAL ? 'calculatedWidth' : 'calculatedHeight';
        },

        _destroyDragHelper: function () {
            if (this._contentDragHelper) {
                this._contentDragHelper.destroy();
            }
        },

        onUpdate: function () {
            if (this._contentReference.entity) {
                this._updateVelocity();
                this._syncScrollbarEnabledState(pc.ORIENTATION_HORIZONTAL);
                this._syncScrollbarEnabledState(pc.ORIENTATION_VERTICAL);
            }
        },

        _updateVelocity: function () {
            if (!this._isDragging()) {
                if (this.scrollMode === pc.SCROLL_MODE_BOUNCE) {
                    if (this._hasOvershoot('x', pc.ORIENTATION_HORIZONTAL)) {
                        this._setVelocityFromOvershoot(this.scroll.x, 'x', pc.ORIENTATION_HORIZONTAL);
                    }

                    if (this._hasOvershoot('y', pc.ORIENTATION_VERTICAL)) {
                        this._setVelocityFromOvershoot(this.scroll.y, 'y', pc.ORIENTATION_VERTICAL);
                    }
                }

                this._velocity.x *= (1 - this.friction);
                this._velocity.y *= (1 - this.friction);

                if (Math.abs(this._velocity.x) > 1e-4 || Math.abs(this._velocity.y) > 1e-4) {
                    var position = this._contentReference.entity.getLocalPosition();
                    position.x += this._velocity.x;
                    position.y += this._velocity.y;
                    this._contentReference.entity.setLocalPosition(position);

                    this._setScrollFromContentPosition(position);
                }
            }
        },

        _hasOvershoot: function (axis, orientation) {
            return Math.abs(this._toOvershoot(this.scroll[axis], orientation)) > 0.001;
        },

        _toOvershoot: function (scrollValue, orientation) {
            var maxScrollValue = this._getMaxScrollValue(orientation);

            if (scrollValue < 0) {
                return scrollValue;
            } else if (scrollValue > maxScrollValue) {
                return scrollValue - maxScrollValue;
            }

            return 0;
        },

        _setVelocityFromOvershoot: function (scrollValue, axis, orientation) {
            var overshootValue = this._toOvershoot(scrollValue, orientation);
            var overshootPixels = overshootValue * this._getMaxOffset(orientation) * this._getSign(orientation);

            if (Math.abs(overshootPixels) > 0) {
                // 50 here is just a magic number – it seems to give us a range of useful
                // range of bounceAmount values, so that 0.1 is similar to the iOS bounce
                // feel, 1.0 is much slower, etc. The + 1 means that when bounceAmount is
                // 0, the content will just snap back immediately instead of moving gradually.
                this._velocity[axis] = -overshootPixels / (this.bounceAmount * 50 + 1);
            }
        },

        _setVelocityFromContentPositionDelta: function (position) {
            if (this._prevContentDragPosition) {
                this._velocity.sub2(position, this._prevContentDragPosition);
                this._prevContentDragPosition.copy(position);
            } else {
                this._velocity.set(0, 0, 0);
                this._prevContentDragPosition = position.clone();
            }
        },

        _setScrollFromContentPosition: function (position) {
            var scrollValue = this._contentPositionToScrollValue(position);

            if (this._isDragging()) {
                scrollValue = this._applyScrollValueTension(scrollValue);
            }

            this._onSetScroll(scrollValue.x, scrollValue.y, false);
        },

        // Create nice tension effect when dragging past the extents of the viewport
        _applyScrollValueTension: function (scrollValue) {
            var max;
            var overshoot;
            var factor = 1;

            max = this._getMaxScrollValue(pc.ORIENTATION_HORIZONTAL);
            overshoot = this._toOvershoot(scrollValue.x, pc.ORIENTATION_HORIZONTAL);
            if (overshoot > 0) {
                scrollValue.x = max + factor * Math.log10(1 + overshoot);
            } else if (overshoot < 0) {
                scrollValue.x = -factor * Math.log10(1 - overshoot);
            }

            max = this._getMaxScrollValue(pc.ORIENTATION_VERTICAL);
            overshoot = this._toOvershoot(scrollValue.y, pc.ORIENTATION_VERTICAL);

            if (overshoot > 0) {
                scrollValue.y = max + factor * Math.log10(1 + overshoot);
            } else if (overshoot < 0) {
                scrollValue.y = -factor * Math.log10(1 - overshoot);
            }

            return scrollValue;
        },

        _isDragging: function () {
            return this._contentDragHelper && this._contentDragHelper.isDragging;
        },

        _setScrollbarComponentsEnabled: function (enabled) {
            if (this._scrollbarReferences[pc.ORIENTATION_HORIZONTAL].hasComponent('scrollbar')) {
                this._scrollbarReferences[pc.ORIENTATION_HORIZONTAL].entity.scrollbar.enabled = enabled;
            }

            if (this._scrollbarReferences[pc.ORIENTATION_VERTICAL].hasComponent('scrollbar')) {
                this._scrollbarReferences[pc.ORIENTATION_VERTICAL].entity.scrollbar.enabled = enabled;
            }
        },

        _setContentDraggingEnabled: function (enabled) {
            if (this._contentDragHelper) {
                this._contentDragHelper.enabled = enabled;
            }
        },

        // re-enable useInput flag on any descendent that was disabled
        _enableContentInput: function () {
            while (this._disabledContentInputEntities.length) {
                var e = this._disabledContentInputEntities.pop();
                if (e.element) {
                    e.element.useInput = true;
                }
            }

            this._disabledContentInput = false;
        },

        // disable useInput flag on all descendents of this contentEntity
        _disableContentInput: function () {
            var self = this;
            var _disableInput = function (e) {
                if (e.element && e.element.useInput) {
                    self._disabledContentInputEntities.push(e);
                    e.element.useInput = false;
                }

                var children = e.children;
                var i, l;
                for (i = 0, l = children.length; i < l; i++) {
                    _disableInput(children[i]);
                }
            };

            var contentEntity = this._contentReference.entity;
            if (contentEntity) {
                // disable input recursively for all children of the content entity
                var children = contentEntity.children;
                var i, l = children.length;
                for (i = 0; i < l; i++) {
                    _disableInput(children[i]);
                }
            }

            this._disabledContentInput = true;
        },

        onEnable: function () {
            this._viewportReference.onParentComponentEnable();
            this._contentReference.onParentComponentEnable();
            this._scrollbarReferences[pc.ORIENTATION_HORIZONTAL].onParentComponentEnable();
            this._scrollbarReferences[pc.ORIENTATION_VERTICAL].onParentComponentEnable();
            this._setScrollbarComponentsEnabled(true);
            this._setContentDraggingEnabled(true);

            this._syncAll();
        },

        onDisable: function () {
            this._setScrollbarComponentsEnabled(false);
            this._setContentDraggingEnabled(false);
        },

        onRemove: function () {
            this._toggleLifecycleListeners('off', this.system);
            this._toggleElementListeners('off');
            this._destroyDragHelper();
        }
    });

    Object.defineProperty(ScrollViewComponent.prototype, 'scroll', {
        get: function () {
            return this._scroll;
        },

        set: function (value) {
            this._onSetScroll(value.x, value.y);
        }
    });

    return {
        ScrollViewComponent: ScrollViewComponent
    };
}());

/**
 * @event
 * @name pc.ScrollViewComponent#set:scroll
 * @description Fired whenever the scroll position changes.
 * @param {pc.Vec2} scrollPosition Horizontal and vertical scroll values in the range 0...1.
 */
