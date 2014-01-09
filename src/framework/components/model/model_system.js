pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.ModelComponentSystem
     * @constructor Create a new ModelComponentSystem
     * @class Allows an Entity to render a model or a primitive shape like a box,
     * capsule, sphere, cylinder, cone etc.
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var ModelComponentSystem = function ModelComponentSystem (context) {
        this.id = 'model';
        this.description = "Renders a 3D model at the location of the Entity.";
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.ModelComponent;
        this.DataType = pc.fw.ModelComponentData;

        this.schema = [{
            name: "type",
            displayName: "Type",
            description: "Type of model",
            type: "enumeration",
            options: {
                enumerations: [{
                    name: 'Asset',
                    value: 'asset'
                }, {
                    name: 'Box',
                    value: 'box'
                }, {
                    name: 'Capsule',
                    value: 'capsule'
                }, {
                    name: 'Sphere',
                    value: 'sphere'
                }, {
                    name: 'Cylinder',
                    value: 'cylinder'
                }, {
                    name: 'Cone',
                    value: 'cone'
                }]
            },
            defaultValue: "asset"
        },{
            name: "asset",
            displayName: "Asset",
            description: "Model Asset to render",
            type: "asset",
            options: {
                max: 1,
                type: 'model'
            },
            defaultValue: null,
            filter: {
                type: 'asset'
            }
        }, {
            name: "materialAsset",
            displayName: "Material",
            description: "The material of the model",
            type: "asset",
            options: {
                max: 1,
                type: 'material'
            },
            defaultValue: null,
            filter: {
                type: function (value) {
                    return false;
                }
            }
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

        var gd = context.graphicsDevice;
        this.box = pc.scene.procedural.createBox(gd, {
            halfExtents: [0.5,0.5,0.5]
        });
        this.capsule = pc.scene.procedural.createCapsule(gd, {
            radius: 0.5,
            height: 2
        });
        this.sphere = pc.scene.procedural.createSphere(gd, {
            radius: 0.5
        });
        this.cone = pc.scene.procedural.createCone(gd, {
            baseRadius: 0.5,
            peakRadius: 0,
            height: 1
        });
        this.cylinder = pc.scene.procedural.createCylinder(gd, {
            radius: 0.5,
            height: 1
        });

        this.defaultMaterial = new pc.scene.PhongMaterial()
    };
    ModelComponentSystem = pc.inherits(ModelComponentSystem, pc.fw.ComponentSystem);
    
    pc.extend(ModelComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            data.material = this.defaultMaterial;

            // order matters here
            properties = ['material', 'materialAsset', 'asset', 'castShadows', 'receiveShadows', 'type'];            

            ModelComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        removeComponent: function (entity) {
            var data = entity.model.data;
            entity.model.asset = null;
            if (data.type !== 'asset' && data.model) {
                this.context.scene.removeModel(data.model);
                entity.removeChild(data.model.getGraph());
                data.model = null;
            }

            ModelComponentSystem._super.removeComponent.call(this, entity);
        },

        cloneComponent: function (entity, clone) {
            var component = this.addComponent(clone, {});
            
            clone.model.data.type = entity.model.type;
            clone.model.data.materialAsset = entity.model.materialAsset;
            clone.model.data.asset = entity.model.asset;
            clone.model.data.castShadows = entity.model.castShadows;
            clone.model.data.receiveShadows = entity.model.receiveShadows;
            clone.model.data.material = entity.model.material;
            if (entity.model.model) {
                clone.model.model = entity.model.model.clone();    
            }
        }
    });

    return {
        ModelComponentSystem: ModelComponentSystem
    };
}());