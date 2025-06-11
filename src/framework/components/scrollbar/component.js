import { math } from '../../../core/math/math.js';
import { ORIENTATION_HORIZONTAL } from '../../../scene/constants.js';

import { GraphNode } from '../../../scene/graph-node.js';

import { Component } from '../component.js';
import { ElementDragHelper } from '../element/element-drag-helper.js';

/**
 * @import { EventHandle } from '../../../core/event-handle.js'
 * @import { Entity } from '../../entity.js'
 * @import { ScrollbarComponentData } from './data.js'
 * @import { ScrollbarComponentSystem } from './system.js'
 */

/**
 * A ScrollbarComponent enables a group of entities to behave like a draggable scrollbar.
 *
 * @hideconstructor
 * @category User Interface
 */
class ScrollbarComponent extends Component {
    /**
     * Fired whenever the scroll value changes. The handler is passed a number representing the
     * current scroll value.
     *
     * @event
     * @example
     * entity.scrollbar.on('set:value', (value) => {
     *     console.log(`Scroll value is now ${value}`);
     * });
     */
    static EVENT_SETVALUE = 'set:value';

    /**
     * @type {Entity|null}
     * @private
     */
    _handleEntity = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtHandleEntityElementAdd = null;

    /**
     * @type {EventHandle[]}
     * @private
     */
    _evtHandleEntityChanges = [];

    /**
     * Create a new ScrollbarComponent.
     *
     * @param {ScrollbarComponentSystem} system - The ComponentSystem that created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) {
        super(system, entity);
        this._toggleLifecycleListeners('on');
    }

    // TODO: Remove this override in upgrading component
    /**
     * @type {ScrollbarComponentData}
     * @ignore
     */
    get data() {
        const record = this.system.store[this.entity.getGuid()];
        return record ? record.data : null;
    }

    /**
     * Sets the enabled state of the component.
     *
     * @type {boolean}
     */
    set enabled(arg) {
        this._setValue('enabled', arg);
    }

    /**
     * Gets the enabled state of the component.
     *
     * @type {boolean}
     */
    get enabled() {
        return this.data.enabled;
    }

    /**
     * Sets whether the scrollbar moves horizontally or vertically. Can be:
     *
     * - {@link ORIENTATION_HORIZONTAL}: The scrollbar animates in the horizontal axis.
     * - {@link ORIENTATION_VERTICAL}: The scrollbar animates in the vertical axis.
     *
     * Defaults to {@link ORIENTATION_HORIZONTAL}.
     *
     * @type {number}
     */
    set orientation(arg) {
        this._setValue('orientation', arg);
    }

    /**
     * Gets whether the scrollbar moves horizontally or vertically.
     *
     * @type {number}
     */
    get orientation() {
        return this.data.orientation;
    }

    /**
     * Sets the current position value of the scrollbar, in the range 0 to 1. Defaults to 0.
     *
     * @type {number}
     */
    set value(arg) {
        this._setValue('value', arg);
    }

    /**
     * Gets the current position value of the scrollbar.
     *
     * @type {number}
     */
    get value() {
        return this.data.value;
    }

    /**
     * Sets the size of the handle relative to the size of the track, in the range 0 to 1. For a
     * vertical scrollbar, a value of 1 means that the handle will take up the full height of the
     * track.
     *
     * @type {number}
     */
    set handleSize(arg) {
        this._setValue('handleSize', arg);
    }

    /**
     * Gets the size of the handle relative to the size of the track.
     *
     * @type {number}
     */
    get handleSize() {
        return this.data.handleSize;
    }

    /**
     * Sets the entity to be used as the scrollbar handle. This entity must have a
     * {@link ScrollbarComponent}.
     *
     * @type {Entity|string|null}
     */
    set handleEntity(arg) {
        if (this._handleEntity === arg) {
            return;
        }

        const isString = typeof arg === 'string';
        if (this._handleEntity && isString && this._handleEntity.getGuid() === arg) {
            return;
        }

        if (this._handleEntity) {
            this._handleEntityUnsubscribe();
        }

        if (arg instanceof GraphNode) {
            this._handleEntity = arg;
        } else if (isString) {
            this._handleEntity = this.system.app.getEntityFromIndex(arg) || null;
        } else {
            this._handleEntity = null;
        }

        if (this._handleEntity) {
            this._handleEntitySubscribe();
        }

        if (this._handleEntity) {
            this.data.handleEntity = this._handleEntity.getGuid();
        } else if (isString && arg) {
            this.data.handleEntity = arg;
        }
    }

    /**
     * Gets the entity to be used as the scrollbar handle.
     *
     * @type {Entity|null}
     */
    get handleEntity() {
        return this._handleEntity;
    }

    /** @ignore */
    _setValue(name, value) {
        const data = this.data;
        const oldValue = data[name];
        data[name] = value;
        this.fire('set', name, oldValue, value);
    }

    /**
     * @param {string} onOrOff - 'on' or 'off'.
     * @private
     */
    _toggleLifecycleListeners(onOrOff) {
        this[onOrOff]('set_value', this._onSetValue, this);
        this[onOrOff]('set_handleSize', this._onSetHandleSize, this);
        this[onOrOff]('set_orientation', this._onSetOrientation, this);

        // TODO Handle scrollwheel events
    }

