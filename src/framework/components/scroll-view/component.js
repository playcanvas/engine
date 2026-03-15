import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL } from '../../../scene/constants.js';

import { GraphNode } from '../../../scene/graph-node.js';

import { ElementDragHelper } from '../element/element-drag-helper.js';
import { SCROLL_MODE_BOUNCE, SCROLL_MODE_CLAMP, SCROLL_MODE_INFINITE, SCROLLBAR_VISIBILITY_SHOW_ALWAYS, SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED } from './constants.js';
import { Component } from '../component.js';

/**
 * @import { Entity } from '../../entity.js'
 * @import { ScrollViewComponentData } from './data.js'
 * @import { ScrollViewComponentSystem } from './system.js'
 * @import { EventHandle } from '../../../core/event-handle.js'
 */

const _tempScrollValue = new Vec2();

/**
 * A ScrollViewComponent enables a group of entities to behave like a masked scrolling area, with
 * optional horizontal and vertical scroll bars.
 *
 * @hideconstructor
 * @category User Interface
 */
class ScrollViewComponent extends Component {
    /**
     * Fired whenever the scroll position changes. The handler is passed a {@link Vec2} containing
     * the horizontal and vertical scroll values in the range 0..1.
     *
     * @event
     * @example
     * entity.scrollview.on('set:scroll', (scroll) => {
     *     console.log(`Horizontal scroll position: ${scroll.x}`);
     *     console.log(`Vertical scroll position: ${scroll.y}`);
     * });
     */
    static EVENT_SETSCROLL = 'set:scroll';

    /**
     * @type {Entity|null}
     * @private
     */
    _viewportEntity = null;

    /**
     * @type {Entity|null}
     * @private
     */
    _contentEntity = null;

    /**
     * @type {Entity|null}
     * @private
     */
    _horizontalScrollbarEntity = null;

    /**
     * @type {Entity|null}
     * @private
     */
    _verticalScrollbarEntity = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtElementRemove = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtViewportElementRemove = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtViewportResize = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtContentEntityElementAdd = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtContentElementRemove = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtContentResize = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtHorizontalScrollbarAdd = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtHorizontalScrollbarRemove = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtHorizontalScrollbarValue = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtVerticalScrollbarAdd = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtVerticalScrollbarRemove = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtVerticalScrollbarValue = null;

    /**
     * Create a new ScrollViewComponent.
     *
     * @param {ScrollViewComponentSystem} system - The ComponentSystem that created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        this._scrollbarUpdateFlags = {};

        this._scrollbarEntities = {};

        this._prevContentSizes = {};
        this._prevContentSizes[ORIENTATION_HORIZONTAL] = null;
        this._prevContentSizes[ORIENTATION_VERTICAL] = null;

        this._scroll = new Vec2();
        this._velocity = new Vec3();

        this._dragStartPosition = new Vec3();
        this._disabledContentInput = false;
        this._disabledContentInputEntities = [];

        this._toggleLifecycleListeners('on');
        this._toggleElementListeners('on');
    }

    // TODO: Remove this override in upgrading component
    /**
     * @type {ScrollViewComponentData}
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
     * Sets whether horizontal scrolling is enabled.
     *
     * @type {boolean}
     */
    set horizontal(arg) {
        this._setValue('horizontal', arg);
    }

    /**
     * Gets whether horizontal scrolling is enabled.
     *
     * @type {boolean}
     */
    get horizontal() {
        return this.data.horizontal;
    }

    /**
     * Sets whether vertical scrolling is enabled.
     *
     * @type {boolean}
     */
    set vertical(arg) {
        this._setValue('vertical', arg);
    }

    /**
     * Gets whether vertical scrolling is enabled.
     *
     * @type {boolean}
     */
    get vertical() {
        return this.data.vertical;
    }

    /**
     * Sets the scroll mode of the scroll viewer. Specifies how the scroll view should behave when
     * the user scrolls past the end of the content. Modes are defined as follows:
     *
     * - {@link SCROLL_MODE_CLAMP}: Content does not scroll any further than its bounds.
     * - {@link SCROLL_MODE_BOUNCE}: Content scrolls past its bounds and then gently bounces back.
     * - {@link SCROLL_MODE_INFINITE}: Content can scroll forever.
     *
     * @type {number}
     */
    set scrollMode(arg) {
        this._setValue('scrollMode', arg);
    }

    /**
     * Gets the scroll mode of the scroll viewer.
     *
     * @type {number}
     */
    get scrollMode() {
        return this.data.scrollMode;
    }

    /**
     * Sets how far the content should move before bouncing back.
     *
     * @type {number}
     */
    set bounceAmount(arg) {
        this._setValue('bounceAmount', arg);
    }

