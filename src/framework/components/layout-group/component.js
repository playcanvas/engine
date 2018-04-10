pc.extend(pc, function () {
    /**
     * @component
     * @name pc.LayoutGroupComponent
     * @description Create a new LayoutGroupComponent
     * @class A LayoutGroupComponent enables the Entity to position and scale child {@link pc.ElementComponent}s according to configurable layout rules.
     * @param {pc.LayoutGroupComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * @property {pc.ORIENTATION} orientation Whether the layout should run horizontally or vertically.
     * @property {Boolean} reverse If set to false, horizontal layouts will run left-right and vertical layouts will run bottom-top. If set to true, the order will be reversed. Defaults to false.
     * @property {pc.Vec2} alignment Specifies the horizontal and vertical alignment of child elements. Values range from 0 to 1 where [0,0] is the bottom left and [1,1] is the top right.
     * @property {pc.Vec4} padding Padding to be applied inside the container before positioning any children. Specified as left, bottom, right and top values.
     * @property {pc.Vec2} spacing Spacing to be applied between each child element.
     * @property {pc.FITTING} widthFitting Fitting logic to be applied when positioning and scaling child elements. Can be one of the following:
     * <ul>
     *     <li>{@link pc.FITTING_NONE}: Child elements will be rendered at their natural size.</li>
     *     <li>
     *         {@link pc.FITTING_STRETCH}: When the natural size of all child elements is not sufficient to fill the width of the container, children will be stretched to fit. The rules for how each child will be stretched are outlined below:
     *         <ol>
     *            <li>Sum the {@link pc.LayoutChildComponent#fitWidthProportion} values of each child and normalize so that all values sum to 1.</li>
     *            <li>Apply the {@link pc.LayoutChildComponent#minWidth} for each child.</li>
     *            <li>If there is space remaining in the container, apply the natural {@link pc.LayoutChildComponent#width} of each child.</li>
     *            <li>If the new total width exceeds the available space of the container, reduce each child's width proportionally based on the normalized {@link pc.LayoutChildComponent#fitWidthProportion} values.</li>
     *            <li>If there is space remaining in the container, distribute it to each child based on the normalized {@link pc.LayoutChildComponent#fitWidthProportion} values, but do not exceed the {@link pc.LayoutChildComponent#maxWidth} of each child.</li>
     *         </ol>
     *     </li>
     *     <li>
     *         {@link pc.FITTING_SHRINK}: When the natural size of all child elements overflows the width of the container, children will be shrunk to fit. The rules for how each child will be stretched are outlined below.
     *         <ol>
     *            <li>Sum the {@link pc.LayoutChildComponent#fitWidthProportion} values of each child and normalize so that all values sum to 1.</li>
     *            <li>Reduce each child's {@link pc.LayoutChildComponent#width} proportionally based on the normalized {@link pc.LayoutChildComponent#fitWidthProportion} values, but do not exceed the {@link pc.LayoutChildComponent#minWidth} of each child.</li>
     *         </ol>
     *     </li>
     *     <li>{@link pc.FITTING_BOTH}: Applies both STRETCH and SHRINK logic as necessary.</li>
     * </ul>
     * <ul>
     * @property {pc.FITTING} heightFitting Identical to {@link pc.LayoutGroupComponent#widthFitting} but for the Y axis.
     * @property {Boolean} wrap Whether or not to wrap children onto a new row/column when the size of the container is exceeded. Defaults to false, which means that children will be be rendered in a single row (horizontal orientation) or column (vertical orientation).<br><br><em>Note that setting wrap to true makes it impossible for the {@link pc.FITTING_BOTH} fitting mode to operate in any logical manner. For this reason, when wrap is true, a {@link pc.LayoutGroupComponent#widthFitting} or {@link pc.LayoutGroupComponent#heightFitting} mode of {@link pc.FITTING_BOTH} will be coerced to {@link pc.FITTING_STRETCH}.<em>
     */
    var LayoutGroupComponent = function LayoutGroupComponent(system, entity) {
        this._orientation = pc.ORIENTATION_HORIZONTAL;
        this._reverse = false;
        this._alignment = new pc.Vec2();
        this._padding = new pc.Vec4();
        this._widthFitting = pc.FITTING_NONE;
        this._heightFitting = pc.FITTING_NONE;
        this._wrap = false;
        this._layoutCalculator = new pc.LayoutCalculator();

        // Listen for the group container being resized
        this._listenForResizeEvents(this, 'on');

        // Listen to existing children being resized
        this.children.forEach(function(child) {
            this._listenForResizeEvents(child, 'on');
        }.bind(this));

        // Listen to newly added children being resized
        this.entity.on('childinsert', this._onChildInsert, this);
        this.entity.on('childremove', this._onChildRemove, this);

        this._scheduleReflow();
    };
    LayoutGroupComponent = pc.inherits(LayoutGroupComponent, pc.Component);

    pc.extend(LayoutGroupComponent.prototype, {
        _listenForResizeEvents: function(target, onOff) {
            getElement(this.entity)[onOff]('resize', this._onResize, this);

            // TODO Need to also handle the case where a LayoutChildComponent is added/removed from a child/the container
            if (this.entity.layoutchild) {
                this.entity.layoutchild[onOff]('resize', this._onResize, this);
            }
        },

        _onResize: function() {
            this._scheduleReflow();
        },

        _onChildInsert: function(child) {
            this._listenForResizeEvents(child, 'on');
            this._scheduleReflow();
        },

        _onChildRemove: function(child) {
            this._listenForResizeEvents(child, 'off');
            this._scheduleReflow();
        },

        _scheduleReflow: function() {
            this.fire('schedulereflow', this);

            // TODO Also schedule the reflow of a LayoutGroupComponent on the child?
        },

        reflow: function() {
            var elements = this.children.map(getElement);

            var options = {
                orientation: this._orientation,
                reverse: this._reverse,
                alignment: this._alignment,
                padding: this._padding,
                spacing: this._spacing,
                widthFitting: this._widthFitting,
                heightFitting: this._heightFitting,
                wrap: this._wrap,
                containerSize: new pc.Vec2(getElement(this.entity).width, getElement(this.entity).height)
            };

            this._layoutCalculator.calculateLayout(elements, options);
        },

        onRemove: function () {
            this.entity.off('insert', this._onResize, this);

            this.children.forEach(function(child) {
                this._listenForResizeEvents(child, 'off');
            }.bind(this));
        }
    });

    function getElement(entity) {
        var element = entity.element;
        if (!element) {
            throw new Error('Layout Groups can only be used with Elements');
        }
        return element;
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
    defineReflowSchedulingProperty('reverse');
    defineReflowSchedulingProperty('alignment');
    defineReflowSchedulingProperty('padding');
    defineReflowSchedulingProperty('widthFitting');
    defineReflowSchedulingProperty('heightFitting');
    defineReflowSchedulingProperty('wrap');

    return {
        LayoutGroupComponent: LayoutGroupComponent
    };
}());
