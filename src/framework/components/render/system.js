import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { RenderComponent } from './component.js';
import { RenderComponentData } from './data.js';

import { BoundingBox } from '../../../shape/bounding-box';
import { Vec3 } from '../../../math/vec3';

const _schema = [
    { name: 'rootBone', type: 'entity' },
    'enabled'
];

// order matters here
const _properties = [
    'material',
    'meshInstances',
    'asset',
    'materialAssets',
    'castShadows',
    'receiveShadows',
    'castShadowsLightmap',
    'lightmapped',
    'lightmapSizeMultiplier',
    'renderStyle',
    'type',
    'layers',
    'isStatic',
    'batchGroupId'
];

/**
 * @class
 * @name RenderComponentSystem
 * @augments ComponentSystem
 * @classdesc Allows an Entity to render a mesh or a primitive shape like a box, capsule, sphere, cylinder, cone etc.
 * @description Create a new RenderComponentSystem.
 * @param {Application} app - The Application.
 */
class RenderComponentSystem extends ComponentSystem {
    constructor(app) {
        super(app);

        this.id = 'render';

        this.ComponentType = RenderComponent;
        this.DataType = RenderComponentData;

        this.schema = _schema;
        this.defaultMaterial = app.scene.defaultMaterial;

        this.on('beforeremove', this.onRemove, this);
    }

    initializeComponentData(component, _data, properties) {
        if (_data.batchGroupId === null || _data.batchGroupId === undefined) {
            _data.batchGroupId = -1;
        }

        // duplicate layer list
        if (_data.layers && _data.layers.length) {
            _data.layers = _data.layers.slice(0);
        }

        for (var i = 0; i < _properties.length; i++) {
            if (_data.hasOwnProperty(_properties[i])) {
                component[_properties[i]] = _data[_properties[i]];
            }
        }

        if (_data.aabbCenter && _data.aabbHalfExtents) {
            component.customAabb = new BoundingBox(new Vec3(_data.aabbCenter), new Vec3(_data.aabbHalfExtents));
        }

        super.initializeComponentData(component, _data, _schema);
    }

    cloneComponent(entity, clone) {

        // copy properties
        const data = {};
        for (let i = 0; i < _properties.length; i++) {
            data[_properties[i]] = entity.render[_properties[i]];
        }

        // mesh instances cannot be used this way, remove them and manually clone them later
        delete data.meshInstances;

        // clone component
        const component = this.addComponent(clone, data);

        // clone mesh instances
        const srcMeshInstances = entity.render.meshInstances;
        const meshes = srcMeshInstances.map((mi) => mi.mesh);
        component._onSetMeshes(meshes);

        // assign materials
        for (let m = 0; m < srcMeshInstances.length; m++) {
            component.meshInstances[m].material = srcMeshInstances[m].material;
        }

        if (entity.render.customAabb) {
            component.customAabb = entity.render.customAabb.clone();
        }
    }

    onRemove(entity, component) {
        component.onRemove();
    }
}

Component._buildAccessors(RenderComponent.prototype, _schema);

export { RenderComponentSystem };
