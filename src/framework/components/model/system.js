import { extend } from '../../../core/core.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { BoundingBox } from '../../../core/shape/bounding-box.js';
import { getDefaultMaterial } from '../../../scene/materials/default-material.js';
import { Asset } from '../../asset/asset.js';
import { ComponentSystem } from '../system.js';
import { ModelComponent } from './component.js';

/**
 * @import { AppBase } from '../../app-base.js'
 */

// order matters here
const _properties = [
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

/**
 * Allows an Entity to render a model or a primitive shape like a box, capsule, sphere, cylinder,
 * cone etc.
 *
 * @category Graphics
 */
class ModelComponentSystem extends ComponentSystem {
    /**
     * Create a new ModelComponentSystem instance.
     *
     * @param {AppBase} app - The Application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'model';

        this.ComponentType = ModelComponent;

        this.defaultMaterial = getDefaultMaterial(app.graphicsDevice);

        this.on('beforeremove', this.onBeforeRemove, this);
    }

    initializeComponentData(component, _data) {
        if (_data.batchGroupId === null || _data.batchGroupId === undefined) {
            _data.batchGroupId = -1;
        }

        // duplicate layer list
        if (_data.layers && _data.layers.length) {
            _data.layers = _data.layers.slice(0);
        }

        for (let i = 0; i < _properties.length; i++) {
            if (_data.hasOwnProperty(_properties[i])) {
                component[_properties[i]] = _data[_properties[i]];
            }
        }

        if (_data.aabbCenter && _data.aabbHalfExtents) {
            component.customAabb = new BoundingBox(new Vec3(_data.aabbCenter), new Vec3(_data.aabbHalfExtents));
        }

        super.initializeComponentData(component, _data);
    }

    cloneComponent(entity, clone) {
        const data = {
            enabled: entity.model.enabled
        };

        for (let i = 0; i < _properties.length; i++) {
            const property = _properties[i];
            switch (property) {
                // material and materialAsset are handled below, after the
                // appropriate one to clone has been determined
                case 'material':
                case 'materialAsset':
                    break;
                case 'mapping':
                    data.mapping = extend({}, entity.model.mapping);
                    break;
                default:
                    data[property] = entity.model[property];
                    break;
            }
        }

        // if original has a different material
        // than the assigned materialAsset then make sure we
        // clone that one instead of the materialAsset one
        let materialAsset = entity.model.materialAsset;
        if (!(materialAsset instanceof Asset) && materialAsset != null) {
            materialAsset = this.app.assets.get(materialAsset);
        }

        const material = entity.model.material;
        if (!material ||
            material === this.defaultMaterial ||
            !materialAsset ||
            material === materialAsset.resource) {

            data.materialAsset = materialAsset;
        }

        const component = this.addComponent(clone, data);

        // clone the original model if the original model component is of type asset but
        // has no specified asset
        if (entity.model.model && entity.model.type === 'asset' && !entity.model.asset) {
            component.model = entity.model.model.clone();
            component._clonedModel = true;
        }

        if (!data.materialAsset) {
            component.material = material;
        }

        // TODO: we should copy all relevant mesh instance properties here
        if (entity.model.model) {
            const meshInstances = entity.model.model.meshInstances;
            const meshInstancesClone = component.model.meshInstances;
            for (let i = 0; i < meshInstances.length; i++) {
                meshInstancesClone[i].mask = meshInstances[i].mask;
                meshInstancesClone[i].material = meshInstances[i].material;
                meshInstancesClone[i].layer = meshInstances[i].layer;
                meshInstancesClone[i].receiveShadow = meshInstances[i].receiveShadow;
            }
        }

        if (entity.model.customAabb) {
            component.customAabb = entity.model.customAabb.clone();
        }

        return component;
    }

    onBeforeRemove(entity, component) {
        component.onBeforeRemove();
    }
}

export { ModelComponentSystem };
