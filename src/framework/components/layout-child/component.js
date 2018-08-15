Object.assign(pc, function () {
    /**
     * @component
     * @constructor
     * @name pc.LayoutChildComponent
     * @description Create a new LayoutChildComponent
     * @classdesc A LayoutChildComponent enables the Entity to control the sizing applied to it by its parent {@link pc.LayoutGroupComponent}.
     * @param {pc.LayoutChildComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * @property {Number} minWidth The minimum width the element should be rendered at.
     * @property {Number} minHeight The minimum height the element should be rendered at.
     * @property {Number} maxWidth The maximum width the element should be rendered at.
     * @property {Number} maxHeight The maximum height the element should be rendered at.
     * @property {Number} fitWidthProportion The amount of additional horizontal space that the element should take up, if necessary to satisfy a Stretch/Shrink fitting calculation. This is specified as a proportion, taking into account the proportion values of other siblings.
     * @property {Number} fitHeightProportion The amount of additional vertical space that the element should take up, if necessary to satisfy a Stretch/Shrink fitting calculation. This is specified as a proportion, taking into account the proportion values of other siblings.
     * @property {Number} excludeFromLayout If set to true, the child will be excluded from all layout calculations.
     */
    var LayoutChildComponent = function LayoutChildComponent(system, entity) {
        pc.Component.call(this, system, entity);

        this._minWidth = 0;
        this._minHeight = 0;
        this._maxWidth = null;
        this._maxHeight = null;
        this._fitWidthProportion = 0;
        this._fitHeightProportion = 0;
        this._excludeFromLayout = false;
    };
    LayoutChildComponent.prototype = Object.create(pc.Component.prototype);
    LayoutChildComponent.prototype.constructor = LayoutChildComponent;

    function defineResizeProperty(name) {
        var _name = '_' + name;

        Object.defineProperty(LayoutChildComponent.prototype, name, {
            get: function () {
                return this[_name];
            },

            set: function (value) {
                if (this[_name] !== value) {
                    this[_name] = value;
                    this.fire('resize');
                }
            }
        });
    }

    defineResizeProperty('minWidth');
    defineResizeProperty('minHeight');
    defineResizeProperty('maxWidth');
    defineResizeProperty('maxHeight');
    defineResizeProperty('fitWidthProportion');
    defineResizeProperty('fitHeightProportion');
    defineResizeProperty('excludeFromLayout');

    return {
        LayoutChildComponent: LayoutChildComponent
    };
}());