    /**
     * Gets how far the content should move before bouncing back.
     *
     * @type {number}
     */
    get bounceAmount() {
        return this.data.bounceAmount;
    }

    /**
     * Sets how freely the content should move if thrown, i.e. By flicking on a phone or by
     * flinging the scroll wheel on a mouse. A value of 1 means that content will stop immediately;
     * 0 means that content will continue moving forever (or until the bounds of the content are
     * reached, depending on the scrollMode).
     *
     * @type {number}
     */
    set friction(arg) {
        this._setValue('friction', arg);
    }

    /**
     * Gets how freely the content should move if thrown.
     *
     * @type {number}
     */
    get friction() {
        return this.data.friction;
    }

    set dragThreshold(arg) {
        this._setValue('dragThreshold', arg);
    }

    get dragThreshold() {
        return this.data.dragThreshold;
    }

    /**
     * Sets whether to use mouse wheel for scrolling (horizontally and vertically).
     *
     * @type {boolean}
     */
    set useMouseWheel(arg) {
        this._setValue('useMouseWheel', arg);
    }

    /**
     * Gets whether to use mouse wheel for scrolling (horizontally and vertically).
     *
     * @type {boolean}
     */
    get useMouseWheel() {
        return this.data.useMouseWheel;
    }

    /**
     * Sets the mouse wheel horizontal and vertical sensitivity. Only used if useMouseWheel is set.
     * Setting a direction to 0 will disable mouse wheel scrolling in that direction. 1 is a
     * default sensitivity that is considered to feel good. The values can be set higher or lower
     * than 1 to tune the sensitivity. Defaults to [1, 1].
     *
     * @type {Vec2}
     */
    set mouseWheelSensitivity(arg) {
        this._setValue('mouseWheelSensitivity', arg);
    }

    /**
     * Gets the mouse wheel horizontal and vertical sensitivity.
     *
     * @type {Vec2}
     */
    get mouseWheelSensitivity() {
        return this.data.mouseWheelSensitivity;
    }

    /**
     * Sets whether the horizontal scrollbar should be visible all the time, or only visible when
     * the content exceeds the size of the viewport.
     *
     * @type {number}
     */
    set horizontalScrollbarVisibility(arg) {
        this._setValue('horizontalScrollbarVisibility', arg);
    }

    /**
     * Gets whether the horizontal scrollbar should be visible all the time, or only visible when
     * the content exceeds the size of the viewport.
     *
     * @type {number}
     */
    get horizontalScrollbarVisibility() {
        return this.data.horizontalScrollbarVisibility;
    }

    /**
     * Sets whether the vertical scrollbar should be visible all the time, or only visible when the
     * content exceeds the size of the viewport.
     *
     * @type {number}
     */
    set verticalScrollbarVisibility(arg) {
        this._setValue('verticalScrollbarVisibility', arg);
    }

    /**
     * Gets whether the vertical scrollbar should be visible all the time, or only visible when the
     * content exceeds the size of the viewport.
     *
     * @type {number}
     */
    get verticalScrollbarVisibility() {
        return this.data.verticalScrollbarVisibility;
    }

    /**
     * Sets the entity to be used as the masked viewport area, within which the content will scroll.
     * This entity must have an ElementGroup component.
     *
     * @type {Entity|string|null}
     */
    set viewportEntity(arg) {
        if (this._viewportEntity === arg) {
            return;
        }

        const isString = typeof arg === 'string';
        if (this._viewportEntity && isString && this._viewportEntity.getGuid() === arg) {
            return;
        }

        if (this._viewportEntity) {
            this._viewportEntityUnsubscribe();
        }

        if (arg instanceof GraphNode) {
            this._viewportEntity = arg;
        } else if (isString) {
            this._viewportEntity = this.system.app.getEntityFromIndex(arg) || null;
        } else {
            this._viewportEntity = null;
        }

        if (this._viewportEntity) {
            this._viewportEntitySubscribe();
        }

        if (this._viewportEntity) {
            this.data.viewportEntity = this._viewportEntity.getGuid();
        } else if (isString && arg) {
            this.data.viewportEntity = arg;
        }
    }

    /**
     * Gets the entity to be used as the masked viewport area, within which the content will scroll.
     *
     * @type {Entity|null}
     */
    get viewportEntity() {
        return this._viewportEntity;
    }

