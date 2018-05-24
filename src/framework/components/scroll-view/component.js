pc.extend(pc, function () {
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
        this._viewportReference = new pc.EntityReference(this, 'viewportEntity');
        this._contentReference = new pc.EntityReference(this, 'contentEntity', {
            'element#gain': this._onContentElementGain,
            'element#lose': this._onContentElementLose
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

        this._scroll = new pc.Vec2();

        this._toggleLifecycleListeners('on');
    };
    ScrollViewComponent = pc.inherits(ScrollViewComponent, pc.Component);

    pc.extend(ScrollViewComponent.prototype, {
        _toggleLifecycleListeners: function(onOrOff) {
            // TODO Handle scrollwheel events
        },

        _onContentElementGain: function() {
            this._destroyDragHelper();
            this._contentDragHelper = new pc.ElementDragHelper(this._contentReference.entity.element);
            this._contentDragHelper.on('drag', this._onContentDrag, this);

            this._syncContentPosition(pc.ORIENTATION_HORIZONTAL);
            this._syncContentPosition(pc.ORIENTATION_VERTICAL);
        },

        _onContentElementLose: function() {
            this._destroyDragHelper();
        },

        _onContentDrag: function(position) {
            if (this._contentReference.entity && this.enabled && this.entity.enabled) {
                var value = this._contentPositionToScrollValue(position);
                this._onSetScroll(value.x, value.y);
            }
        },

        _onSetHorizontalScrollbarValue: function(value) {
            this._scrollbarUpdateFlags[pc.ORIENTATION_HORIZONTAL] = true;
            this._onSetScroll(value, null);
            this._scrollbarUpdateFlags[pc.ORIENTATION_HORIZONTAL] = false;
        },

        _onSetVerticalScrollbarValue: function(value) {
            this._scrollbarUpdateFlags[pc.ORIENTATION_VERTICAL] = true;
            this._onSetScroll(null, value);
            this._scrollbarUpdateFlags[pc.ORIENTATION_VERTICAL] = false;
        },

        _onHorizontalScrollbarGain: function() {
            this._syncScrollbarPosition(pc.ORIENTATION_HORIZONTAL);
        },

        _onVerticalScrollbarGain: function() {
            this._syncScrollbarPosition(pc.ORIENTATION_VERTICAL);
        },

        _onSetScroll: function(x, y) {
            var hasChanged = false;
            hasChanged |= this._updateAxis(x, 'x', pc.ORIENTATION_HORIZONTAL);
            hasChanged |= this._updateAxis(y, 'y', pc.ORIENTATION_VERTICAL);

            if (hasChanged) {
                this.fire('set:scroll', this._scroll);
            }
        },

        _updateAxis: function(value, axis, orientation) {
            var hasChanged = (value !== null && Math.abs(value - this._scroll[axis]) > 1e-5);

            if (hasChanged) {
                this._scroll[axis] = pc.math.clamp(value, 0, 1);
                this._syncContentPosition(orientation);
                this._syncScrollbarPosition(orientation);
            }

            return hasChanged;
        },

        _syncContentPosition: function(orientation) {
            var axis = this._getAxis(orientation);
            var sign = this._getSign(orientation);
            var contentEntity = this._contentReference.entity;

            if (contentEntity) {
                var offset = this._scroll[axis] * this._getMaxOffset(orientation);
                var contentPosition = contentEntity.getLocalPosition();
                contentPosition[axis] = offset * sign;
                contentEntity.setLocalPosition(contentPosition);
            }
        },

        _syncScrollbarPosition: function(orientation) {
            var axis = this._getAxis(orientation);
            var scrollbarEntity = this._scrollbarReferences[orientation].entity;

            if (scrollbarEntity && scrollbarEntity.scrollbar && !this._scrollbarUpdateFlags[orientation]) {
                scrollbarEntity.scrollbar.value = this._scroll[axis];
            }
        },

        _contentPositionToScrollValue: function(contentPosition) {
            return _tempScrollValue.set(
                contentPosition.x / this._getMaxOffset(pc.ORIENTATION_HORIZONTAL),
                contentPosition.y / -this._getMaxOffset(pc.ORIENTATION_VERTICAL)
            );
        },

        _getMaxOffset: function(orientation) {
            var viewportSize = this._getSize(orientation, this._viewportReference);
            var contentSize = this._getSize(orientation, this._contentReference);

            return Math.min(viewportSize - contentSize, 0);
        },

        _getSize: function(orientation, entityReference) {
            if (entityReference.entity && entityReference.entity.element) {
                return entityReference.entity.element[this._getDimension(orientation)];
            }

            return 0;
        },

        _getSign: function(orientation) {
            return orientation === pc.ORIENTATION_HORIZONTAL ? 1 : -1;
        },

        _getAxis: function(orientation) {
            return orientation === pc.ORIENTATION_HORIZONTAL ? 'x' : 'y';
        },

        _getDimension: function(orientation) {
            return orientation === pc.ORIENTATION_HORIZONTAL ? 'width' : 'height';
        },

        _destroyDragHelper: function () {
            if (this._contentDragHelper) {
                this._contentDragHelper.destroy();
            }
        },

        onEnable: function () {

        },

        onDisable: function () {

        },

        onRemove: function () {
            this._destroyDragHelper();
        }
    });

    Object.defineProperty(ScrollViewComponent.prototype, 'scroll', {
        get: function () {
            return this._scroll;
        },

        set: function(value) {
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
