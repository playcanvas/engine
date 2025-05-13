import { createDelayedExecutionRunner } from '../../../core/delayed-execution-runner.js';
import { AnimTrack } from '../../anim/evaluator/anim-track.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { AnimComponent } from './component.js';
import { AnimComponentData } from './data.js';

/**
 * @import { AppBase } from '../../app-base.js'
 */

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
     * @param {AppBase} app - The application managing this system.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'anim';

        this.ComponentType = AnimComponent;
        this.DataType = AnimComponentData;

        this.schema = _schema;
        this.delayedExecutors = new Map();

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
                            const animationAsset = this.app.assets.get(layer._component._animationAssets[`${layer.name}:${node.name}`].asset);
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
        }
        if (data.animationAssets) {
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

    // magnopus patched: create Delayed Executor and defer updating animation frames based on lod
    createExecutor(queueSize) {
        const executor = createDelayedExecutionRunner(
            (animComponent, dt) => {
                this.updateMeshInstanceCache(animComponent);
                // The entity has been delete, remove it from the executor
                if (!animComponent.entity.parent) {
                    this.delayedExecutors.forEach((e) => {
                        e.remove(animComponent);
                    });
                    return;
                }
                // magnopus patched
                if (
                    animComponent._mi &&
                  animComponent._mi.visible &&
                  animComponent.entity.enabled &&
                  animComponent.playing
                ) {
                    animComponent.update(dt);
                }
                if (animComponent.animationFrameSkip !== queueSize - 1) {
                    executor.remove(animComponent);
                    const newExecutor = this.delayedExecutors.get(animComponent.animationFrameSkip + 1);
                    if (newExecutor) {
                        newExecutor.add(animComponent);
                    }
                }
            },
            {
                queueSize
            }
        );
        return executor;
    }

    updateMeshInstanceCache(animComponent, id) {
        const components = this.store;
        if (!animComponent._mi) {
            const renderComp = (animComponent.rootBone ?? animComponent.entity).findComponent('render');
            if (renderComp) {
                animComponent._mi = renderComp.meshInstances[0];
            } else {
                delete components[id];
            }
        }
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
                if (!animComponent) {
                    delete components[id];
                    return;
                }
                if (!animComponent.setupDelayed) {
                    let _animComponent$animat; // Magnopus patched
                    const divisor =
                  Math.round(
                      (_animComponent$animat = animComponent.animationFrameSkip) != null ? _animComponent$animat : -1
                  ) + 1;
                    if (divisor > 1) {
                        let executor = this.delayedExecutors.get(divisor);
                        if (!executor) {
                            executor = this.createExecutor(divisor);
                            this.delayedExecutors.set(divisor, executor);
                        }
                        executor.add(animComponent);
                    }
                    animComponent.update(dt);
                    animComponent.setupDelayed = true;
                }
                // magnopus patched
                if (!animComponent.animationFrameSkip) {
                    this.updateMeshInstanceCache(animComponent, id);
                    if (animComponent._mi &&
                      animComponent._mi.visible &&
                      // componentData.enabled &&
                      animComponent.entity.enabled &&
                      animComponent.playing
                    ) {
                        animComponent.update(dt);
                    }
                }
            }
        }
        this.delayedExecutors.forEach((e, divisor) => e.tick(dt * divisor));
    }

    cloneComponent(entity, clone) {
        let masks;
        // If the component animates from the components entity, any layer mask hierarchy should be
        // updated from the old entity to the cloned entity.
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
            enabled: entity.anim.enabled,
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
