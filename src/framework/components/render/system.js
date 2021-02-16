import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { RenderComponent } from './component.js';
import { RenderComponentData } from './data.js';

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
 * @private
 * @class
 * @name RenderComponentSystem
 * @augments ComponentSystem
 * @classdesc Allows an Entity to render a mesh or a primitive shape like a box, capsule, sphere, cylinder, cone etc.
 * @description Create a new RenderComponentSystem.
 * @param {pc.Application} app - The Application.
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

        super.initializeComponentData(component, _data, _schema);
    }

    cloneComponent(entity, clone) {
        var i;
        var data = {};

        for (i = 0; i < _properties.length; i++) {
            data[_properties[i]] = entity.render[_properties[i]];
        }

        // we cannot copy mesh instances, delete them and component recreates them properly
        delete data.meshInstances;

        var component = this.addComponent(clone, data);

        // TODO: we should copy all relevant meshinstance properties here
        if (entity.render) {
            var meshInstances = entity.render.meshInstances;
            var meshInstancesClone = component.meshInstances;
            for (i = 0; i < meshInstances.length && i < meshInstancesClone.length; i++) {
                meshInstancesClone[i].mask = meshInstances[i].mask;
                meshInstancesClone[i].material = meshInstances[i].material;
                meshInstancesClone[i].layer = meshInstances[i].layer;
                meshInstancesClone[i].receiveShadow = meshInstances[i].receiveShadow;
            }
        }
    }

    onRemove(entity, component) {
        component.onRemove();
    }
}

Component._buildAccessors(RenderComponent.prototype, _schema);

export { RenderComponentSystem };
