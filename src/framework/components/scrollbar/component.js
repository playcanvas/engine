Object.assign(pc, function () {
    /**
     * @private
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
        pc.Component.call(this, system, entity);

        this._app = system.app;

        this._handleReference = new pc.EntityReference(this, 'handleEntity', {
            'element#gain': this._onHandleElementGain,
            'element#lose': this._onHandleElementLose,
            'element#set:anchor': this._onSetHandleAlignment,
            'element#set:margin': this._onSetHandleAlignment,
            'element#set:pivot': this._onSetHandleAlignment
        });

        this._toggleLifecycleListeners('on');
    };
    ScrollbarComponent.prototype = Object.create(pc.Component.prototype);
    ScrollbarComponent.prototype.constructor = ScrollbarComponent;

    Object.assign(ScrollbarComponent.prototype, {
        _toggleLifecycleListeners: function (onOrOff) {
            this[onOrOff]('set_value', this._onSetValue, this);
            this[onOrOff]('set_handleSize', this._onSetHandleSize, this);
            this[onOrOff]('set_orientation', this._onSetOrientation, this);

            // TODO Handle scrollwheel events
        },

        _onHandleElementGain: function () {
            this._destroyDragHelper();
            this._handleDragHelper = new pc.ElementDragHelper(this._handleReference.entity.element, this._getAxis());
            this._handleDragHelper.on('drag:move', this._onHandleDrag, this);

            this._updateHandlePositionAndSize();
        },

        _onHandleElementLose: function () {
            this._destroyDragHelper();
        },

        _onHandleDrag: function (position) {
            if (this._handleReference.entity && this.enabled && this.entity.enabled) {
                this.value = this._handlePositionToScrollValue(position[this._getAxis()]);
            }
        },

        _onSetValue: function (name, oldValue, newValue) {
            if (Math.abs(newValue - oldValue) > 1e-5) {
                this.data.value = pc.math.clamp(newValue, 0, 1);
                this._updateHandlePositionAndSize();
                this.fire('set:value', this.data.value);
            }
        },

        _onSetHandleSize: function (name, oldValue, newValue) {
            if (Math.abs(newValue - oldValue) > 1e-5) {
                this.data.handleSize = pc.math.clamp(newValue, 0, 1);
                this._updateHandlePositionAndSize();
            }
        },

        _onSetHandleAlignment: function () {
            this._updateHandlePositionAndSize();
        },

        _onSetOrientation: function (name, oldValue, newValue) {
            if (newValue !== oldValue && this._handleReference.hasComponent('element')) {
                this._handleReference.entity.element[this._getOppositeDimension()] = 0;
            }
        },

        _updateHandlePositionAndSize: function () {
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

        _handlePositionToScrollValue: function (handlePosition) {
            return handlePosition * this._getSign() / this._getUsableTrackLength();
        },

        _scrollValueToHandlePosition: function (value) {
            return value * this._getSign() * this._getUsableTrackLength();
        },

        _getUsableTrackLength: function () {
            return Math.max(this._getTrackLength() - this._getHandleLength(), 0.001);
        },

        _getTrackLength: function () {
            if (this.entity.element) {
                return this.orientation === pc.ORIENTATION_HORIZONTAL ? this.entity.element.calculatedWidth : this.entity.element.calculatedHeight;
            }

            return 0;
        },

        _getHandleLength: function () {
            return this._getTrackLength() * this.handleSize;
        },

        _getHandlePosition: function () {
            return this._scrollValueToHandlePosition(this.value);
        },

        _getSign: function () {
            return this.orientation === pc.ORIENTATION_HORIZONTAL ? 1 : -1;
        },

        _getAxis: function () {
            return this.orientation === pc.ORIENTATION_HORIZONTAL ? 'x' : 'y';
        },

        _getDimension: function () {
            return this.orientation === pc.ORIENTATION_HORIZONTAL ? 'width' : 'height';
        },

        _getOppositeDimension: function () {
            return this.orientation === pc.ORIENTATION_HORIZONTAL ? 'height' : 'width';
        },

        _destroyDragHelper: function () {
            if (this._handleDragHelper) {
                this._handleDragHelper.destroy();
            }
        },

        _setHandleDraggingEnabled: function (enabled) {
            if (this._handleDragHelper) {
                this._handleDragHelper.enabled = enabled;
            }
        },

        onEnable: function () {
            this._handleReference.onParentComponentEnable();
            this._setHandleDraggingEnabled(true);
        },

        onDisable: function () {
            this._setHandleDraggingEnabled(false);
        },

        onRemove: function () {
            this._destroyDragHelper();
            this._toggleLifecycleListeners('off');
        }
    });

    return {
        ScrollbarComponent: ScrollbarComponent
    };
}());

/**
 * @event
 * @private
 * @name pc.ScrollbarComponent#set:value
 * @description Fired whenever the scroll value changes.
 * @param {Number} value The current scroll value.
 */
