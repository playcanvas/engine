pc.extend(pc, function () {
    /**
     * @name pc.ModelComponentSystem
     * @description Create a new ModelComponentSystem
     * @class Allows an Entity to render a model or a primitive shape like a box,
     * capsule, sphere, cylinder, cone etc.
     * @param {pc.Application} app The Application.
     * @extends pc.ComponentSystem
     */
    var ModelComponentSystem = function ModelComponentSystem (app) {
        this.id = 'model';
        this.description = "Renders a 3D model at the location of the Entity.";
        app.systems.add(this.id, this);

        this.ComponentType = pc.ModelComponent;
        this.DataType = pc.ModelComponentData;

        this.schema = [
            'enabled',
            'type',
            'asset',
            'materialAsset',
            'castShadows',
            'receiveShadows',
            'lightmapped',
            'material',
            'model',
            'mapping'
        ];

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

        this.defaultMaterial = new pc.PhongMaterial();

        this.on('beforeremove', this.onRemove, this);
    };
    ModelComponentSystem = pc.inherits(ModelComponentSystem, pc.ComponentSystem);

    pc.extend(ModelComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            data.material = this.defaultMaterial;

            // order matters here
            properties = ['enabled', 'material', 'materialAsset', 'asset', 'castShadows', 'receiveShadows', 'lightmapped', 'type', 'mapping'];

            ModelComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        removeComponent: function (entity) {
            var data = entity.model.data;
            entity.model.asset = null;
            if (data.type !== 'asset' && data.model) {
                this.app.scene.removeModel(data.model);
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
                lightmapped: entity.model.lightmapped,
                enabled: entity.model.enabled,
                mapping: pc.extend({}, entity.model.mapping)
            };

            // if original has a different material
            // than the assigned materialAsset then make sure we
            // clone that one instead of the materialAsset one
            var materialAsset = entity.model.materialAsset;
            if (!(materialAsset instanceof pc.Asset) && materialAsset != null) {
                materialAsset = app.assets.get(materialAsset);
            }

            var material = entity.model.material;
            if (!material ||
                material === pc.ModelHandler.DEFAULT_MATERIAL ||
                !materialAsset ||
                material === materialAsset.resource) {

                data.materialAsset = materialAsset;
            }

            var component = this.addComponent(clone, data);

            if (!data.materialAsset)
                component.material = material;
        },

        onRemove: function(entity, data) {
            data.remove();
        }
    });

    return {
        ModelComponentSystem: ModelComponentSystem
    };
}());
