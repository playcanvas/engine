Object.assign(pc, function () {
    /**
     * @component
     * @constructor
     * @name pc.LayoutGroupComponent
     * @description Create a new LayoutGroupComponent
     * @classdesc A LayoutGroupComponent enables the Entity to position and scale child {@link pc.ElementComponent}s according to configurable layout rules.
     * @param {pc.LayoutGroupComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * @property {pc.ORIENTATION} orientation Whether the layout should run horizontally or vertically.
     * @property {Boolean} reverseX Reverses the order of children along the x axis.
     * @property {Boolean} reverseY Reverses the order of children along the y axis.
     * @property {pc.Vec2} alignment Specifies the horizontal and vertical alignment of child elements. Values range from 0 to 1 where [0,0] is the bottom left and [1,1] is the top right.
     * @property {pc.Vec4} padding Padding to be applied inside the container before positioning any children. Specified as left, bottom, right and top values.
     * @property {pc.Vec2} spacing Spacing to be applied between each child element.
     * @property {pc.FITTING} widthFitting Fitting logic to be applied when positioning and scaling child elements. Can be one of the following:
     * <ul>
     *     <li>{@link pc.FITTING_NONE}: Child elements will be rendered at their natural size.</li>
     *     <li>
     *         {@link pc.FITTING_STRETCH}: When the natural size of all child elements does not fill the width of the container, children will be stretched to fit. The rules for how each child will be stretched are outlined below:
     *         <ol>
     *            <li>Sum the {@link pc.LayoutChildComponent#fitWidthProportion} values of each child and normalize so that all values sum to 1.</li>
     *            <li>Apply the natural width of each child.</li>
     *            <li>If there is space remaining in the container, distribute it to each child based on the normalized {@link pc.LayoutChildComponent#fitWidthProportion} values, but do not exceed the {@link pc.LayoutChildComponent#maxWidth} of each child.</li>
     *         </ol>
     *     </li>
     *     <li>
     *         {@link pc.FITTING_SHRINK}: When the natural size of all child elements overflows the width of the container, children will be shrunk to fit. The rules for how each child will be stretched are outlined below:
     *         <ol>
     *            <li>Sum the {@link pc.LayoutChildComponent#fitWidthProportion} values of each child and normalize so that all values sum to 1.</li>
     *            <li>Apply the natural width of each child.</li>
     *            <li>If the new total width of all children exceeds the available space of the container, reduce each child's width proportionally based on the normalized {@link pc.LayoutChildComponent#fitWidthProportion} values, but do not exceed the {@link pc.LayoutChildComponent#minWidth} of each child.</li>
     *         </ol>
     *     </li>
     *     <li>{@link pc.FITTING_BOTH}: Applies both STRETCH and SHRINK logic as necessary.</li>
     * </ul>
     * <ul>
     * @property {pc.FITTING} heightFitting Identical to {@link pc.LayoutGroupComponent#widthFitting} but for the Y axis.
     * @property {Boolean} wrap Whether or not to wrap children onto a new row/column when the size of the container is exceeded. Defaults to false, which means that children will be be rendered in a single row (horizontal orientation) or column (vertical orientation).<br><br><em>Note that setting wrap to true makes it impossible for the {@link pc.FITTING_BOTH} fitting mode to operate in any logical manner. For this reason, when wrap is true, a {@link pc.LayoutGroupComponent#widthFitting} or {@link pc.LayoutGroupComponent#heightFitting} mode of {@link pc.FITTING_BOTH} will be coerced to {@link pc.FITTING_STRETCH}.<em>
     */
    var LayoutGroupComponent = function LayoutGroupComponent(system, entity) {
        pc.Component.call(this, system, entity);

        this._orientation = pc.ORIENTATION_HORIZONTAL;
        this._reverseX = false;
        this._reverseY = true;
        this._alignment = new pc.Vec2(0, 1);
        this._padding = new pc.Vec4();
        this._spacing = new pc.Vec2();
        this._widthFitting = pc.FITTING_NONE;
        this._heightFitting = pc.FITTING_NONE;
        this._wrap = false;
        this._layoutCalculator = new pc.LayoutCalculator();

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
    };
    LayoutGroupComponent.prototype = Object.create(pc.Component.prototype);
    LayoutGroupComponent.prototype.constructor = LayoutGroupComponent;

    Object.assign(LayoutGroupComponent.prototype, {
        _isSelfOrChild: function (entity) {
            return (entity === this.entity) || (this.entity.children.indexOf(entity) !== -1);
        },

        _listenForReflowEvents: function (target, onOff) {
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
        },

        _onElementOrLayoutComponentAdd: function (entity) {
            if (this._isSelfOrChild(entity)) {
                this._listenForReflowEvents(entity, 'on');
                this._scheduleReflow();
            }
        },

        _onElementOrLayoutComponentRemove: function (entity) {
            if (this._isSelfOrChild(entity)) {
                this._listenForReflowEvents(entity, 'off');
                this._scheduleReflow();
            }
        },

        _onChildInsert: function (child) {
            this._listenForReflowEvents(child, 'on');
            this._scheduleReflow();
        },

        _onChildRemove: function (child) {
            this._listenForReflowEvents(child, 'off');
            this._scheduleReflow();
        },

        _scheduleReflow: function () {
            if (this.enabled && this.entity && this.entity.enabled && !this._isPerformingReflow) {
                this.system.scheduleReflow(this);
            }
        },

        reflow: function () {
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
                containerSize: new pc.Vec2(containerWidth, containerHeight)
            };

            // In order to prevent recursive reflow (i.e. whereby setting the size of
            // a child element triggers another reflow on the next frame, and so on)
            // we flag that a reflow is currently in progress.
            this._isPerformingReflow = true;
            var layoutInfo = this._layoutCalculator.calculateLayout(elements, options);
            this._isPerformingReflow = false;

            this.fire('reflow', layoutInfo);
        },

        onEnable: function () {
            this._scheduleReflow();
        },

        onRemove: function () {
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
    });

    function getElement(entity) {
        return entity.element;
    }

    function isEnabledAndHasEnabledElement(entity) {
        return entity.enabled && entity.element && entity.element.enabled;
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

    return {
        LayoutGroupComponent: LayoutGroupComponent
    };
}());
