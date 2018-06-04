pc.extend(pc, function () {
    var _schema = [
        { name: 'enabled', type: 'boolean' },
        { name: 'horizontal', type: 'boolean' },
        { name: 'vertical', type: 'boolean' },
        { name: 'scrollMode', type: 'number' },
        { name: 'bounceAmount', type: 'number' },
        { name: 'friction', type: 'number' },
        { name: 'horizontalScrollbarVisibility', type: 'number' },
        { name: 'verticalScrollbarVisibility', type: 'number' },
        { name: 'viewportEntity', type: 'entity' },
        { name: 'contentEntity', type: 'entity' },
        { name: 'horizontalScrollbarEntity', type: 'entity' },
        { name: 'verticalScrollbarEntity', type: 'entity' }
    ];

    /**
     * @private
     * @name pc.ScrollViewComponentSystem
     * @description Create a new ScrollViewComponentSystem
     * @classdesc Manages creation of {@link pc.ScrollViewComponent}s.
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */
    var ScrollViewComponentSystem = function ScrollViewComponentSystem(app) {
        this.id = 'scrollview';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.ScrollViewComponent;
        this.DataType = pc.ScrollViewComponentData;

        this.schema = _schema;

        this.on('beforeremove', this._onRemoveComponent, this);
    };
    ScrollViewComponentSystem = pc.inherits(ScrollViewComponentSystem, pc.ComponentSystem);

    pc.Component._buildAccessors(pc.ScrollViewComponent.prototype, _schema);

    pc.extend(ScrollViewComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            ScrollViewComponentSystem._super.initializeComponentData.call(this, component, data, _schema);
        },

        _onRemoveComponent: function (entity, component) {
            component.onRemove();
        }
    });

    return {
        ScrollViewComponentSystem: ScrollViewComponentSystem
    };
}());
