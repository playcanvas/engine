pc.extend(pc, function () {
    /**
     * @name pc.ZoneComponentSystem
     * @description Create a new ZoneComponentSystem
     * @class Defines zone in world.
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */

    var ZoneComponentSystem = function ZoneComponentSystem(app) {
        this.id = 'zone';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.ZoneComponent;
        this.DataType = pc.ZoneComponentData;

        this.schema = [ 'enabled' ];

        this.on('beforeremove', this._onBeforeRemove, this);
    };
    ZoneComponentSystem = pc.inherits(ZoneComponentSystem, pc.ComponentSystem);

    pc.extend(ZoneComponentSystem.prototype, {
        initializeComponentData: function(component, data, properties) {
            component.enabled = data.hasOwnProperty('enabled') ? !!data.enabled : true;

            if (data.size) {
                if (data.size instanceof pc.Vec3) {
                    component.size.copy(data.size);
                } else if (data.size instanceof Array && data.size.length >= 3) {
                    component.size.set(data.size[0], data.size[1], data.size[2]);
                }
            }
        },

        cloneComponent: function(entity, clone) {
            var data = {
                size: entity.zone.size
            };

            return this.addComponent(clone, data);
        },

        _onBeforeRemove: function(entity, component) {
            component._onBeforeRemove();
        }
    });

    return {
        ZoneComponentSystem: ZoneComponentSystem
    };
}());
