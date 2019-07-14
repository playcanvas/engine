Object.assign(pc, function () {
    var _schema = [
        'enabled'
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
    var ModelComponentSystem = function ModelComponentSystem(app) {
        pc.ComponentSystem.call(this, app);

        this.id = 'model';
        this.description = "Renders a 3D model at the location of the Entity.";

        this.ComponentType = pc.ModelComponent;
        this.DataType = pc.ModelComponentData;

        this.schema = _schema;

        this.box = null;
        this.capsule = null;
        this.cone = null;
        this.cylinder = null;
        this.plane = null;
        this.sphere = null;

        this.defaultMaterial = app.scene.defaultMaterial;

        this.on('beforeremove', this.onRemove, this);
    };
    ModelComponentSystem.prototype = Object.create(pc.ComponentSystem.prototype);
    ModelComponentSystem.prototype.constructor = ModelComponentSystem;

    pc.Component._buildAccessors(pc.ModelComponent.prototype, _schema);

    Object.assign(ModelComponentSystem.prototype, {
        initializeComponentData: function (component, _data, properties) {
            // order matters here
            properties = [
                'material',
                'materialAsset',
                'asset',
                'castShadows',
                'receiveShadows',
                'castShadowsLightmap',
                'lightmapped',
                'lightmapSizeMultiplier',
                'type',
                'mapping',
                'layers',
                'isStatic',
                'batchGroupId'
            ];

            if (_data.batchGroupId === null || _data.batchGroupId === undefined) {
                _data.batchGroupId = -1;
            }

            // duplicate layer list
            if (_data.layers && _data.layers.length) {
                _data.layers = _data.layers.slice(0);
            }

            for (var i = 0; i < properties.length; i++) {
                if (_data.hasOwnProperty(properties[i])) {
                    component[properties[i]] = _data[properties[i]];
                }
            }

            pc.ComponentSystem.prototype.initializeComponentData.call(this, component, _data, ['enabled']);


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
                material === this.defaultMaterial ||
                !materialAsset ||
                material === materialAsset.resource) {

                data.materialAsset = materialAsset;
            }

            var component = this.addComponent(clone, data);

            // clone the original model if the original model component is of type asset but
            // has no specified asset
            if (entity.model.model && entity.model.type === 'asset' && !entity.model.asset) {
                component.model = entity.model.model.clone();
                component._clonedModel = true;
            }

            if (!data.materialAsset)
                component.material = material;

            // TODO: we should copy all relevant meshinstance properties here
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

        onRemove: function (entity, component) {
            component.onRemove();
        }
    });

    return {
        ModelComponentSystem: ModelComponentSystem
    };
}());