    /**
     * Sets the entity which contains the scrolling content itself. This entity must have an
     * {@link ElementComponent}.
     *
     * @type {Entity|string|null}
     */
    set contentEntity(arg) {
        if (this._contentEntity === arg) {
            return;
        }

        const isString = typeof arg === 'string';
        if (this._contentEntity && isString && this._contentEntity.getGuid() === arg) {
            return;
        }

        if (this._contentEntity) {
            this._contentEntityUnsubscribe();
        }

        if (arg instanceof GraphNode) {
            this._contentEntity = arg;
        } else if (isString) {
            this._contentEntity = this.system.app.getEntityFromIndex(arg) || null;
        } else {
            this._contentEntity = null;
        }

        if (this._contentEntity) {
            this._contentEntitySubscribe();
        }

        if (this._contentEntity) {
            this.data.contentEntity = this._contentEntity.getGuid();
        } else if (isString && arg) {
            this.data.contentEntity = arg;
        }
    }

    /**
     * Gets the entity which contains the scrolling content itself.
     *
     * @type {Entity|null}
     */
    get contentEntity() {
        return this._contentEntity;
    }

    /**
     * Sets the entity to be used as the horizontal scrollbar. This entity must have a
     * {@link ScrollbarComponent}.
     *
     * @type {Entity|string|null}
     */
    set horizontalScrollbarEntity(arg) {
        if (this._horizontalScrollbarEntity === arg) {
            return;
        }

        const isString = typeof arg === 'string';
        if (this._horizontalScrollbarEntity && isString && this._horizontalScrollbarEntity.getGuid() === arg) {
            return;
        }

        if (this._horizontalScrollbarEntity) {
            this._horizontalScrollbarEntityUnsubscribe();
        }

        if (arg instanceof GraphNode) {
            this._horizontalScrollbarEntity = arg;
        } else if (isString) {
            this._horizontalScrollbarEntity = this.system.app.getEntityFromIndex(arg) || null;
        } else {
            this._horizontalScrollbarEntity = null;
        }

        this._scrollbarEntities[ORIENTATION_HORIZONTAL] = this._horizontalScrollbarEntity;

        if (this._horizontalScrollbarEntity) {
            this._horizontalScrollbarEntitySubscribe();
        }

        if (this._horizontalScrollbarEntity) {
            this.data.horizontalScrollbarEntity = this._horizontalScrollbarEntity.getGuid();
        } else if (isString && arg) {
            this.data.horizontalScrollbarEntity = arg;
        }
    }

    /**
     * Gets the entity to be used as the horizontal scrollbar.
     *
     * @type {Entity|null}
     */
    get horizontalScrollbarEntity() {
        return this._horizontalScrollbarEntity;
    }

    /**
     * Sets the entity to be used as the vertical scrollbar. This entity must have a
     * {@link ScrollbarComponent}.
     *
     * @type {Entity|string|null}
     */
    set verticalScrollbarEntity(arg) {
        if (this._verticalScrollbarEntity === arg) {
            return;
        }

        const isString = typeof arg === 'string';
        if (this._verticalScrollbarEntity && isString && this._verticalScrollbarEntity.getGuid() === arg) {
            return;
        }

        if (this._verticalScrollbarEntity) {
            this._verticalScrollbarEntityUnsubscribe();
        }

        if (arg instanceof GraphNode) {
            this._verticalScrollbarEntity = arg;
        } else if (isString) {
            this._verticalScrollbarEntity = this.system.app.getEntityFromIndex(arg) || null;
        } else {
            this._verticalScrollbarEntity = null;
        }

        this._scrollbarEntities[ORIENTATION_VERTICAL] = this._verticalScrollbarEntity;

        if (this._verticalScrollbarEntity) {
            this._verticalScrollbarEntitySubscribe();
        }

        if (this._verticalScrollbarEntity) {
            this.data.verticalScrollbarEntity = this._verticalScrollbarEntity.getGuid();
        } else if (isString && arg) {
            this.data.verticalScrollbarEntity = arg;
        }
    }

    /**
     * Gets the entity to be used as the vertical scrollbar.
     *
     * @type {Entity|null}
     */
    get verticalScrollbarEntity() {
        return this._verticalScrollbarEntity;
    }

    /**
     * Sets the scroll value.
     *
     * @type {Vec2}
     */
    set scroll(value) {
        this._onSetScroll(value.x, value.y);
    }

    /**
     * Gets the scroll value.
     *
     * @type {Vec2}
     */
    get scroll() {
        return this._scroll;
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
        this[onOrOff]('set_horizontal', this._onSetHorizontalScrollingEnabled, this);
        this[onOrOff]('set_vertical', this._onSetVerticalScrollingEnabled, this);

        this.entity[onOrOff]('element:add', this._onElementComponentAdd, this);
    }

    /**
     * @param {string} onOrOff - 'on' or 'off'.
     * @private
     */
    _toggleElementListeners(onOrOff) {
        if (this.entity.element) {
            if (onOrOff === 'on' && this._hasElementListeners) {
                return;
            }

            this.entity.element[onOrOff]('resize', this._syncAll, this);
            this.entity.element[onOrOff]('mousewheel', this._onMouseWheel, this);

            this._hasElementListeners = onOrOff === 'on';
        }
    }

