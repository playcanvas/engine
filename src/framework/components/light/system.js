pc.extend(pc, function () {
/*
* @name pc.LightComponentSystem
* @description Create a new LightComponentSystem.
* @class A Light Component is used to dynamically light the scene.
* @param {pc.Application} app The application.
* @extends pc.ComponentSystem
*/
    var lightTypes = {
        'directional': pc.LIGHTTYPE_DIRECTIONAL,
        'point': pc.LIGHTTYPE_POINT,
        'spot': pc.LIGHTTYPE_SPOT
    };

    var LightComponentSystem = function (app) {
        this.id = 'light';
        this.description = "Enables the Entity to emit light.";
        app.systems.add(this.id, this);

        this.ComponentType = pc.LightComponent;
        this.DataType = pc.LightComponentData;

        this.on('remove', this.onRemove, this);
    };
    LightComponentSystem = pc.inherits(LightComponentSystem, pc.ComponentSystem);

    pc.extend(LightComponentSystem.prototype, {
        initializeComponentData: function (component, _data) {
            // duplicate because we're modifying the data
            var data = {};
            var _props = pc._lightProps;
            var name;
            for(var i=0; i<_props.length; i++) {
                name = _props[i];
                data[name] = _data[name];
            };

            if (!data.type)
                data.type = component.data.type;

            component.data.type = data.type;

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
            this.app.scene.addLight(light);
            component.data.light = light;

            LightComponentSystem._super.initializeComponentData.call(this, component, data, _props);
        },

        onRemove: function (entity, data) {
            this.app.scene.removeLight(data.light);
        },

        cloneComponent: function (entity, clone) {
            var light = entity.light;

            var data = [];
            var name;
            var _props = pc._lightProps;
            for(var i=0; i<_props.length; i++) {
                name = _props[i];
                if (name==="light") continue;
                if (light[name] && light[name].clone) {
                    data[name] = light[name].clone();
                } else {
                    data[name] = light[name];
                }
            }

            this.addComponent(clone, data);
        },

        changeType: function (component, oldValue, newValue) {
            if (oldValue!==newValue) {
                component.light.type = lightTypes[newValue];
            }
        }
    });


    return {
        LightComponentSystem: LightComponentSystem
    };
}());
