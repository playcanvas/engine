pc.extend(pc.fw, function () {

    /**
     * @name pc.fw.PrimitiveComponentSystem
     * @constructor Create a new PrimitiveComponentSystem
     * @class The primitive component renders a geometry primitive with the transform of the entity it is attached to.
     * @param {pc.fw.ApplicationContext} context The ApplicationContext for the active application
     */
    var PrimitiveComponentSystem = function PrimitiveComponentSystem(context) {
        this.id = 'primitive';
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.PrimitiveComponent;
        this.DataType = pc.fw.PrimitiveComponentData;

        this.schema = [{
            name: "type",
            displayName: "Type",
            description: "Type of primitive",
            type: "enumeration",
            options: {
                enumerations: [{
                    name: 'Box',
                    value: pc.shape.Type.BOX
                }, {
                    name: 'Capsule',
                    value: pc.shape.Type.CAPSULE
                }, {
                    name: 'Sphere',
                    value: pc.shape.Type.SPHERE
                }, {
                    name: 'Cylinder',
                    value: pc.shape.Type.CYLINDER
                }, {
                    name: 'Cone',
                    value: pc.shape.Type.CONE
                }]
            },
            defaultValue: "Box"
        }, {
            name: "color",
            displayName: "Color",
            description: "Material color",
            type: "rgb",
            defaultValue: "0xffffff"
        }, {
            name: "castShadows",
            displayName: "Cast shadows",
            description: "Occlude light from shadow casting lights",
            type: "boolean",
            defaultValue: false            
        }, {
            name: "receiveShadows",
            displayName: "Receive shadows",
            description: "Receive shadows cast from occluders",
            type: "boolean",
            defaultValue: true
        }, {
            name: "material",
            exposed: false
        }, {
            name: "model",
            exposed: false
        }];

        this.exposeProperties();

        this.box = pc.scene.procedural.createBox({
            halfExtents: [0.5,0.5,0.5]
        });
        this.capsule = pc.scene.procedural.createCapsule({
            radius: 0.5,
            height: 2
        });
        this.sphere = pc.scene.procedural.createSphere({
            radius: 0.5
        });
        this.cone = pc.scene.procedural.createCone({
            baseRadius: 0.5,
            peakRadius: 0,
            height: 1
        });
        this.cylinder = pc.scene.procedural.createCylinder({
            radius: 0.5,
            height: 1
        });

        this.on('remove', this.onRemove, this);
    };
    PrimitiveComponentSystem = pc.inherits(PrimitiveComponentSystem, pc.fw.ComponentSystem);

    pc.extend(PrimitiveComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            data.material = new pc.scene.PhongMaterial();

            properties = ['material', 'castShadows', 'color', 'receiveShadows', 'type'];
            PrimitiveComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        onRemove: function (entity, data) {
            if (data.model) {
                this.context.scene.removeModel(data.model);
                entity.removeChild(data.model.getGraph());
                data.model = null;
            }
        }
    });

    return {
        PrimitiveComponentSystem: PrimitiveComponentSystem
    };
}());