    _onElementComponentAdd(entity) {
        this._evtElementRemove = this.entity.element.once('beforeremove', this._onElementComponentRemove, this);
        this._toggleElementListeners('on');
    }

    _onElementComponentRemove(entity) {
        this._evtElementRemove?.off();
        this._evtElementRemove = null;
        this._toggleElementListeners('off');
    }

    _viewportEntitySubscribe() {
        this._evtViewportEntityElementAdd = this._viewportEntity.on('element:add', this._onViewportElementGain, this);

        if (this._viewportEntity.element) {
            this._onViewportElementGain();
        }
    }

    _viewportEntityUnsubscribe() {
        this._evtViewportEntityElementAdd?.off();
        this._evtViewportEntityElementAdd = null;

        if (this._viewportEntity?.element) {
            this._onViewportElementLose();
        }
    }

    _viewportEntityElementSubscribe() {
        const element = this._viewportEntity.element;
        this._evtViewportElementRemove = element.once('beforeremove', this._onViewportElementLose, this);
        this._evtViewportResize = element.on('resize', this._syncAll, this);
    }

    _viewportEntityElementUnsubscribe() {
        this._evtViewportElementRemove?.off();
        this._evtViewportElementRemove = null;

        this._evtViewportResize?.off();
        this._evtViewportResize = null;
    }

    _onViewportElementGain() {
        this._viewportEntityElementSubscribe();
        this._syncAll();
    }

    _onViewportElementLose() {
        this._viewportEntityElementUnsubscribe();
    }

    _contentEntitySubscribe() {
        this._evtContentEntityElementAdd = this._contentEntity.on('element:add', this._onContentElementGain, this);

        if (this._contentEntity.element) {
            this._onContentElementGain();
        }
    }

    _contentEntityUnsubscribe() {
        this._evtContentEntityElementAdd?.off();
        this._evtContentEntityElementAdd = null;

        if (this._contentEntity?.element) {
            this._onContentElementLose();
        }
    }

    _contentEntityElementSubscribe() {
        const element = this._contentEntity.element;
        this._evtContentElementRemove = element.once('beforeremove', this._onContentElementLose, this);
        this._evtContentResize = element.on('resize', this._syncAll, this);
    }

    _contentEntityElementUnsubscribe() {
        this._evtContentElementRemove?.off();
        this._evtContentElementRemove = null;

        this._evtContentResize?.off();
        this._evtContentResize = null;
    }

    _onContentElementGain() {
        this._contentEntityElementSubscribe();
        this._destroyDragHelper();

        this._contentDragHelper = new ElementDragHelper(this._contentEntity.element);
        this._contentDragHelper.on('drag:start', this._onContentDragStart, this);
        this._contentDragHelper.on('drag:end', this._onContentDragEnd, this);
        this._contentDragHelper.on('drag:move', this._onContentDragMove, this);

        this._prevContentSizes[ORIENTATION_HORIZONTAL] = null;
        this._prevContentSizes[ORIENTATION_VERTICAL] = null;

        this._syncAll();
    }

    _onContentElementLose() {
        this._contentEntityElementUnsubscribe();
        this._destroyDragHelper();
    }

    _onContentDragStart() {
        if (this._contentEntity && this.enabled && this.entity.enabled) {
            this._dragStartPosition.copy(this._contentEntity.getLocalPosition());
        }
    }

    _onContentDragEnd() {
        this._prevContentDragPosition = null;
        this._enableContentInput();
    }

    _onContentDragMove(position) {
        if (this._contentEntity && this.enabled && this.entity.enabled) {
            this._wasDragged = true;
            this._setScrollFromContentPosition(position);
            this._setVelocityFromContentPositionDelta(position);

            // if we haven't already, when scrolling starts
            // disable input on all child elements
            if (!this._disabledContentInput) {
                // Disable input events on content after we've moved past a threshold value
                const dx = position.x - this._dragStartPosition.x;
                const dy = position.y - this._dragStartPosition.y;

                if (Math.abs(dx) > this.dragThreshold || Math.abs(dy) > this.dragThreshold) {
                    this._disableContentInput();
                }
            }
        }
    }

    _horizontalScrollbarEntitySubscribe() {
        this._evtHorizontalScrollbarAdd = this._horizontalScrollbarEntity.on('scrollbar:add', this._onHorizontalScrollbarGain, this);

        if (this._horizontalScrollbarEntity.scrollbar) {
            this._onHorizontalScrollbarGain();
        }
    }

