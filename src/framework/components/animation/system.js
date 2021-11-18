import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { AnimationComponent } from './component.js';
import { AnimationComponentData } from './data.js';

const _schema = [
    'enabled',
    'assets',
    'speed',
    'loop',
    'activate',
    'animations',
    'skeleton',
    'model',
    'prevAnim',
    'currAnim',
    'fromSkel',
    'toSkel',
    'blending',
    'blendTimeRemaining',
    'playing'
];

/**
 * @class
 * @name AnimationComponentSystem
 * @augments ComponentSystem
 * @classdesc The AnimationComponentSystem manages creating and deleting AnimationComponents.
 * @description Create an AnimationComponentSystem.
 * @param {Application} app - The application managing this system.
 */
class AnimationComponentSystem extends ComponentSystem {
    constructor(app) {
        super(app);

        this.id = 'animation';

        this.ComponentType = AnimationComponent;
        this.DataType = AnimationComponentData;

        this.schema = _schema;

        this.on('beforeremove', this.onBeforeRemove, this);
        this.app.systems.on('update', this.onUpdate, this);
    }

    initializeComponentData(component, data, properties) {
        properties = ['activate', 'enabled', 'loop', 'speed', 'assets'];
        super.initializeComponentData(component, data, properties);
    }

    cloneComponent(entity, clone) {
        this.addComponent(clone, {});

        clone.animation.assets = entity.animation.assets.slice();
        clone.animation.data.speed = entity.animation.speed;
        clone.animation.data.loop = entity.animation.loop;
        clone.animation.data.activate = entity.animation.activate;
        clone.animation.data.enabled = entity.animation.enabled;

        const clonedAnimations = { };
        const animations = entity.animation.animations;
        for (const key in animations) {
            if (animations.hasOwnProperty(key)) {
                clonedAnimations[key] = animations[key];
            }
        }
        clone.animation.animations = clonedAnimations;

        const clonedAnimationsIndex = { };
        const animationsIndex = entity.animation.animationsIndex;
        for (const key in animationsIndex) {
            if (animationsIndex.hasOwnProperty(key)) {
                clonedAnimationsIndex[key] = animationsIndex[key];
            }
        }
        clone.animation.animationsIndex = clonedAnimationsIndex;
    }

    onBeforeRemove(entity, component) {
        component.onBeforeRemove();
    }

    onUpdate(dt) {
        const components = this.store;

        for (const id in components) {
            if (components.hasOwnProperty(id)) {
                const component = components[id];
                const componentData = component.data;

                if (componentData.enabled && component.entity.enabled) {

                    // update blending
                    if (componentData.blending) {
                        componentData.blend += dt * componentData.blendSpeed;
                        if (componentData.blend >= 1.0) {
                            componentData.blend = 1.0;
                        }
                    }

                    // update skeleton
                    if (componentData.playing) {
                        const skeleton = componentData.skeleton;
                        if (skeleton !== null && componentData.model !== null) {
                            if (componentData.blending) {
                                skeleton.blend(componentData.fromSkel, componentData.toSkel, componentData.blend);
                            } else {
                                // Advance the animation, interpolating keyframes at each animated node in
                                // skeleton
                                const delta = dt * componentData.speed;
                                skeleton.addTime(delta);
                                if (componentData.speed > 0 && (skeleton._time === skeleton._animation.duration) && !componentData.loop) {
                                    componentData.playing = false;
                                } else if (componentData.speed < 0 && skeleton._time === 0 && !componentData.loop) {
                                    componentData.playing = false;
                                }
                            }

                            if (componentData.blending && (componentData.blend === 1.0)) {
                                skeleton.animation = componentData.toSkel._animation;
                            }

                            skeleton.updateGraph();
                        }
                    }

                    // update anim controller
                    const animEvaluator = componentData.animEvaluator;
                    if (animEvaluator) {

                        // force all clip's speed and playing state from the component
                        for (let i = 0; i < animEvaluator.clips.length; ++i) {
                            const clip = animEvaluator.clips[i];
                            clip.speed = componentData.speed;
                            if (!componentData.playing) {
                                clip.pause();
                            } else {
                                clip.resume();
                            }
                        }

                        // update blend weight
                        if (componentData.blending && animEvaluator.clips.length > 1) {
                            animEvaluator.clips[1].blendWeight = componentData.blend;
                        }

                        animEvaluator.update(dt);
                    }

                    // clear blending flag
                    if (componentData.blending && componentData.blend === 1.0) {
                        componentData.blending = false;
                    }
                }
            }
        }
    }

    destroy() {
        super.destroy();

        this.app.systems.off('update', this.onUpdate, this);
    }
}

Component._buildAccessors(AnimationComponent.prototype, _schema);

export { AnimationComponentSystem };
