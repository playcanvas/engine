Object.assign(pc, function () {
    var _schema = [
        'enabled',
        'speed',
        'activate'
    ];

    /**
     * @class
     * @name pc.AnimComponentSystem
     * @augments pc.ComponentSystem
     * @classdesc The AnimComponentSystem manages creating and deleting AnimComponents.
     * @description Create an AnimComponentSystem.
     * @param {pc.Application} app - The application managing this system.
     */
    var AnimComponentSystem = function AnimComponentSystem(app) {
        pc.ComponentSystem.call(this, app);

        this.id = 'anim';
        this.description = "State based animation system that can animate the models and component properties of this entity and its children";

        this.ComponentType = pc.AnimComponent;
        this.DataType = pc.AnimComponentData;

        this.schema = _schema;

        this.on('beforeremove', this.onBeforeRemove, this);
        this.on('update', this.onUpdate, this);

        pc.ComponentSystem.bind('update', this.onUpdate, this);
    };
    AnimComponentSystem.prototype = Object.create(pc.ComponentSystem.prototype);
    AnimComponentSystem.prototype.constructor = AnimComponentSystem;

    pc.Component._buildAccessors(pc.AnimComponent.prototype, _schema);

    Object.assign(AnimComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            properties = ['activate', 'enabled', 'speed'];
            pc.ComponentSystem.prototype.initializeComponentData.call(this, component, data, properties);
        },

        onBeforeRemove: function (entity, component) {
            component.onBeforeRemove();
        },

        onUpdate: function (dt) {
            var components = this.store;

            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var component = components[id];
                    var componentData = component.data;

                    if (componentData.enabled && component.entity.enabled) {
                        if (componentData.animController) {
                            componentData.animController.update(dt * componentData.speed);
                        }
                    }
                }
            }
        }
    });

    return {
        AnimComponentSystem: AnimComponentSystem
    };
}());
