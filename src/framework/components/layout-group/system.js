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

        this._reflowQueue = [];

        this.on('beforeremove', this._onRemoveComponent, this);
        pc.ComponentSystem.on('postUpdate', this._onPostUpdate, this);
    };
    LayoutGroupComponentSystem = pc.inherits(LayoutGroupComponentSystem, pc.ComponentSystem);

    pc.Component._buildAccessors(pc.LayoutGroupComponent.prototype, _schema);

    pc.extend(LayoutGroupComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            // TODO Add properties
            LayoutGroupComponentSystem._super.initializeComponentData.call(this, component, data, properties);

            component.on('schedulereflow', this._onScheduleReflow, this);
        },

        cloneComponent: function (entity, clone) {
            var layoutGroup = entity.layoutGroup;

            return this.addComponent(clone, {
                enabled: layoutGroup.enabled,
                // TODO Add properties
            });
        },

        _onScheduleReflow: function (entity, component) {
            if (this._reflowQueue.indexOf(component) === -1) {
                this._reflowQueue.push(component);
            }
        },

        _onPostUpdate: function () {
            // TODO Sort in ascending order of depth within the graph
            this._reflowQueue.forEach(function(component) {
                component.reflow();
            });

            this._reflowQueue = [];
        },

        _onRemoveComponent: function (entity, component) {
            component.off('schedulereflow', this._onScheduleReflow, this);
            component.onRemove();
        }
    });

    return {
        LayoutGroupComponentSystem: LayoutGroupComponentSystem
    };
}());
