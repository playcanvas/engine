import { AnimTrack } from '../../anim/evaluator/anim-track.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { AnimComponent } from './component.js';
import { AnimComponentData } from './data.js';

const _schema = [
    'enabled'
];

/**
 * The AnimComponentSystem manages creating and deleting AnimComponents.
 *
 * @category Animation
 */
class AnimComponentSystem extends ComponentSystem {
    /**
     * Create an AnimComponentSystem instance.
     *
     * @param {import('../../app-base.js').AppBase} app - The application managing this system.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'anim';

        this.ComponentType = AnimComponent;
        this.DataType = AnimComponentData;

        this.schema = _schema;

        this.on('beforeremove', this.onBeforeRemove, this);
        this.app.systems.on('animationUpdate', this.onAnimationUpdate, this);
    }

    initializeComponentData(component, data, properties) {
        super.initializeComponentData(component, data, _schema);
        const complexProperties = ['animationAssets', 'stateGraph', 'layers', 'masks'];
        Object.keys(data).forEach((key) => {
            // these properties will be initialized manually below
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
                        if (!node.animTrack || node.animTrack === AnimTrack.EMPTY) {
                            const animationAsset = this.app.assets.get(layer._component._animationAssets[layer.name + ':' + node.name].asset);
                            // If there is an animation asset that hasn't been loaded, assign it once it has loaded. If it is already loaded it will be assigned already.
                            if (animationAsset && !animationAsset.loaded) {
                                animationAsset.once('load', () => {
                                    component.layers[i].assignAnimation(node.name, animationAsset.resource);
                                });
                            }
                        } else {
                            component.layers[i].assignAnimation(node.name, node.animTrack);
                        }
                    });
                });
            });
        } else if (data.animationAssets) {
            component.animationAssets = Object.assign(component.animationAssets, data.animationAssets);
        }

        if (data.masks) {
            Object.keys(data.masks).forEach((key) => {
                if (component.layers[key]) {
                    const maskData = data.masks[key].mask;
                    const mask = {};
                    Object.keys(maskData).forEach((maskKey) => {
                        mask[decodeURI(maskKey)] = maskData[maskKey];
                    });
                    component.layers[key].mask = mask;
                }
            });
        }
    }

    onAnimationUpdate(dt) {
        const components = this.store;

        for (const id in components) {
            if (components.hasOwnProperty(id)) {
                const component = components[id].entity.anim;
                const componentData = component.data;

                if (componentData.enabled && component.entity.enabled && component.playing) {
                    component.update(dt);
                }
            }
        }
    }

    cloneComponent(entity, clone) {
        let masks;
        // If the component animaites from the components entity, any layer mask hierarchy should be updated from the old entity to the cloned entity.
        if (!entity.anim.rootBone || entity.anim.rootBone === entity) {
            masks = {};
            entity.anim.layers.forEach((layer, i) => {
                if (layer.mask) {
                    const mask = {};
                    Object.keys(layer.mask).forEach((path) => {
                        // The base of all mask paths should be mapped from the previous entity to the cloned entity
                        const pathArr = path.split('/');
                        pathArr.shift();
                        const clonePath = [clone.name, ...pathArr].join('/');
                        mask[clonePath] = layer.mask[path];
                    });
                    masks[i] = { mask };
                }
            });
        }
        const data = {
            stateGraphAsset: entity.anim.stateGraphAsset,
            animationAssets: entity.anim.animationAssets,
            speed: entity.anim.speed,
            activate: entity.anim.activate,
            playing: entity.anim.playing,
            rootBone: entity.anim.rootBone,
            stateGraph: entity.anim.stateGraph,
            layers: entity.anim.layers,
            layerIndices: entity.anim.layerIndices,
            parameters: entity.anim.parameters,
            normalizeWeights: entity.anim.normalizeWeights,
            masks
        };
        return this.addComponent(clone, data);
    }

    onBeforeRemove(entity, component) {
        component.onBeforeRemove();
    }

    destroy() {
        super.destroy();

        this.app.systems.off('animationUpdate', this.onAnimationUpdate, this);
    }
}

Component._buildAccessors(AnimComponent.prototype, _schema);

export { AnimComponentSystem };
