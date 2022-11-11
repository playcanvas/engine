import { createDelayedExecutionRunner } from '../../../core/delayed-execution-runner.js';
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
 * @augments ComponentSystem
 */
class AnimComponentSystem extends ComponentSystem {
    /**
     * Create an AnimComponentSystem instance.
     *
     * @param {import('../../app-base.js').AppBase} app - The application managing this system.
     * @hideconstructor
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
                        component.layers[i].assignAnimation(node.name, node.animTrack);
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

    createExecutor(queueSize) {
        return createDelayedExecutionRunner(
            (entry, dt) => {
                // ensure this object is in view
                if (
                    entry._mi.visible &&
                    (entry._mi.visibleThisFrame || entry._mi.visibleThisFrame === undefined) &&
                    entry.entity.enabled &&
                    entry.playing
                ) {
                    entry.update(dt);
                }
            },
            {
                queueSize
            }
        );
    }

    onAnimationUpdate(dt) {
        const components = this.store;
        if (this.delayedExecutors === undefined) {
            this.delayedExecutors = new Map();
        }
        for (const id in components) {
            if (components.hasOwnProperty(id)) {
                const entity = components[id].entity;
                const animComponent = entity.anim;
                const componentData = animComponent.data;
                // Cache the meshinstance of this object so that we may check its visibility
                if (!animComponent._mi) {
                    animComponent._mi = entity.findComponent('render').meshInstances[0];
                }
                // On the first run, check for a frame skip executor and create it if needed
                if (!animComponent.setupDelayed) {
                    const divisor = Math.round(animComponent.animationFrameSkip ?? -1) + 1;
                    if (divisor > 1) {
                        let executor = this.delayedExecutors.get(divisor);
                        if (!executor) {
                            executor = this.createExecutor(divisor);
                            this.delayedExecutors.set(divisor, executor);
                        }
                        executor.add(animComponent);
                    }
                    // always make sure we draw the first frame of the animation
                    // to ensure theres no weird flicker
                    animComponent.update(dt);
                    animComponent.setupDelayed = true;
                }
                // If theres no frameskip and this object is visible then play the animation if needed
                if (
                    !animComponent.animationFrameSkip &&
                    animComponent._mi.visible &&
                    (animComponent._mi.visibleThisFrame || animComponent._mi.visibleThisFrame === undefined) &&
                    componentData.enabled &&
                    animComponent.entity.enabled &&
                    animComponent.playing
                ) {
                    animComponent.update(dt);
                }
            }
        }
        this.delayedExecutors.forEach((e, divisor) => e.tick(dt * divisor));
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
