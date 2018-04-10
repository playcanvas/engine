pc.extend(pc, function () {
    var DEFAULTS = {
        minWidth: 0,
        minHeight: 0,
        maxWidth: null,
        maxHeight: null,
        fitWidthProportion: 0,
        fitHeightProportion: 0,
    };

    /**
     * @component
     * @name pc.LayoutChildComponent
     * @description Create a new LayoutChildComponent
     * @class A LayoutChildComponent enables the Entity to control the sizing applied to it by its parent {@link pc.LayoutGroup}.
     * @param {pc.LayoutChildComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * TODO Add properties
     */
    var LayoutChildComponent = function LayoutChildComponent(system, entity) {
        this._minWidth = DEFAULTS.minWidth;
        this._minHeight = DEFAULTS.minHeight;
        this._maxWidth = DEFAULTS.maxWidth;
        this._maxHeight = DEFAULTS.maxHeight;
        this._fitWidthProportion = DEFAULTS.fitWidthProportion;
        this._fitHeightProportion = DEFAULTS.fitHeightProportion;
    };
    LayoutChildComponent = pc.inherits(LayoutChildComponent, pc.Component);

    // These are exposed for use by layout-calculator.js in the case where an
    // element does not have a LayoutChildComponent.
    LayoutChildComponent.DEFAULTS = DEFAULTS;

    pc.extend(LayoutChildComponent.prototype, {
        onRemove: function () {
            // TODO Implement
        }
    });

    function defineResizeProperty(name) {
        var _name = '_' + name;

        Object.defineProperty(LayoutChildComponent.prototype, name, {
            get: function () {
                return this[_name];
            },

            set: function (value) {
                if (this[_name] !== value) {
                    this[_name] = value;
                    this.fire('set:' + name, this[_name]);
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

    return {
        LayoutChildComponent: LayoutChildComponent
    };
}());
