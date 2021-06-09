import { extend } from '../../../core/core.js';

import { Asset } from '../../../asset/asset.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { ModelComponent } from './component.js';
import { ModelComponentData } from './data.js';

import { BoundingBox } from '../../../shape/bounding-box';
import { Vec3 } from '../../../math/vec3';

const _schema = ['enabled'];

/**
 * @class
 * @name ModelComponentSystem
 * @augments ComponentSystem
 * @classdesc Allows an Entity to render a model or a primitive shape like a box,
 * capsule, sphere, cylinder, cone etc.
 * @description Create a new ModelComponentSystem.
 * @param {Application} app - The Application.
 */
class ModelComponentSystem extends ComponentSystem {
    constructor(app) {
        super(app);

        this.id = 'model';

        this.ComponentType = ModelComponent;
        this.DataType = ModelComponentData;

        this.schema = _schema;
        this.defaultMaterial = app.scene.defaultMaterial;

        this.on('beforeremove', this.onRemove, this);
    }

    initializeComponentData(component, _data, properties) {
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

        if (_data.aabbCenter && _data.aabbHalfExtents) {
            component.customAabb = new BoundingBox(new Vec3(_data.aabbCenter), new Vec3(_data.aabbHalfExtents));
        }

        super.initializeComponentData(component, _data, ['enabled']);
    }

    cloneComponent(entity, clone) {
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
            mapping: extend({}, entity.model.mapping)
        };

        // if original has a different material
        // than the assigned materialAsset then make sure we
        // clone that one instead of the materialAsset one
        var materialAsset = entity.model.materialAsset;
        if (!(materialAsset instanceof Asset) && materialAsset != null) {
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

        if (entity.model.customAabb) {
            component.customAabb = entity.model.aabb.clone();
        }
    }

    onRemove(entity, component) {
        component.onRemove();
    }
}

Component._buildAccessors(ModelComponent.prototype, _schema);

export { ModelComponentSystem };