    _verticalScrollbarEntitySubscribe() {
        this._evtVerticalScrollbarAdd = this._verticalScrollbarEntity.on('scrollbar:add', this._onVerticalScrollbarGain, this);

        if (this._verticalScrollbarEntity.scrollbar) {
            this._onVerticalScrollbarGain();
        }
    }

    _horizontalScrollbarEntityUnsubscribe() {
        this._evtHorizontalScrollbarAdd?.off();
        this._evtHorizontalScrollbarAdd = null;

        if (this._horizontalScrollbarEntity.scrollbar) {
            this._onHorizontalScrollbarLose();
        }
    }

    _verticalScrollbarEntityUnsubscribe() {
        this._evtVerticalScrollbarAdd?.off();
        this._evtVerticalScrollbarAdd = null;

        if (this._verticalScrollbarEntity.scrollbar) {
            this._onVerticalScrollbarLose();
        }
    }

    _onSetHorizontalScrollbarValue(scrollValueX) {
        if (!this._scrollbarUpdateFlags[ORIENTATION_HORIZONTAL] && this.enabled && this.entity.enabled) {
            this._onSetScroll(scrollValueX, null);
        }
    }

    _onSetVerticalScrollbarValue(scrollValueY) {
        if (!this._scrollbarUpdateFlags[ORIENTATION_VERTICAL] && this.enabled && this.entity.enabled) {
            this._onSetScroll(null, scrollValueY);
        }
    }

    _onHorizontalScrollbarGain() {
        const scrollbar = this._horizontalScrollbarEntity?.scrollbar;
        this._evtHorizontalScrollbarRemove = scrollbar.on('beforeremove', this._onHorizontalScrollbarLose, this);
        this._evtHorizontalScrollbarValue = scrollbar.on('set:value', this._onSetHorizontalScrollbarValue, this);

        this._syncScrollbarEnabledState(ORIENTATION_HORIZONTAL);
        this._syncScrollbarPosition(ORIENTATION_HORIZONTAL);
    }

    _onVerticalScrollbarGain() {
        const scrollbar = this._verticalScrollbarEntity?.scrollbar;
        this._evtVerticalScrollbarRemove = scrollbar.on('beforeremove', this._onVerticalScrollbarLose, this);
        this._evtVerticalScrollbarValue = scrollbar.on('set:value', this._onSetVerticalScrollbarValue, this);

        this._syncScrollbarEnabledState(ORIENTATION_VERTICAL);
        this._syncScrollbarPosition(ORIENTATION_VERTICAL);
    }

    _onHorizontalScrollbarLose() {
        this._evtHorizontalScrollbarRemove?.off();
        this._evtHorizontalScrollbarRemove = null;

        this._evtHorizontalScrollbarValue?.off();
        this._evtHorizontalScrollbarValue = null;
    }

    _onVerticalScrollbarLose() {
        this._evtVerticalScrollbarRemove?.off();
        this._evtVerticalScrollbarRemove = null;

        this._evtVerticalScrollbarValue?.off();
        this._evtVerticalScrollbarValue = null;
    }

    _onSetHorizontalScrollingEnabled() {
        this._syncScrollbarEnabledState(ORIENTATION_HORIZONTAL);
    }

    _onSetVerticalScrollingEnabled() {
        this._syncScrollbarEnabledState(ORIENTATION_VERTICAL);
    }

    _onSetScroll(x, y, resetVelocity) {
        if (resetVelocity !== false) {
            this._velocity.set(0, 0, 0);
        }

        const xChanged = this._updateAxis(x, 'x', ORIENTATION_HORIZONTAL);
        const yChanged = this._updateAxis(y, 'y', ORIENTATION_VERTICAL);

        if (xChanged || yChanged) {
            this.fire('set:scroll', this._scroll);
        }
    }

    _updateAxis(scrollValue, axis, orientation) {
        const hasChanged = scrollValue !== null && Math.abs(scrollValue - this._scroll[axis]) > 1e-5;

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
    }

    _determineNewScrollValue(scrollValue, axis, orientation) {
        // If scrolling is disabled for the selected orientation, force the
        // scroll position to remain at the current value
        if (!this._getScrollingEnabled(orientation)) {
            return this._scroll[axis];
        }

        switch (this.scrollMode) {
            case SCROLL_MODE_CLAMP:
                return math.clamp(scrollValue, 0, this._getMaxScrollValue(orientation));

            case SCROLL_MODE_BOUNCE:
                this._setVelocityFromOvershoot(scrollValue, axis, orientation);
                return scrollValue;

            case SCROLL_MODE_INFINITE:
                return scrollValue;

            default:
                console.warn(`Unhandled scroll mode:${this.scrollMode}`);
                return scrollValue;
        }
    }

