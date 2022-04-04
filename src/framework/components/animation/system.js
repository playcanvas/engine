import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { AnimationComponent } from './component.js';
import { AnimationComponentData } from './data.js';

/** @typedef {import('../../app-base.js').Application} Application */

const _schema = [
    'enabled',
];

/**
 * The AnimationComponentSystem manages creating and deleting AnimationComponents.
 *
 * @augments ComponentSystem
 */
class AnimationComponentSystem extends ComponentSystem {
    /**
     * Create an AnimationComponentSystem instance.
     *
     * @param {Application} app - The application managing this system.
     */
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
        for (const property in data) {
            if (data.hasOwnProperty(property)) {
                component[property] = data[property];
            }
        }

        super.initializeComponentData(component, data, _schema);
    }

    cloneComponent(entity, clone) {
        this.addComponent(clone, {});

        clone.animation.assets = entity.animation.assets.slice();
        clone.animation.speed = entity.animation.speed;
        clone.animation.loop = entity.animation.loop;
        clone.animation.activate = entity.animation.activate;
        clone.animation.enabled = entity.animation.enabled;

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

        return clone.animation;
    }

    onBeforeRemove(entity, component) {
        component.onBeforeRemove();
    }

    onUpdate(dt) {
        const components = this.store;

        for (const id in components) {
            if (components.hasOwnProperty(id)) {
                const component = components[id];

                if (component.data.enabled && component.entity.enabled) {
                    component.entity.animation.update(dt);
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
