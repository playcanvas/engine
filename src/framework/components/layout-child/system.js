pc.extend(pc, function () {
    var _schema = [ 'enabled' ];

    /**
     * @name pc.LayoutChildComponentSystem
     * @description Create a new LayoutChildComponentSystem
     * @class Manages creation of {@link pc.LayoutChildComponent}s.
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */
    var LayoutChildComponentSystem = function LayoutChildComponentSystem(app) {
        this.id = 'layoutchild';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.LayoutChildComponent;
        this.DataType = pc.LayoutChildComponentData;

        this.schema = _schema;

        this.on('beforeremove', this.onRemoveComponent, this);
    };
    LayoutChildComponentSystem = pc.inherits(LayoutChildComponentSystem, pc.ComponentSystem);

    pc.Component._buildAccessors(pc.LayoutChildComponent.prototype, _schema);

    pc.extend(LayoutChildComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            // TODO Add properties
            LayoutChildComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        cloneComponent: function (entity, clone) {
            var layoutChild = entity.layoutChild;

            return this.addComponent(clone, {
                enabled: layoutChild.enabled,
                // TODO Add properties
            });
        },

        onRemoveComponent: function (entity, component) {
            component.onRemove();
        }
    });

    return {
        LayoutChildComponentSystem: LayoutChildComponentSystem
    };
}());