    _syncAll() {
        this._syncContentPosition(ORIENTATION_HORIZONTAL);
        this._syncContentPosition(ORIENTATION_VERTICAL);
        this._syncScrollbarPosition(ORIENTATION_HORIZONTAL);
        this._syncScrollbarPosition(ORIENTATION_VERTICAL);
        this._syncScrollbarEnabledState(ORIENTATION_HORIZONTAL);
        this._syncScrollbarEnabledState(ORIENTATION_VERTICAL);
    }

    _syncContentPosition(orientation) {
        if (!this._contentEntity) {
            return;
        }

        const axis = this._getAxis(orientation);
        const sign = this._getSign(orientation);

        const prevContentSize = this._prevContentSizes[orientation];
        const currContentSize = this._getContentSize(orientation);

        // If the content size has changed, adjust the scroll value so that the content will
        // stay in the same place from the user's perspective.
        if (prevContentSize !== null && Math.abs(prevContentSize - currContentSize) > 1e-4) {
            const prevMaxOffset = this._getMaxOffset(orientation, prevContentSize);
            const currMaxOffset = this._getMaxOffset(orientation, currContentSize);
            if (currMaxOffset === 0) {
                this._scroll[axis] = 1;
            } else {
                this._scroll[axis] = math.clamp((this._scroll[axis] * prevMaxOffset) / currMaxOffset, 0, 1);
            }
        }

        const offset = this._scroll[axis] * this._getMaxOffset(orientation);
        const contentPosition = this._contentEntity.getLocalPosition();
        contentPosition[axis] = offset * sign;

        this._contentEntity.setLocalPosition(contentPosition);

        this._prevContentSizes[orientation] = currContentSize;
    }

    _syncScrollbarPosition(orientation) {
        const scrollbarEntity = this._scrollbarEntities[orientation];
        if (!scrollbarEntity?.scrollbar) {
            return;
        }

        const axis = this._getAxis(orientation);

        // Setting the value of the scrollbar will fire a 'set:value' event, which in turn
        // will call the _onSetHorizontalScrollbarValue/_onSetVerticalScrollbarValue handlers
        // and cause a cycle. To avoid this we keep track of the fact that we're in the process
        // of updating the scrollbar value.
        this._scrollbarUpdateFlags[orientation] = true;
        scrollbarEntity.scrollbar.value = this._scroll[axis];
        scrollbarEntity.scrollbar.handleSize = this._getScrollbarHandleSize(axis, orientation);
        this._scrollbarUpdateFlags[orientation] = false;
    }

    // Toggles the scrollbar entities themselves to be enabled/disabled based
    // on whether the user has enabled horizontal/vertical scrolling on the
    // scroll view.
    _syncScrollbarEnabledState(orientation) {
        const entity = this._scrollbarEntities[orientation];
        if (!entity) {
            return;
        }

        const isScrollingEnabled = this._getScrollingEnabled(orientation);
        const requestedVisibility = this._getScrollbarVisibility(orientation);

        switch (requestedVisibility) {
            case SCROLLBAR_VISIBILITY_SHOW_ALWAYS:
                entity.enabled = isScrollingEnabled;
                return;

            case SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED:
                entity.enabled = isScrollingEnabled && this._contentIsLargerThanViewport(orientation);
                return;

            default:
                console.warn(`Unhandled scrollbar visibility:${requestedVisibility}`);
                entity.enabled = isScrollingEnabled;
        }
    }

    _contentIsLargerThanViewport(orientation) {
        return this._getContentSize(orientation) > this._getViewportSize(orientation);
    }

    _contentPositionToScrollValue(contentPosition) {
        const maxOffsetH = this._getMaxOffset(ORIENTATION_HORIZONTAL);
        const maxOffsetV = this._getMaxOffset(ORIENTATION_VERTICAL);

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
    }

    _getMaxOffset(orientation, contentSize) {
        contentSize = contentSize === undefined ? this._getContentSize(orientation) : contentSize;

        const viewportSize = this._getViewportSize(orientation);

        if (contentSize < viewportSize) {
            return -this._getViewportSize(orientation);
        }

        return viewportSize - contentSize;
    }

    _getMaxScrollValue(orientation) {
        return this._contentIsLargerThanViewport(orientation) ? 1 : 0;
    }

    _getScrollbarHandleSize(axis, orientation) {
        const viewportSize = this._getViewportSize(orientation);
        const contentSize = this._getContentSize(orientation);

        if (Math.abs(contentSize) < 0.001) {
            return 1;
        }

        const handleSize = Math.min(viewportSize / contentSize, 1);
        const overshoot = this._toOvershoot(this._scroll[axis], orientation);

        if (overshoot === 0) {
            return handleSize;
        }

        // Scale the handle down when the content has been dragged past the bounds
        return handleSize / (1 + Math.abs(overshoot));
    }

