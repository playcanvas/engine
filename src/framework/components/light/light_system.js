pc.extend(pc, function () {
    var lightTypes = {
        'directional': pc.LIGHTTYPE_DIRECTIONAL,
        'point': pc.LIGHTTYPE_POINT,
        'spot': pc.LIGHTTYPE_SPOT
    };

/**
     * @name pc.LightComponentSystem
     * @constructor Create a new LightComponentSystem.
     * @class A Light Component is used to dynamically light the scene.
     * @param {pc.Application} app The application.
     * @extends pc.ComponentSystem
     */
    var LightComponentSystem = function (app) {
        this.id = 'light';
        this.description = "Enables the Entity to emit light."
        app.systems.add(this.id, this);

        this.ComponentType = pc.LightComponent;
        this.DataType = pc.LightComponentData;

        this.schema = [
            'enabled',
            'type',
            'color',
            'intensity',
            'castShadows',
            'shadowDistance',
            'shadowResolution',
            'shadowBias',
            'normalOffsetBias',
            'range',
            'falloffMode',
            'shadowType',
            'shadowUpdateMode',
            'mask',
            'innerConeAngle',
            'outerConeAngle',
            'light',
            'model'
        ];

        this.on('remove', this.onRemove, this);
    };

    LightComponentSystem = pc.inherits(LightComponentSystem, pc.ComponentSystem);

    pc.extend(LightComponentSystem.prototype, {
        initializeComponentData: function (component, _data, properties) {
            properties = ['type', 'light', 'model', 'enabled', 'color', 'intensity', 'range', 'falloffMode', 'innerConeAngle', 'outerConeAngle', 'castShadows', 'shadowDistance', 'shadowResolution', 'shadowUpdateMode', 'shadowBias', 'normalOffsetBias'];

            // duplicate because we're modifying the data
            var data = {};
            properties.forEach(function (prop) {
                data[prop] = _data[prop];
            })

            if (! data.type)
                data.type = component.data.type;

            component.data.type = data.type;

            if (data.color && pc.type(data.color) === 'array')
                data.color = new pc.Color(data.color[0], data.color[1], data.color[2]);

            if (data.enable) {
                console.warn("WARNING: enable: Property is deprecated. Set enabled property instead.");
                data.enabled = data.enable;
            }

            var light = new pc.Light();
            light.setType(lightTypes[data.type]);
            light._node = component.entity;
            this.app.scene.addLight(light);
            component.data.light = light;

            LightComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        onRemove: function (entity, data) {
            this.app.scene.removeLight(data.light);
        },

        cloneComponent: function (entity, clone) {
            var light = entity.light;

            // create new data block for clone
            var data = {
                type: light.type,
                enabled: light.enabled,
                color: [light.color.r, light.color.g, light.color.b],
                intensity: light.intensity,
                range: light.range,
                innerConeAngle: light.innerConeAngle,
                outerConeAngle: light.outerConeAngle,
                castShadows: light.castShadows,
                shadowDistance: light.shadowDistance,
                shadowResolution: light.shadowResolution,
                falloffMode: light.falloffMode,
                shadowUpdateMode: light.shadowUpdateMode,
                shadowBias: light.shadowBias,
                normalOffsetBias: light.normalOffsetBias
            };

            this.addComponent(clone, data);
        },

        changeType: function (component, oldValue, newValue) {
            // remove old light
            this.app.scene.removeLight(component.light);
            // create new light
            var light = new pc.Light();
            light.setType(lightTypes[newValue]);
            light._node = component.entity;
            // add to scene
            this.app.scene.addLight(light);
            // add to component
            component.light = light;
            component.data.light = light;
        }
    });

    return {
        LightComponentSystem: LightComponentSystem
    };
}());
