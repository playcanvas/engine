Object.assign(pc, function () {
    var _schema = ['enabled'];

    /**
     * @private
     * @constructor
     * @name pc.ZoneComponentSystem
     * @classdesc Defines zone in world.
     * @description Create a new ZoneComponentSystem.
     * @param {pc.Application} app The application.
     * @extends pc.ComponentSystem
     */
    var ZoneComponentSystem = function ZoneComponentSystem(app) {
        pc.ComponentSystem.call(this, app);

        this.id = 'zone';
        this.app = app;

        this.ComponentType = pc.ZoneComponent;
        this.DataType = pc.ZoneComponentData;

        this.schema = _schema;

        this.on('beforeremove', this._onBeforeRemove, this);
    };
    ZoneComponentSystem.prototype = Object.create(pc.ComponentSystem.prototype);
    ZoneComponentSystem.prototype.constructor = ZoneComponentSystem;

    pc.Component._buildAccessors(pc.ZoneComponent.prototype, _schema);

    Object.assign(ZoneComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            component.enabled = data.hasOwnProperty('enabled') ? !!data.enabled : true;

            if (data.size) {
                if (data.size instanceof pc.Vec3) {
                    component.size.copy(data.size);
                } else if (data.size instanceof Array && data.size.length >= 3) {
                    component.size.set(data.size[0], data.size[1], data.size[2]);
                }
            }
        },

        cloneComponent: function (entity, clone) {
            var data = {
                size: entity.zone.size
            };

            return this.addComponent(clone, data);
        },

        _onBeforeRemove: function (entity, component) {
            component._onBeforeRemove();
        }
    });

    return {
        ZoneComponentSystem: ZoneComponentSystem
    };
}());
