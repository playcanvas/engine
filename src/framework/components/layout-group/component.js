import { Debug } from '../../../core/debug.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec4 } from '../../../core/math/vec4.js';

import { ORIENTATION_HORIZONTAL } from '../../../scene/constants.js';

import { FITTING_NONE } from './constants.js';
import { Component } from '../component.js';
import { LayoutCalculator } from './layout-calculator.js';

function getElement(entity) {
    return entity.element;
}

function isEnabledAndHasEnabledElement(entity) {
    return entity.enabled && entity.element && entity.element.enabled;
}

/**
 * A LayoutGroupComponent enables the Entity to position and scale child {@link ElementComponent}s
 * according to configurable layout rules.
 *
 * @category User Interface
 */
class LayoutGroupComponent extends Component {
    /**
     * Create a new LayoutGroupComponent instance.
     *
     * @param {import('./system.js').LayoutGroupComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
     * attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        /** @private */
        this._orientation = ORIENTATION_HORIZONTAL;
        /** @private */
        this._reverseX = false;
        /** @private */
        this._reverseY = true;
        /** @private */
        this._alignment = new Vec2(0, 1);
        /** @private */
        this._padding = new Vec4();
        /** @private */
        this._spacing = new Vec2();
        /** @private */
        this._widthFitting = FITTING_NONE;
        /** @private */
        this._heightFitting = FITTING_NONE;
        /** @private */
        this._wrap = false;
        /** @private */
        this._layoutCalculator = new LayoutCalculator();

        // Listen for the group container being resized
        this._listenForReflowEvents(this.entity, 'on');

        // Listen to existing children being resized
        this.entity.children.forEach((child) => {
            this._listenForReflowEvents(child, 'on');
        });

        // Listen to newly added children being resized
        this.entity.on('childinsert', this._onChildInsert, this);
        this.entity.on('childremove', this._onChildRemove, this);

        // Listen for ElementComponents and LayoutChildComponents being added
        // to self or to children - covers cases where they are not already
        // present at the point when this component is constructed.
        Debug.assert(system.app.systems.element, `System 'element' doesn't exist`);
        system.app.systems.element.on('add', this._onElementOrLayoutComponentAdd, this);
        system.app.systems.element.on('beforeremove', this._onElementOrLayoutComponentRemove, this);

