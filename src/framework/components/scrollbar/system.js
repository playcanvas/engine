Object.assign(pc, function () {
    var _schema = [
        { name: 'enabled', type: 'boolean' },
        { name: 'orientation', type: 'number' },
        { name: 'value', type: 'number' },
        { name: 'handleSize', type: 'number' },
        { name: 'handleEntity', type: 'entity' }
    ];

    /**
     * @private
     * @name pc.ScrollbarComponentSystem
     * @description Create a new ScrollbarComponentSystem
     * @classdesc Manages creation of {@link pc.ScrollbarComponent}s.
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */
    var ScrollbarComponentSystem = function ScrollbarComponentSystem(app) {
        pc.ComponentSystem.call(this, app);

        this.id = 'scrollbar';
        this.app = app;

        this.ComponentType = pc.ScrollbarComponent;
        this.DataType = pc.ScrollbarComponentData;

        this.schema = _schema;

        this.on('beforeremove', this._onRemoveComponent, this);
    };
    ScrollbarComponentSystem.prototype = Object.create(pc.ComponentSystem.prototype);
    ScrollbarComponentSystem.prototype.constructor = ScrollbarComponentSystem;

    pc.Component._buildAccessors(pc.ScrollbarComponent.prototype, _schema);

    Object.assign(ScrollbarComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            pc.ComponentSystem.prototype.initializeComponentData.call(this, component, data, _schema);
        },

        _onRemoveComponent: function (entity, component) {
            component.onRemove();
        }
    });

    return {
        ScrollbarComponentSystem: ScrollbarComponentSystem
    };
}());
