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

        if (context.designer) {
            this.lightMat = new pc.scene.BasicMaterial();
            this.lightMat.color = new Float32Array([1, 1, 0, 1]);
            this.lightMat.update();

            this.sphereMesh = pc.scene.procedural.createSphere({
                radius: 0.1
            });
        }

        this.bind('remove', this.onRemove.bind(this));
    };
    PointLightComponentSystem = pc.inherits(PointLightComponentSystem, pc.fw.ComponentSystem);

    pc.extend(PointLightComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            var lightNode = new pc.scene.LightNode();
            lightNode.setName('pointlight');
            lightNode.setType(pc.scene.LightType.POINT);

            var lightModel = new pc.scene.Model();
            lightModel.graph = lightNode;
            lightModel.lights = [lightNode];

            if (this.context.designer) {
                lightModel.meshInstances = [ new pc.scene.MeshInstance(lightNode, this.lightMat, this.sphereMesh) ];
            }

            this.context.scene.addModel(lightModel);
            component.entity.addChild(lightModel.graph);

            data.model = lightModel;

            properties = ['model', 'enable', 'color', 'intensity', 'castShadows', 'attenuationEnd'];
            PointLightComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        onRemove: function (entity, data) {
            entity.removeChild(data.model.graph);
            this.context.scene.removeModel(data.model);
            delete data.light;
        }
    });

    return {
        PointLightComponentSystem: PointLightComponentSystem
    }; 
}());
