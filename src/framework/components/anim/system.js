import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { AnimComponent } from './component.js';
import { AnimComponentData } from './data.js';

var _schema = [
    'enabled',
    'speed',
    'activate',
    'playing'
];

/**
 * @private
 * @class
 * @name pc.AnimComponentSystem
 * @augments pc.ComponentSystem
 * @classdesc The AnimComponentSystem manages creating and deleting AnimComponents.
 * @description Create an AnimComponentSystem.
 * @param {pc.Application} app - The application managing this system.
 */
function AnimComponentSystem(app) {
    ComponentSystem.call(this, app);

    this.id = 'anim';

    this.ComponentType = AnimComponent;
    this.DataType = AnimComponentData;

    this.schema = _schema;

    this.on('beforeremove', this.onBeforeRemove, this);
    this.on('animationUpdate', this.onAnimationUpdate, this);
}

AnimComponentSystem.prototype = Object.create(ComponentSystem.prototype);
AnimComponentSystem.prototype.constructor = AnimComponentSystem;

Component._buildAccessors(AnimComponent.prototype, _schema);

Object.assign(AnimComponentSystem.prototype, {
    initializeComponentData: function (component, data, properties) {
        properties = ['activate', 'enabled', 'speed', 'playing', 'stateGraphAsset'];
        ComponentSystem.prototype.initializeComponentData.call(this, component, data, properties);
        if (data.animationAssets) {
            component.data.animationAssets = Object.assign(component.data.animationAssets, data.animationAssets);
            component.loadAnimationAssets();
        }
    },

    onAnimationUpdate: function (dt) {
        var components = this.store;

        for (var id in components) {
            if (components.hasOwnProperty(id)) {
                var component = components[id];
                var componentData = component.data;

                if (componentData.enabled && component.entity.enabled && componentData.playing) {
                    for (var i = 0; i < componentData.layers.length; i++) {
                        componentData.layers[i].update(dt * componentData.speed);
                    }
                }
            }
        }
    }
});

export { AnimComponentSystem };
