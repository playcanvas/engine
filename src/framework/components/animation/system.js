import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { AnimationComponent } from './component.js';
import { AnimationComponentData } from './data.js';

var _schema = [
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
 * @name pc.AnimationComponentSystem
 * @augments pc.ComponentSystem
 * @classdesc The AnimationComponentSystem manages creating and deleting AnimationComponents.
 * @description Create an AnimationComponentSystem.
 * @param {pc.Application} app - The application managing this system.
 */
function AnimationComponentSystem(app) {
    ComponentSystem.call(this, app);

    this.id = 'animation';

    this.ComponentType = AnimationComponent;
    this.DataType = AnimationComponentData;

    this.schema = _schema;

    this.on('beforeremove', this.onBeforeRemove, this);
    this.on('update', this.onUpdate, this);

    ComponentSystem.bind('update', this.onUpdate, this);
}
AnimationComponentSystem.prototype = Object.create(ComponentSystem.prototype);
AnimationComponentSystem.prototype.constructor = AnimationComponentSystem;

Component._buildAccessors(AnimationComponent.prototype, _schema);

Object.assign(AnimationComponentSystem.prototype, {
    initializeComponentData: function (component, data, properties) {
        properties = ['activate', 'enabled', 'loop', 'speed', 'assets'];
        ComponentSystem.prototype.initializeComponentData.call(this, component, data, properties);
    },

    cloneComponent: function (entity, clone) {
        var key;
        this.addComponent(clone, {});

        clone.animation.assets = entity.animation.assets.slice();
        clone.animation.data.speed = entity.animation.speed;
        clone.animation.data.loop = entity.animation.loop;
        clone.animation.data.activate = entity.animation.activate;
        clone.animation.data.enabled = entity.animation.enabled;

        var clonedAnimations = { };
        var animations = entity.animation.animations;
        for (key in animations) {
            if (animations.hasOwnProperty(key)) {
                clonedAnimations[key] = animations[key];
            }
        }
        clone.animation.animations = clonedAnimations;

        var clonedAnimationsIndex = { };
        var animationsIndex = entity.animation.animationsIndex;
        for (key in animationsIndex) {
            if (animationsIndex.hasOwnProperty(key)) {
                clonedAnimationsIndex[key] = animationsIndex[key];
            }
        }
        clone.animation.animationsIndex = clonedAnimationsIndex;
    },

    onBeforeRemove: function (entity, component) {
        component.onBeforeRemove();
    },

    onUpdate: function (dt) {
        var components = this.store;

        for (var id in components) {
            if (components.hasOwnProperty(id)) {
                var component = components[id];
                var componentData = component.data;

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
                        var skeleton = componentData.skeleton;
                        if (skeleton !== null && componentData.model !== null) {
                            if (componentData.blending) {
                                skeleton.blend(componentData.fromSkel, componentData.toSkel, componentData.blend);
                            } else {
                                // Advance the animation, interpolating keyframes at each animated node in
                                // skeleton
                                var delta = dt * componentData.speed;
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
                    var animEvaluator = componentData.animEvaluator;
                    if (animEvaluator) {

                        // force all clip's speed and playing state from the component
                        for (var i = 0; i < animEvaluator.clips.length; ++i) {
                            var clip = animEvaluator.clips[i];
                            clip.speed = componentData.speed;
                            if (!componentData.playing) {
                                clip.pause();
                            } else {
                                clip.resume();
                            }
                        }

                        // update blend weight
                        if (componentData.blending) {
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
});

export { AnimationComponentSystem };
