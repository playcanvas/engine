import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { RenderComponent } from './component.js';
import { RenderComponentData } from './data.js';

var _schema = ['enabled'];

/**
 * @private
 * @class
 * @name pc.RenderComponentSystem
 * @augments pc.ComponentSystem
 * @classdesc Allows an Entity to render a mesh or a primitive shape like a box, capsule, sphere, cylinder, cone etc.
 * @description Create a new RenderComponentSystem.
 * @param {pc.Application} app - The Application.
 */
function RenderComponentSystem(app) {
    ComponentSystem.call(this, app);

    this.id = 'render';

    this.ComponentType = RenderComponent;
    this.DataType = RenderComponentData;

    this.schema = _schema;
    this.defaultMaterial = app.scene.defaultMaterial;

    this.on('beforeremove', this.onRemove, this);
}

RenderComponentSystem.prototype = Object.create(ComponentSystem.prototype);
RenderComponentSystem.prototype.constructor = RenderComponentSystem;

Component._buildAccessors(RenderComponent.prototype, _schema);

Object.assign(RenderComponentSystem.prototype, {
    initializeComponentData: function (component, _data, properties) {

        // order matters here
        properties = [
            'material',
            'castShadows',
            'receiveShadows',
            'castShadowsLightmap',
            'lightmapped',
            'lightmapSizeMultiplier',
            'type',
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

        ComponentSystem.prototype.initializeComponentData.call(this, component, _data, ['enabled']);
    },

    cloneComponent: function (entity, clone) {
        var data = {
            type: entity.render.type,
            castShadows: entity.render.castShadows,
            receiveShadows: entity.render.receiveShadows,
            castShadowsLightmap: entity.render.castShadowsLightmap,
            lightmapped: entity.render.lightmapped,
            lightmapSizeMultiplier: entity.render.lightmapSizeMultiplier,
            isStatic: entity.render.isStatic,
            enabled: entity.render.enabled,
            layers: entity.render.layers,
            batchGroupId: entity.render.batchGroupId,
        };

        var component = this.addComponent(clone, data);

        var material = entity.render.material;
        component.material = material;

        // TODO: we should copy all relevant meshinstance properties here
        if (entity.render) {
            var meshInstances = entity.render.meshInstances;
            var meshInstancesClone = component.render.meshInstances;
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

export { RenderComponentSystem };
