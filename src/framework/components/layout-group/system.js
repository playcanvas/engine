pc.extend(pc, function () {
    var _schema = [ 'enabled' ];

    /**
     * @name pc.LayoutGroupComponentSystem
     * @description Create a new LayoutGroupComponentSystem
     * @class Manages creation of {@link pc.LayoutGroupComponent}s.
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */
    var LayoutGroupComponentSystem = function LayoutGroupComponentSystem(app) {
        this.id = 'layoutgroup';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.LayoutGroupComponent;
        this.DataType = pc.LayoutGroupComponentData;

        this.schema = _schema;

        this.on('beforeremove', this.onRemoveComponent, this);
    };
    LayoutGroupComponentSystem = pc.inherits(LayoutGroupComponentSystem, pc.ComponentSystem);

    pc.Component._buildAccessors(pc.LayoutGroupComponent.prototype, _schema);

    pc.extend(LayoutGroupComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            // TODO Add properties
            LayoutGroupComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        cloneComponent: function (entity, clone) {
            var layoutGroup = entity.layoutGroup;

            return this.addComponent(clone, {
                enabled: layoutGroup.enabled,
                // TODO Add properties
            });
        },

        onRemoveComponent: function (entity, component) {
            component.onRemove();
        }
    });

    return {
        LayoutGroupComponentSystem: LayoutGroupComponentSystem
    };
}());
