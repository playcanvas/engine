import { Vec2 } from '../../../math/vec2.js';
import { Vec4 } from '../../../math/vec4.js';

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
 * @component
 * @class
 * @name LayoutGroupComponent
 * @augments Component
 * @description Create a new LayoutGroupComponent.
 * @classdesc A LayoutGroupComponent enables the Entity to position and scale child
 * {@link ElementComponent}s according to configurable layout rules.
 * @param {pc.LayoutGroupComponentSystem} system - The ComponentSystem that created
 * this Component.
 * @param {pc.Entity} entity - The Entity that this Component is attached to.
 * @property {number} orientation Whether the layout should run horizontally or
 * vertically. Can be:
 *
 * * {@link ORIENTATION_HORIZONTAL}
 * * {@link ORIENTATION_VERTICAL}
 *
 * Defaults to pc.ORIENTATION_HORIZONTAL.
 * @property {boolean} reverseX Reverses the order of children along the x axis.
 * Defaults to false.
 * @property {boolean} reverseY Reverses the order of children along the y axis.
 * Defaults to true.
 * @property {pc.Vec2} alignment Specifies the horizontal and vertical alignment of
 * child elements. Values range from 0 to 1 where [0, 0] is the bottom left and
 * [1, 1] is the top right. Defaults to [0, 1].
 * @property {pc.Vec4} padding Padding to be applied inside the container before
 * positioning any children. Specified as left, bottom, right and top values.
 * Defaults to [0, 0, 0, 0] (no padding).
 * @property {pc.Vec2} spacing Spacing to be applied between each child element.
 * Defaults to [0, 0] (no spacing).
 * @property {number} widthFitting Fitting logic to be applied when positioning and
 * scaling child elements. Can be:
 *
 * * {@link FITTING_NONE}: Child elements will be rendered at their natural size.
 * * {@link FITTING_STRETCH}: When the natural size of all child elements does not
 * fill the width of the container, children will be stretched to fit. The rules for how
 * each child will be stretched are outlined below:
 *   1. Sum the {@link LayoutChildComponent#fitWidthProportion} values of each child
 * and normalize so that all values sum to 1.
 *   2. Apply the natural width of each child.
 *   3. If there is space remaining in the container, distribute it to each child based
 * on the normalized {@link LayoutChildComponent#fitWidthProportion} values, but do
 * not exceed the {@link LayoutChildComponent#maxWidth} of each child.
 * * {@link FITTING_SHRINK}: When the natural size of all child elements overflows the
 * width of the container, children will be shrunk to fit. The rules for how each child
 * will be stretched are outlined below:
 *   1. Sum the {@link LayoutChildComponent#fitWidthProportion} values of each child
 * and normalize so that all values sum to 1.
 *   2. Apply the natural width of each child.
 *   3. If the new total width of all children exceeds the available space of the
 * container, reduce each child's width proportionally based on the normalized {@link
 * pc.LayoutChildComponent#fitWidthProportion} values, but do not exceed the {@link
 * pc.LayoutChildComponent#minWidth} of each child.
 * * {@link FITTING_BOTH}: Applies both STRETCH and SHRINK logic as necessary.
 *
 * Defaults to pc.FITTING_NONE.
 * @property {number} heightFitting Identical to {@link LayoutGroupComponent#widthFitting}
 * but for the Y axis. Defaults to pc.FITTING_NONE.
 * @property {boolean} wrap Whether or not to wrap children onto a new row/column when the
 * size of the container is exceeded. Defaults to false, which means that children will be
 * be rendered in a single row (horizontal orientation) or column (vertical orientation).
 * Note that setting wrap to true makes it impossible for the {@link FITTING_BOTH}
 * fitting mode to operate in any logical manner. For this reason, when wrap is true, a
 * {@link LayoutGroupComponent#widthFitting} or {@link LayoutGroupComponent#heightFitting}
 * mode of {@link FITTING_BOTH} will be coerced to {@link FITTING_STRETCH}.
 */
class LayoutGroupComponent extends Component {
    constructor(system, entity) {
        super(system, entity);

        this._orientation = ORIENTATION_HORIZONTAL;
        this._reverseX = false;
        this._reverseY = true;
        this._alignment = new Vec2(0, 1);
        this._padding = new Vec4();
        this._spacing = new Vec2();
        this._widthFitting = FITTING_NONE;
        this._heightFitting = FITTING_NONE;
        this._wrap = false;
        this._layoutCalculator = new LayoutCalculator();

        // Listen for the group container being resized
        this._listenForReflowEvents(this.entity, 'on');

        // Listen to existing children being resized
        this.entity.children.forEach(function (child) {
            this._listenForReflowEvents(child, 'on');
        }.bind(this));

        // Listen to newly added children being resized
        this.entity.on('childinsert', this._onChildInsert, this);
        this.entity.on('childremove', this._onChildRemove, this);

        // Listen for ElementComponents and LayoutChildComponents being added
        // to self or to children - covers cases where they are not already
        // present at the point when this component is constructed.
        system.app.systems.element.on('add', this._onElementOrLayoutComponentAdd, this);
        system.app.systems.element.on('beforeremove', this._onElementOrLayoutComponentRemove, this);
        system.app.systems.layoutchild.on('add', this._onElementOrLayoutComponentAdd, this);
        system.app.systems.layoutchild.on('beforeremove', this._onElementOrLayoutComponentRemove, this);
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
        var container = getElement(this.entity);
        var elements = this.entity.children.filter(isEnabledAndHasEnabledElement).map(getElement);

        if (!container || elements.length === 0) {
            return;
        }

        var containerWidth = Math.max(container.calculatedWidth, 0);
        var containerHeight = Math.max(container.calculatedHeight, 0);

        var options = {
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
        var layoutInfo = this._layoutCalculator.calculateLayout(elements, options);
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

        this.entity.children.forEach(function (child) {
            this._listenForReflowEvents(child, 'off');
        }.bind(this));

        this.system.app.systems.element.off('add', this._onElementOrLayoutComponentAdd, this);
        this.system.app.systems.element.off('beforeremove', this._onElementOrLayoutComponentRemove, this);
        this.system.app.systems.layoutchild.off('add', this._onElementOrLayoutComponentAdd, this);
        this.system.app.systems.layoutchild.off('beforeremove', this._onElementOrLayoutComponentRemove, this);
    }
}

function defineReflowSchedulingProperty(name) {
    var _name = '_' + name;

    Object.defineProperty(LayoutGroupComponent.prototype, name, {
        get: function () {
            return this[_name];
        },

        set: function (value) {
            if (this[_name] !== value) {
                this[_name] = value;
                this._scheduleReflow();
            }
        }
    });
}

defineReflowSchedulingProperty('orientation');
defineReflowSchedulingProperty('reverseX');
defineReflowSchedulingProperty('reverseY');
defineReflowSchedulingProperty('alignment');
defineReflowSchedulingProperty('padding');
defineReflowSchedulingProperty('spacing');
defineReflowSchedulingProperty('widthFitting');
defineReflowSchedulingProperty('heightFitting');
defineReflowSchedulingProperty('wrap');

export { LayoutGroupComponent };