    _getViewportSize(orientation) {
        return this._getSize(orientation, this._viewportEntity);
    }

    _getContentSize(orientation) {
        return this._getSize(orientation, this._contentEntity);
    }

    _getSize(orientation, entity) {
        if (entity?.element) {
            return entity.element[this._getCalculatedDimension(orientation)];
        }

        return 0;
    }

    _getScrollingEnabled(orientation) {
        if (orientation === ORIENTATION_HORIZONTAL) {
            return this.horizontal;
        } else if (orientation === ORIENTATION_VERTICAL) {
            return this.vertical;
        }

        Debug.warn(`Unrecognized orientation: ${orientation}`);
        return undefined;
    }

    _getScrollbarVisibility(orientation) {
        if (orientation === ORIENTATION_HORIZONTAL) {
            return this.horizontalScrollbarVisibility;
        } else if (orientation === ORIENTATION_VERTICAL) {
            return this.verticalScrollbarVisibility;
        }

        Debug.warn(`Unrecognized orientation: ${orientation}`);
        return undefined;
    }

    _getSign(orientation) {
        return orientation === ORIENTATION_HORIZONTAL ? 1 : -1;
    }

    _getAxis(orientation) {
        return orientation === ORIENTATION_HORIZONTAL ? 'x' : 'y';
    }

    _getCalculatedDimension(orientation) {
        return orientation === ORIENTATION_HORIZONTAL ? 'calculatedWidth' : 'calculatedHeight';
    }

    _destroyDragHelper() {
        if (this._contentDragHelper) {
            this._contentDragHelper.destroy();
        }
    }

    onUpdate() {
        if (this._contentEntity) {
            this._updateVelocity();
            this._syncScrollbarEnabledState(ORIENTATION_HORIZONTAL);
            this._syncScrollbarEnabledState(ORIENTATION_VERTICAL);
        }
    }

    _updateVelocity() {
        if (!this._isDragging()) {
            if (this.scrollMode === SCROLL_MODE_BOUNCE) {
                if (this._hasOvershoot('x', ORIENTATION_HORIZONTAL)) {
                    this._setVelocityFromOvershoot(this.scroll.x, 'x', ORIENTATION_HORIZONTAL);
                }

                if (this._hasOvershoot('y', ORIENTATION_VERTICAL)) {
                    this._setVelocityFromOvershoot(this.scroll.y, 'y', ORIENTATION_VERTICAL);
                }
            }

            if (Math.abs(this._velocity.x) > 1e-4 || Math.abs(this._velocity.y) > 1e-4) {
                const position = this._contentEntity.getLocalPosition();
                position.x += this._velocity.x;
                position.y += this._velocity.y;
                this._contentEntity.setLocalPosition(position);

                this._setScrollFromContentPosition(position);
            }

            this._velocity.x *= 1 - this.friction;
            this._velocity.y *= 1 - this.friction;
        }
    }

    _hasOvershoot(axis, orientation) {
        return Math.abs(this._toOvershoot(this.scroll[axis], orientation)) > 0.001;
    }

    _toOvershoot(scrollValue, orientation) {
        const maxScrollValue = this._getMaxScrollValue(orientation);

        if (scrollValue < 0) {
            return scrollValue;
        } else if (scrollValue > maxScrollValue) {
            return scrollValue - maxScrollValue;
        }

        return 0;
    }

    _setVelocityFromOvershoot(scrollValue, axis, orientation) {
        const overshootValue = this._toOvershoot(scrollValue, orientation);
        const overshootPixels = overshootValue * this._getMaxOffset(orientation) * this._getSign(orientation);

        if (Math.abs(overshootPixels) > 0) {
            // 50 here is just a magic number – it seems to give us a range of useful
            // range of bounceAmount values, so that 0.1 is similar to the iOS bounce
            // feel, 1.0 is much slower, etc. The + 1 means that when bounceAmount is
            // 0, the content will just snap back immediately instead of moving gradually.
            this._velocity[axis] = -overshootPixels / (this.bounceAmount * 50 + 1);
        }
    }

    _setVelocityFromContentPositionDelta(position) {
        if (this._prevContentDragPosition) {
            this._velocity.sub2(position, this._prevContentDragPosition);
            this._prevContentDragPosition.copy(position);
        } else {
            this._velocity.set(0, 0, 0);
            this._prevContentDragPosition = position.clone();
        }
    }

    _setScrollFromContentPosition(position) {
        let scrollValue = this._contentPositionToScrollValue(position);

        if (this._isDragging()) {
            scrollValue = this._applyScrollValueTension(scrollValue);
        }

        this._onSetScroll(scrollValue.x, scrollValue.y, false);
    }

