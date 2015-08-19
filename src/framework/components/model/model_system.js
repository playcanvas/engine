pc.extend(pc, function () {
    /**
     * @name pc.ModelComponentSystem
     * @constructor Create a new ModelComponentSystem
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
            'material',
            'model'
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
            properties = ['material', 'materialAsset', 'asset', 'castShadows', 'receiveShadows', 'type', 'enabled'];

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
            var component = this.addComponent(clone, {});

            clone.model.data.type = entity.model.type;
            clone.model.data.materialAsset = entity.model.materialAsset;
            clone.model.data.asset = entity.model.asset;
            clone.model.data.castShadows = entity.model.castShadows;
            clone.model.data.receiveShadows = entity.model.receiveShadows;
            clone.model.data.material = entity.model.material;
            clone.model.data.enabled = entity.model.enabled;

            if (entity.model.model)
                clone.model.model = entity.model.model.clone();
        },

        onRemove: function(entity, data) {
            data.remove();
        }
    });

    return {
        ModelComponentSystem: ModelComponentSystem
    };
}());
