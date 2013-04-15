pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.PointLightComponentSystem
     * @constructor Create a new PointLightComponentSystem
     * @class A Light Component is used to dynamically light the scene.
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var PointLightComponentSystem = function (context) {
        this.id = 'pointlight';
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
            description: "Light Color",
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
            name: "attenuationEnd",
            displayName: "Radius",
            description: "The distance from the light where its contribution falls to zero",
            type: "number",
            defaultValue: 10,
            options: {
                min: 0
            }
        }, {
            name: "model",
            exposed: false
        }];

        this.exposeProperties();

        // TODO: Only allocate graphics resources when running in Designer
        this.lightMat = new pc.scene.BasicMaterial();
        this.lightMat.color = new Float32Array([1, 1, 0, 1]);
        this.lightMat.update();

        this.sphereMesh = pc.scene.procedural.createSphere({
            radius: 0.1
        });

        this.on('remove', this.onRemove, this);
    };
    PointLightComponentSystem = pc.inherits(PointLightComponentSystem, pc.fw.ComponentSystem);

    pc.extend(PointLightComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            var node = new pc.scene.LightNode();
            node.setName('pointlight');
            node.setType(pc.scene.LightType.POINT);

            var model = new pc.scene.Model();
            model.graph = node;
            model.lights = [ node ];

            if (this.context.designer) {
                model.meshInstances = [ new pc.scene.MeshInstance(node, this.sphereMesh, this.lightMat) ];
            }

            this.context.scene.addModel(model);
            component.entity.addChild(node);

            data.model = model;

            properties = ['model', 'enable', 'color', 'intensity', 'attenuationEnd'];
            PointLightComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        onRemove: function (entity, data) {
            entity.removeChild(data.model.graph);
            this.context.scene.removeModel(data.model);
            delete data.model;
        }
    });

    return {
        PointLightComponentSystem: PointLightComponentSystem
    }; 
}());