    // Create nice tension effect when dragging past the extents of the viewport
    _applyScrollValueTension(scrollValue) {
        const factor = 1;

        let max = this._getMaxScrollValue(ORIENTATION_HORIZONTAL);
        let overshoot = this._toOvershoot(scrollValue.x, ORIENTATION_HORIZONTAL);
        if (overshoot > 0) {
            scrollValue.x = max + factor * Math.log10(1 + overshoot);
        } else if (overshoot < 0) {
            scrollValue.x = -factor * Math.log10(1 - overshoot);
        }

        max = this._getMaxScrollValue(ORIENTATION_VERTICAL);
        overshoot = this._toOvershoot(scrollValue.y, ORIENTATION_VERTICAL);

        if (overshoot > 0) {
            scrollValue.y = max + factor * Math.log10(1 + overshoot);
        } else if (overshoot < 0) {
            scrollValue.y = -factor * Math.log10(1 - overshoot);
        }

        return scrollValue;
    }

    _isDragging() {
        return this._contentDragHelper && this._contentDragHelper.isDragging;
    }

    _setScrollbarComponentsEnabled(enabled) {
        if (this._horizontalScrollbarEntity?.scrollbar) {
            this._horizontalScrollbarEntity.scrollbar.enabled = enabled;
        }

        if (this._verticalScrollbarEntity?.scrollbar) {
            this._verticalScrollbarEntity.scrollbar.enabled = enabled;
        }
    }

    _setContentDraggingEnabled(enabled) {
        if (this._contentDragHelper) {
            this._contentDragHelper.enabled = enabled;
        }
    }

    _onMouseWheel(event) {
        if (!this.useMouseWheel || !this._contentEntity?.element) {
            return;
        }

        const wheelEvent = event.event;

        // wheelEvent's delta variables are screen space, so they need to be normalized first
        const normalizedDeltaX = (wheelEvent.deltaX / this._contentEntity.element.calculatedWidth) * this.mouseWheelSensitivity.x;
        const normalizedDeltaY = (wheelEvent.deltaY / this._contentEntity.element.calculatedHeight) * this.mouseWheelSensitivity.y;

        // update scroll positions, clamping to [0, maxScrollValue] to always prevent over-shooting
        const scrollX = math.clamp(this._scroll.x + normalizedDeltaX, 0, this._getMaxScrollValue(ORIENTATION_HORIZONTAL));
        const scrollY = math.clamp(this._scroll.y + normalizedDeltaY, 0, this._getMaxScrollValue(ORIENTATION_VERTICAL));

        this.scroll = new Vec2(scrollX, scrollY);
    }

    // re-enable useInput flag on any descendant that was disabled
    _enableContentInput() {
        while (this._disabledContentInputEntities.length) {
            const e = this._disabledContentInputEntities.pop();
            if (e.element) {
                e.element.useInput = true;
            }
        }

        this._disabledContentInput = false;
    }

    // disable useInput flag on all descendants of this contentEntity
    _disableContentInput() {
        const _disableInput = (e) => {
            if (e.element && e.element.useInput) {
                this._disabledContentInputEntities.push(e);
                e.element.useInput = false;
            }

            const children = e.children;
            for (let i = 0, l = children.length; i < l; i++) {
                _disableInput(children[i]);
            }
        };

        if (this._contentEntity) {
            // disable input recursively for all children of the content entity
            const children = this._contentEntity.children;
            for (let i = 0, l = children.length; i < l; i++) {
                _disableInput(children[i]);
            }
        }

        this._disabledContentInput = true;
    }

    onEnable() {
        this._setScrollbarComponentsEnabled(true);
        this._setContentDraggingEnabled(true);

        this._syncAll();
    }

    onDisable() {
        this._setScrollbarComponentsEnabled(false);
        this._setContentDraggingEnabled(false);
    }

    onRemove() {
        this._toggleLifecycleListeners('off');
        this._toggleElementListeners('off');
        this._destroyDragHelper();
    }

    resolveDuplicatedEntityReferenceProperties(oldScrollView, duplicatedIdsMap) {
        if (oldScrollView.viewportEntity) {
            this.viewportEntity = duplicatedIdsMap[oldScrollView.viewportEntity.getGuid()];
        }
        if (oldScrollView.contentEntity) {
            this.contentEntity = duplicatedIdsMap[oldScrollView.contentEntity.getGuid()];
        }
        if (oldScrollView.horizontalScrollbarEntity) {
            this.horizontalScrollbarEntity = duplicatedIdsMap[oldScrollView.horizontalScrollbarEntity.getGuid()];
        }
        if (oldScrollView.verticalScrollbarEntity) {
            this.verticalScrollbarEntity = duplicatedIdsMap[oldScrollView.verticalScrollbarEntity.getGuid()];
        }
    }
}

export { ScrollViewComponent };
