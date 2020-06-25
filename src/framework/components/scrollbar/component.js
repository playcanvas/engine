import { math } from '../../../math/math.js';

import { ORIENTATION_HORIZONTAL } from '../../../scene/constants.js';

import { Component } from '../component.js';

import { ElementDragHelper } from '../element/element-drag-helper.js';

import { EntityReference } from '../../utils/entity-reference.js';

/**
 * @component
 * @class
 * @name pc.ScrollbarComponent
 * @augments pc.Component
 * @description Create a new ScrollbarComponent.
 * @classdesc A ScrollbarComponent enables a group of entities to behave like a draggable scrollbar.
 * @param {pc.ScrollbarComponentSystem} system - The ComponentSystem that created this Component.
 * @param {pc.Entity} entity - The Entity that this Component is attached to.
 * @property {number} orientation Whether the scrollbar moves horizontally or vertically. Can be:
 *
 * * {@link pc.ORIENTATION_HORIZONTAL}: The scrollbar animates in the horizontal axis.
 * * {@link pc.ORIENTATION_VERTICAL}: The scrollbar animates in the vertical axis.
 *
 * Defaults to pc.ORIENTATION_HORIZONTAL.
 * @property {number} value The current position value of the scrollbar, in the range 0 to 1. Defaults to 0.
 * @property {number} handleSize The size of the handle relative to the size of the track, in the range
 * 0 to 1. For a vertical scrollbar, a value of 1 means that the handle will take up the full height of
 * the track.
 * @property {pc.Entity} handleEntity The entity to be used as the scrollbar handle. This entity must
 * have a Scrollbar component.
 */
function ScrollbarComponent(system, entity) {
    Component.call(this, system, entity);

    this._app = system.app;

    this._handleReference = new EntityReference(this, 'handleEntity', {
        'element#gain': this._onHandleElementGain,
        'element#lose': this._onHandleElementLose,
        'element#set:anchor': this._onSetHandleAlignment,
        'element#set:margin': this._onSetHandleAlignment,
        'element#set:pivot': this._onSetHandleAlignment
    });

    this._toggleLifecycleListeners('on');
}
ScrollbarComponent.prototype = Object.create(Component.prototype);
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
        this._handleDragHelper = new ElementDragHelper(this._handleReference.entity.element, this._getAxis());
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
            this.data.value = math.clamp(newValue, 0, 1);
            this._updateHandlePositionAndSize();
            this.fire('set:value', this.data.value);
        }
    },

    _onSetHandleSize: function (name, oldValue, newValue) {
        if (Math.abs(newValue - oldValue) > 1e-5) {
            this.data.handleSize = math.clamp(newValue, 0, 1);
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
            return this.orientation === ORIENTATION_HORIZONTAL ? this.entity.element.calculatedWidth : this.entity.element.calculatedHeight;
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
        return this.orientation === ORIENTATION_HORIZONTAL ? 1 : -1;
    },

    _getAxis: function () {
        return this.orientation === ORIENTATION_HORIZONTAL ? 'x' : 'y';
    },

    _getDimension: function () {
        return this.orientation === ORIENTATION_HORIZONTAL ? 'width' : 'height';
    },

    _getOppositeDimension: function () {
        return this.orientation === ORIENTATION_HORIZONTAL ? 'height' : 'width';
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

/**
 * @event
 * @name pc.ScrollbarComponent#set:value
 * @description Fired whenever the scroll value changes.
 * @param {number} value - The current scroll value.
 */

export { ScrollbarComponent };
