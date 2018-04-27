pc.extend(pc, function () {
    var _schema = [
        'enabled',
        'type',
        'asset',
        'materialAsset',
        'castShadows',
        'receiveShadows',
        'castShadowsLightmap',
        'lightmapped',
        'lightmapSizeMultiplier',
        'isStatic',
        'material',
        'model',
        'layers',
        'batchGroupId',
        'mapping'
    ];

    /**
     * @constructor
     * @name pc.ModelComponentSystem
     * @classdesc Allows an Entity to render a model or a primitive shape like a box,
     * capsule, sphere, cylinder, cone etc.
     * @description Create a new ModelComponentSystem
     * @param {pc.Application} app The Application.
     * @extends pc.ComponentSystem
     */
    var ModelComponentSystem = function ModelComponentSystem (app) {
        this.id = 'model';
        this.description = "Renders a 3D model at the location of the Entity.";
        app.systems.add(this.id, this);

        this.ComponentType = pc.ModelComponent;
        this.DataType = pc.ModelComponentData;

        this.schema = _schema;

        var gd = app.graphicsDevice;
        this.box = pc.createBox(gd, {
            halfExtents: new pc.Vec3(0.5, 0.5, 0.5)
        });
        this.capsule = pc.createCapsule(gd, {
            radius: 0.5,
            height: 2
        });
        this.sphere = pc.createSphere(gd, {
            radius: 0.5
        });
        this.cone = pc.createCone(gd, {
            baseRadius: 0.5,
            peakRadius: 0,
            height: 1
        });
        this.cylinder = pc.createCylinder(gd, {
            radius: 0.5,
            height: 1
        });
        this.plane = pc.createPlane(gd, {
            halfExtents: new pc.Vec2(0.5, 0.5),
            widthSegments: 1,
            lengthSegments: 1
        });

        this.defaultMaterial = new pc.StandardMaterial();

        this.on('beforeremove', this.onRemove, this);
    };
    ModelComponentSystem = pc.inherits(ModelComponentSystem, pc.ComponentSystem);

    pc.Component._buildAccessors(pc.ModelComponent.prototype, _schema);

    pc.extend(ModelComponentSystem.prototype, {
        initializeComponentData: function (component, _data, properties) {

            // order matters here
            properties = ['enabled', 'material', 'materialAsset', 'asset', 'castShadows', 'receiveShadows', 'castShadowsLightmap', 'lightmapped', 'lightmapSizeMultiplier', 'type', 'mapping', 'layers', 'isStatic', 'batchGroupId'];

            // copy data into new structure
            var data = {};
            var name;
            for (var i = 0; i < properties.length; i++) {
                name = properties[i];
                data[name] = _data[name];
            }

            data.material = this.defaultMaterial;

            if (data.batchGroupId === null || data.batchGroupId === undefined) {
                data.batchGroupId = -1;
            }

            // duplicate layer list
            if (data.layers && pc.type(data.layers) === 'array') {
                data.layers = data.layers.slice(0);
            }


            ModelComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        removeComponent: function (entity) {
            var data = entity.model.data;
            entity.model.asset = null;
            if (data.type !== 'asset' && data.model) {
                entity.model.removeModelFromLayers(entity.model.model);
                entity.removeChild(data.model.getGraph());
                data.model = null;
            }

            ModelComponentSystem._super.removeComponent.call(this, entity);
        },

        cloneComponent: function (entity, clone) {
            var data = {
                type: entity.model.type,
                asset: entity.model.asset,
                castShadows: entity.model.castShadows,
                receiveShadows: entity.model.receiveShadows,
                castShadowsLightmap: entity.model.castShadowsLightmap,
                lightmapped: entity.model.lightmapped,
                lightmapSizeMultiplier: entity.model.lightmapSizeMultiplier,
                isStatic: entity.model.isStatic,
                enabled: entity.model.enabled,
                layers: entity.model.layers,
                batchGroupId: entity.model.batchGroupId,
                mapping: pc.extend({}, entity.model.mapping)
            };

            // if original has a different material
            // than the assigned materialAsset then make sure we
            // clone that one instead of the materialAsset one
            var materialAsset = entity.model.materialAsset;
            if (!(materialAsset instanceof pc.Asset) && materialAsset != null) {
                materialAsset = this.app.assets.get(materialAsset);
            }

            var material = entity.model.material;
            if (!material ||
                material === pc.ModelHandler.DEFAULT_MATERIAL ||
                !materialAsset ||
                material === materialAsset.resource) {

                data.materialAsset = materialAsset;
            }

            var component = this.addComponent(clone, data);

            // clone the original model if the original model component is of type asset but
            // has no specified asset
            if (entity.model.model && entity.model.type === 'asset' && ! entity.model.asset) {
                component.model = entity.model.model.clone();
                component._clonedModel = true;
            }

            if (!data.materialAsset)
                component.material = material;

            if (entity.model.model) {
                var meshInstances = entity.model.model.meshInstances;
                var meshInstancesClone = component.model.meshInstances;
                for (var i = 0; i < meshInstances.length; i++) {
                    meshInstancesClone[i].mask = meshInstances[i].mask;
                    meshInstancesClone[i].material = meshInstances[i].material;
                    meshInstancesClone[i].layer = meshInstances[i].layer;
                    meshInstancesClone[i].receiveShadow = meshInstances[i].receiveShadow;
                }
            }
        },

        onRemove: function(entity, component) {
            // Unhook any material asset events
            entity.model.materialAsset = null;
            component.remove();
        }
    });

    return {
        ModelComponentSystem: ModelComponentSystem
    };
}());
