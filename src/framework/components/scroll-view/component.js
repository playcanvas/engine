pc.extend(pc, function () {
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
            'element#gain': this._onContentElementGain
        });

        this._horizontalScrollbarReference = new pc.EntityReference(this, 'horizontalScrollbarEntity', {
            'scrollbar#set:value': this._onHorizontalScrollValueChange
        });

        this._verticalScrollbarReference = new pc.EntityReference(this, 'verticalScrollbarEntity', {
            'scrollbar#set:value': this._onVerticalScrollValueChange
        });
    };
    ScrollViewComponent = pc.inherits(ScrollViewComponent, pc.Component);

    pc.extend(ScrollViewComponent.prototype, {
        _onContentElementGain: function() {

        },

        _onHorizontalScrollValueChange: function(value) {
            this._updateOffset(value, pc.ORIENTATION_HORIZONTAL);
        },

        _onVerticalScrollValueChange: function(value) {
            this._updateOffset(value, pc.ORIENTATION_VERTICAL);
        },

        _updateOffset: function(value, orientation) {
            var offset = value * this._getMaxOffset(orientation);

            if (this._contentReference.entity) {
                var position = this._contentReference.entity.getLocalPosition();
                position[this._getAxis(orientation)] = offset * this._getSign(orientation);
                this._contentReference.entity.setLocalPosition(position);
            }
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

        onEnable: function () {

        },

        onDisable: function () {

        },

        onRemove: function () {

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