    _handleEntitySubscribe() {
        this._evtHandleEntityElementAdd = this._handleEntity.on('element:add', this._onHandleElementGain, this);

        if (this._handleEntity.element) {
            this._onHandleElementGain();
        }
    }

    _handleEntityUnsubscribe() {
        this._evtHandleEntityElementAdd?.off();
        this._evtHandleEntityElementAdd = null;

        if (this._handleEntity?.element) {
            this._onHandleElementLose();
        }
    }

    _handleEntityElementSubscribe() {
        const element = this._handleEntity.element;

        const handles = this._evtHandleEntityChanges;
        handles.push(element.once('beforeremove', this._onHandleElementLose, this));
        handles.push(element.on('set:anchor', this._onSetHandleAlignment, this));
        handles.push(element.on('set:margin', this._onSetHandleAlignment, this));
        handles.push(element.on('set:pivot', this._onSetHandleAlignment, this));
    }

    _handleEntityElementUnsubscribe() {
        for (let i = 0; i < this._evtHandleEntityChanges.length; i++) {
            this._evtHandleEntityChanges[i].off();
        }
        this._evtHandleEntityChanges.length = 0;
    }

    _onHandleElementGain() {
        this._handleEntityElementSubscribe();
        this._destroyDragHelper();
        this._handleDragHelper = new ElementDragHelper(this._handleEntity.element, this._getAxis());
        this._handleDragHelper.on('drag:move', this._onHandleDrag, this);

        this._updateHandlePositionAndSize();
    }

    _onHandleElementLose() {
        this._handleEntityElementUnsubscribe();
        this._destroyDragHelper();
    }

    _onHandleDrag(position) {
        if (this._handleEntity && this.enabled && this.entity.enabled) {
            this.value = this._handlePositionToScrollValue(position[this._getAxis()]);
        }
    }

    _onSetValue(name, oldValue, newValue) {
        if (Math.abs(newValue - oldValue) > 1e-5) {
            this.data.value = math.clamp(newValue, 0, 1);
            this._updateHandlePositionAndSize();
            this.fire('set:value', this.data.value);
        }
    }

    _onSetHandleSize(name, oldValue, newValue) {
        if (Math.abs(newValue - oldValue) > 1e-5) {
            this.data.handleSize = math.clamp(newValue, 0, 1);
            this._updateHandlePositionAndSize();
        }
    }

    _onSetHandleAlignment() {
        this._updateHandlePositionAndSize();
    }

    _onSetOrientation(name, oldValue, newValue) {
        if (newValue !== oldValue && this._handleEntity?.element) {
            this._handleEntity.element[this._getOppositeDimension()] = 0;
        }
    }

    _updateHandlePositionAndSize() {
        const handleEntity = this._handleEntity;
        const handleElement = handleEntity?.element;

        if (handleEntity) {
            const position = handleEntity.getLocalPosition();
            position[this._getAxis()] = this._getHandlePosition();
            handleEntity.setLocalPosition(position);
        }

        if (handleElement) {
            handleElement[this._getDimension()] = this._getHandleLength();
        }
    }

    _handlePositionToScrollValue(handlePosition) {
        return handlePosition * this._getSign() / this._getUsableTrackLength();
    }

    _scrollValueToHandlePosition(value) {
        return value * this._getSign() * this._getUsableTrackLength();
    }

    _getUsableTrackLength() {
        return Math.max(this._getTrackLength() - this._getHandleLength(), 0.001);
    }

    _getTrackLength() {
        if (this.entity.element) {
            return this.orientation === ORIENTATION_HORIZONTAL ? this.entity.element.calculatedWidth : this.entity.element.calculatedHeight;
        }

        return 0;
    }

    _getHandleLength() {
        return this._getTrackLength() * this.handleSize;
    }

    _getHandlePosition() {
        return this._scrollValueToHandlePosition(this.value);
    }

    _getSign() {
        return this.orientation === ORIENTATION_HORIZONTAL ? 1 : -1;
    }

    _getAxis() {
        return this.orientation === ORIENTATION_HORIZONTAL ? 'x' : 'y';
    }

    _getDimension() {
        return this.orientation === ORIENTATION_HORIZONTAL ? 'width' : 'height';
    }

    _getOppositeDimension() {
        return this.orientation === ORIENTATION_HORIZONTAL ? 'height' : 'width';
    }

    _destroyDragHelper() {
        if (this._handleDragHelper) {
            this._handleDragHelper.destroy();
        }
    }

    _setHandleDraggingEnabled(enabled) {
        if (this._handleDragHelper) {
            this._handleDragHelper.enabled = enabled;
        }
    }

    onEnable() {
        this._setHandleDraggingEnabled(true);
    }

    onDisable() {
        this._setHandleDraggingEnabled(false);
    }

    onRemove() {
        this._destroyDragHelper();
        this._toggleLifecycleListeners('off');
    }

    resolveDuplicatedEntityReferenceProperties(oldScrollbar, duplicatedIdsMap) {
        if (oldScrollbar.handleEntity) {
            this.handleEntity = duplicatedIdsMap[oldScrollbar.handleEntity.getGuid()];
        }
    }
}

export { ScrollbarComponent };