        Debug.assert(system.app.systems.layoutchild, `System 'layoutchild' doesn't exist`);
        system.app.systems.layoutchild.on('add', this._onElementOrLayoutComponentAdd, this);
        system.app.systems.layoutchild.on('beforeremove', this._onElementOrLayoutComponentRemove, this);
    }

    /**
     * Sets whether the layout should run horizontally or vertically. Can be:
     *
     * - {@link ORIENTATION_HORIZONTAL}
     * - {@link ORIENTATION_VERTICAL}
     *
     * Defaults to {@link ORIENTATION_HORIZONTAL}.
     *
     * @type {number}
     */
    set orientation(value) {
        if (value !== this._orientation) {
            this._orientation = value;
            this._scheduleReflow();
        }
    }

    /**
     * Gets whether the layout should run horizontally or vertically.
     *
     * @type {number}
     */
    get orientation() {
        return this._orientation;
    }

    /**
     * Sets whether to reverse the order of children along the x axis. Defaults to false.
     *
     * @type {boolean}
     */
    set reverseX(value) {
        if (value !== this._reverseX) {
            this._reverseX = value;
            this._scheduleReflow();
        }
    }

    /**
     * Gets whether to reverse the order of children along the x axis.
     *
     * @type {boolean}
     */
    get reverseX() {
        return this._reverseX;
    }

    /**
     * Sets whether to reverse the order of children along the y axis. Defaults to true.
     *
     * @type {boolean}
     */
    set reverseY(value) {
        if (value !== this._reverseY) {
            this._reverseY = value;
            this._scheduleReflow();
        }
    }

    /**
     * Gets whether to reverse the order of children along the y axis.
     *
     * @type {boolean}
     */
    get reverseY() {
        return this._reverseY;
    }

    /**
     * Sets the horizontal and vertical alignment of child elements. Values range from 0 to 1 where
     * `[0, 0]` is the bottom left and `[1, 1]` is the top right. Defaults to `[0, 1]`.
     *
     * @type {Vec2}
     */
    set alignment(value) {
        if (!value.equals(this._alignment)) {
            this._alignment.copy(value);
            this._scheduleReflow();
        }
    }

    /**
     * Gets the horizontal and vertical alignment of child elements.
     *
     * @type {Vec2}
     */
    get alignment() {
        return this._alignment;
    }

    /**
     * Sets the padding to be applied inside the container before positioning any children.
     * Specified as left, bottom, right and top values. Defaults to `[0, 0, 0, 0]` (no padding).
     *
     * @type {Vec4}
     */
    set padding(value) {
        if (!value.equals(this._padding)) {
            this._padding.copy(value);
            this._scheduleReflow();
        }
    }

    /**
     * Gets the padding to be applied inside the container before positioning any children.
     *
     * @type {Vec4}
     */
    get padding() {
        return this._padding;
    }

    /**
     * Sets the spacing to be applied between each child element. Defaults to `[0, 0]` (no spacing).
     *
     * @type {Vec2}
     */
    set spacing(value) {
        if (!value.equals(this._spacing)) {
            this._spacing.copy(value);
            this._scheduleReflow();
        }
    }

    /**
     * Gets the spacing to be applied between each child element.
     *
     * @type {Vec2}
     */
    get spacing() {
        return this._spacing;
    }

    /**
     * Sets the width fitting mode to be applied when positioning and scaling child elements. Can be:
     *
     * - {@link FITTING_NONE}: Child elements will be rendered at their natural size.
     * - {@link FITTING_STRETCH}: When the natural size of all child elements does not fill the width
     * of the container, children will be stretched to fit. The rules for how each child will be
     * stretched are outlined below:
     *   1. Sum the {@link LayoutChildComponent#fitWidthProportion} values of each child and normalize
     * so that all values sum to 1.
     *   2. Apply the natural width of each child.
     *   3. If there is space remaining in the container, distribute it to each child based on the
     * normalized {@link LayoutChildComponent#fitWidthProportion} values, but do not exceed the
     * {@link LayoutChildComponent#maxWidth} of each child.
     * - {@link FITTING_SHRINK}: When the natural size of all child elements overflows the width of the
     * container, children will be shrunk to fit. The rules for how each child will be stretched are
     * outlined below:
     *   1. Sum the {@link LayoutChildComponent#fitWidthProportion} values of each child and normalize
     * so that all values sum to 1.
     *   2. Apply the natural width of each child.
     *   3. If the new total width of all children exceeds the available space of the container, reduce
     * each child's width proportionally based on the normalized {@link
     * LayoutChildComponent#fitWidthProportion} values, but do not exceed the {@link
     * LayoutChildComponent#minWidth} of each child.
     * - {@link FITTING_BOTH}: Applies both STRETCH and SHRINK logic as necessary.
     *
     * Defaults to {@link FITTING_NONE}.
     *
     * @type {number}
     */
    set widthFitting(value) {
        if (value !== this._widthFitting) {
            this._widthFitting = value;
            this._scheduleReflow();
        }
    }

    /**
     * Gets the width fitting mode to be applied when positioning and scaling child elements.
     *
     * @type {number}
     */
    get widthFitting() {
        return this._widthFitting;
    }

    /**
     * Sets the height fitting mode to be applied when positioning and scaling child elements.
     * Identical to {@link LayoutGroupComponent#widthFitting} but for the Y axis. Defaults to
     * {@link FITTING_NONE}.
     *
     * @type {number}
     */
    set heightFitting(value) {
        if (value !== this._heightFitting) {
            this._heightFitting = value;
            this._scheduleReflow();
        }
    }

    /**
     * Gets the height fitting mode to be applied when positioning and scaling child elements.
     *
     * @type {number}
     */
    get heightFitting() {
        return this._heightFitting;
    }

    /**
     * Sets whether or not to wrap children onto a new row/column when the size of the container is
     * exceeded. Defaults to false, which means that children will be be rendered in a single row
     * (horizontal orientation) or column (vertical orientation). Note that setting wrap to true
     * makes it impossible for the {@link FITTING_BOTH} fitting mode to operate in any logical
     * manner. For this reason, when wrap is true, a {@link LayoutGroupComponent#widthFitting} or
     * {@link LayoutGroupComponent#heightFitting} mode of {@link FITTING_BOTH} will be coerced to
     * {@link FITTING_STRETCH}.
     *
     * @type {boolean}
     */
    set wrap(value) {
        if (value !== this._wrap) {
            this._wrap = value;
            this._scheduleReflow();
        }
    }

    /**
     * Gets whether or not to wrap children onto a new row/column when the size of the container is
     * exceeded.
     *
     * @type {boolean}
     */
    get wrap() {
        return this._wrap;
    }

    _isSelfOrChild(entity) {
        return (entity === this.entity) || (this.entity.children.indexOf(entity) !== -1);
    }

    _listenForReflowEvents(target, onOff) {
        if (target.element) {
            target.element[onOff]('enableelement', this._scheduleReflow, this);
            target.element[onOff]('disableelement', this._scheduleReflow, this);
            target.element[onOff]('resize', this._scheduleReflow, this);
            target.element[onOff]('set:pivot', this._scheduleReflow, this);
        }

        if (target.layoutchild) {
            target.layoutchild[onOff]('set_enabled', this._scheduleReflow, this);
            target.layoutchild[onOff]('resize', this._scheduleReflow, this);
        }
    }

    _onElementOrLayoutComponentAdd(entity) {
        if (this._isSelfOrChild(entity)) {
            this._listenForReflowEvents(entity, 'on');
            this._scheduleReflow();
        }
    }

    _onElementOrLayoutComponentRemove(entity) {
        if (this._isSelfOrChild(entity)) {
            this._listenForReflowEvents(entity, 'off');
            this._scheduleReflow();
        }
    }

    _onChildInsert(child) {
        this._listenForReflowEvents(child, 'on');
        this._scheduleReflow();
    }

    _onChildRemove(child) {
        this._listenForReflowEvents(child, 'off');
        this._scheduleReflow();
    }

    _scheduleReflow() {
        if (this.enabled && this.entity && this.entity.enabled && !this._isPerformingReflow) {
            this.system.scheduleReflow(this);
        }
    }

    reflow() {
        const container = getElement(this.entity);
        const elements = this.entity.children.filter(isEnabledAndHasEnabledElement).map(getElement);

        if (!container || elements.length === 0) {
            return;
        }

        const containerWidth = Math.max(container.calculatedWidth, 0);
        const containerHeight = Math.max(container.calculatedHeight, 0);

        const options = {
            orientation: this._orientation,
            reverseX: this._reverseX,
            reverseY: this._reverseY,
            alignment: this._alignment,
            padding: this._padding,
            spacing: this._spacing,
            widthFitting: this._widthFitting,
            heightFitting: this._heightFitting,
            wrap: this._wrap,
            containerSize: new Vec2(containerWidth, containerHeight)
        };

        // In order to prevent recursive reflow (i.e. whereby setting the size of
        // a child element triggers another reflow on the next frame, and so on)
        // we flag that a reflow is currently in progress.
        this._isPerformingReflow = true;
        const layoutInfo = this._layoutCalculator.calculateLayout(elements, options);
        this._isPerformingReflow = false;

        this.fire('reflow', layoutInfo);
    }

    onEnable() {
        this._scheduleReflow();
    }

    onRemove() {
        this.entity.off('childinsert', this._onChildInsert, this);
        this.entity.off('childremove', this._onChildRemove, this);

        this._listenForReflowEvents(this.entity, 'off');

        this.entity.children.forEach((child) => {
            this._listenForReflowEvents(child, 'off');
        });

        this.system.app.systems.element.off('add', this._onElementOrLayoutComponentAdd, this);
        this.system.app.systems.element.off('beforeremove', this._onElementOrLayoutComponentRemove, this);
        this.system.app.systems.layoutchild.off('add', this._onElementOrLayoutComponentAdd, this);
        this.system.app.systems.layoutchild.off('beforeremove', this._onElementOrLayoutComponentRemove, this);
    }
}

export { LayoutGroupComponent };
