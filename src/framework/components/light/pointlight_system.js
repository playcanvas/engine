pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.PointLightComponentSystem
     * @constructor Create a new PointLightComponentSystem
     * @class A Light Component is used to dynamically light the scene.
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var PointLightComponentSystem = function (context) {
        this.id = 'pointlight'
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.PointLightComponent;
        this.DataType = pc.fw.PointLightComponentData;

        this.schema = [{
            name: "enable",
            displayName: "Enable",
            description: "Enable or disable the light",
            type: "boolean",
            defaultValue: true
        }, {
            name: "color",
            displayName: "Color",
            description: "Light color",
            type: "rgb",
            defaultValue: "0xffffff"
        }, {
            name: "intensity",
            displayName: "Intensity",
            description: "Factors the light color",
            type: "number",
            defaultValue: 1,
            options: {
                min: 0,
                max: 10,
                step: 0.05
            }
        }, {
            name: "castShadows",
            displayName: "Cast shadows",
            description: "Cast shadows from this light",
            type: "boolean",
            defaultValue: false
        }, {
            name: "attenuationEnd",
            displayName: "Attenuation End",
            description: "The distance from the light where its contribution falls to zero",
            type: "number",
            defaultValue: 10,
            options: {
                min: 0
            }
        }, {
            name: 'light', 
            exposed: false
        }];

        this.exposeProperties();

        this.renderable = _createGfxResources();

        this.bind('remove', this.onRemove.bind(this));
        pc.fw.ComponentSystem.bind('toolsUpdate', this.toolsUpdate.bind(this));
    };
    PointLightComponentSystem = pc.inherits(PointLightComponentSystem, pc.fw.ComponentSystem);

    pc.extend(PointLightComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            var light = new pc.scene.LightNode();
            light.setType(pc.scene.LightType.POINT);

            data.light = light;

            properties = ['light', 'enable', 'color', 'intensity', 'castShadows', 'attenuationEnd'];
            PointLightComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        onRemove: function (entity, data) {
            entity.removeChild(data.light);
            data.light.setEnabled(false);
            delete data.light;
        },

        toolsUpdate: function (fn) {
            var components = this.store;
            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var entity = components[id].entity;
                    var componentData = components[id].data;

                    this.context.scene.enqueue('opaque', function (renderable, position) {
                        return function () {
                            renderable.setLocalPosition(position);
                            renderable.syncHierarchy();
                            renderable.dispatch();                            
                        };
                    }(this.renderable, entity.getPosition()));                    
                }
            }
        }
    });

    var _createGfxResources = function () {
        var lightMat = new pc.scene.BasicMaterial();
        lightMat.color = new Float32Array([1, 1, 0, 1]);
        lightMat.update();

        var sphereGeom = pc.scene.procedural.createSphere({material: lightMat});
        
        var sphereMesh = new pc.scene.MeshNode();
        sphereMesh.setGeometry(sphereGeom);
        
        return sphereMesh;
    };
    
    return {
        PointLightComponentSystem: PointLightComponentSystem
    }; 
}());
