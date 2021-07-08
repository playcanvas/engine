import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { AnimComponent } from './component.js';
import { AnimComponentData } from './data.js';

const _schema = [
    'enabled'
];

/**
 * @class
 * @name AnimComponentSystem
 * @augments ComponentSystem
 * @classdesc The AnimComponentSystem manages creating and deleting AnimComponents.
 * @description Create an AnimComponentSystem.
 * @param {Application} app - The application managing this system.
 */
class AnimComponentSystem extends ComponentSystem {
    constructor(app) {
        super(app);

        this.id = 'anim';

        this.ComponentType = AnimComponent;
        this.DataType = AnimComponentData;

        this.schema = _schema;

        this.on('beforeremove', this.onBeforeRemove, this);
        ComponentSystem.bind('animationUpdate', this.onAnimationUpdate, this);
    }

    initializeComponentData(component, data, properties) {
        properties = ['activate', 'speed', 'playing'];
        super.initializeComponentData(component, data, _schema);
        const complexProperties = ['animationAssets', 'stateGraph', 'layers'];
        Object.keys(data).forEach((key) => {
            // these properties will be initialised manually below
            if (complexProperties.includes(key)) return;
            component[key] = data[key];
        });
        if (data.stateGraph) {
            component.stateGraph = data.stateGraph;
            component.loadStateGraph(component.stateGraph);
        }
        if (data.layers) {
            data.layers.forEach((layer, i) => {
                layer._controller.states.forEach((stateKey) => {
                    layer._controller._states[stateKey]._animationList.forEach((node) => {
                        component.layers[i].assignAnimation(node.name, node.animTrack);
                    });
                });
            });
        } else if (data.animationAssets) {
            component.animationAssets = Object.assign(component.animationAssets, data.animationAssets);
        }
    }

    onAnimationUpdate(dt) {
        var components = this.store;

        for (var id in components) {
            if (components.hasOwnProperty(id)) {
                var component = components[id].entity.anim;
                var componentData = component.data;

                if (componentData.enabled && component.entity.enabled && component.playing) {
                    for (var i = 0; i < component.layers.length; i++) {
                        component.layers[i].update(dt * component.speed);
                    }
                }
            }
        }
    }

    cloneComponent(entity, clone) {
        var data = {
            stateGraphAsset: entity.anim.stateGraphAsset,
            animationAssets: entity.anim.animationAssets,
            speed: entity.anim.speed,
            activate: entity.anim.activate,
            playing: entity.anim.playing,
            rootBone: entity.anim.rootBone,
            stateGraph: entity.anim.stateGraph,
            layers: entity.anim.layers,
            layerIndices: entity.anim.layerIndices,
            parameters: entity.anim.parameters
        };
        this.addComponent(clone, data);
    }

    onBeforeRemove(entity, component) {
        component.onBeforeRemove();
    }
}

Component._buildAccessors(AnimComponent.prototype, _schema);

export { AnimComponentSystem };
