Object.assign(pc, function () {
    /**
     * @constructor
     * @name pc.LightComponentSystem
     * @classdesc A Light Component is used to dynamically light the scene.
     * @description Create a new LightComponentSystem.
     * @param {pc.Application} app The application.
     * @extends pc.ComponentSystem
     */
    var lightTypes = {
        'directional': pc.LIGHTTYPE_DIRECTIONAL,
        'point': pc.LIGHTTYPE_POINT,
        'spot': pc.LIGHTTYPE_SPOT
    };

    var LightComponentSystem = function (app) {
        pc.ComponentSystem.call(this, app);

        this.id = 'light';
        this.description = "Enables the Entity to emit light.";

        this.ComponentType = pc.LightComponent;
        this.DataType = pc.LightComponentData;
    };
    LightComponentSystem.prototype = Object.create(pc.ComponentSystem.prototype);
    LightComponentSystem.prototype.constructor = LightComponentSystem;

    Object.assign(LightComponentSystem.prototype, {
        initializeComponentData: function (component, _data) {
            var properties = pc._lightProps;

            // duplicate because we're modifying the data
            var data = {};
            for (var i = 0, len = properties.length; i < len; i++) {
                var property = properties[i];
                data[property] = _data[property];
            }

            if (!data.type)
                data.type = component.data.type;

            component.data.type = data.type;

            if (data.layers && pc.type(data.layers) === 'array') {
                data.layers = data.layers.slice(0);
            }

            if (data.color && pc.type(data.color) === 'array')
                data.color = new pc.Color(data.color[0], data.color[1], data.color[2]);

            if (data.cookieOffset && data.cookieOffset instanceof Array)
                data.cookieOffset = new pc.Vec2(data.cookieOffset[0], data.cookieOffset[1]);

            if (data.cookieScale && data.cookieScale instanceof Array)
                data.cookieScale = new pc.Vec2(data.cookieScale[0], data.cookieScale[1]);

            if (data.enable) {
                console.warn("WARNING: enable: Property is deprecated. Set enabled property instead.");
                data.enabled = data.enable;
            }

            var light = new pc.Light();
            light.type = lightTypes[data.type];
            light._node = component.entity;
            light._scene = this.app.scene;
            component.data.light = light;

            pc.ComponentSystem.prototype.initializeComponentData.call(this, component, data, properties);
        },

        removeComponent: function (entity) {
            var data = entity.light.data;
            data.light.destroy();

            pc.ComponentSystem.prototype.removeComponent.call(this, entity);
        },

        cloneComponent: function (entity, clone) {
            var light = entity.light;

            var data = [];
            var name;
            var _props = pc._lightProps;
            for (var i = 0; i < _props.length; i++) {
                name = _props[i];
                if (name === "light") continue;
                if (light[name] && light[name].clone) {
                    data[name] = light[name].clone();
                } else {
                    data[name] = light[name];
                }
            }

            this.addComponent(clone, data);
        },

        changeType: function (component, oldValue, newValue) {
            if (oldValue !== newValue) {
                component.light.type = lightTypes[newValue];
            }
        }
    });


    return {
        LightComponentSystem: LightComponentSystem
    };
}());
