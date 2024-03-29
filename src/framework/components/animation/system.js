import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { AnimationComponent } from './component.js';
import { AnimationComponentData } from './data.js';

const _schema = [
    'enabled'
];

/**
 * The AnimationComponentSystem manages creating and deleting AnimationComponents.
 *
 * @category Animation
 */
class AnimationComponentSystem extends ComponentSystem {
    /**
     * Create an AnimationComponentSystem instance.
     *
     * @param {import('../../app-base.js').AppBase} app - The application managing this system.
     * @ignore
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

    /**
     * Called during {@link ComponentSystem#addComponent} to initialize the component data in the
     * store. This can be overridden by derived Component Systems and either called by the derived
     * System or replaced entirely.
     *
     * @param {AnimationComponent} component - The component being initialized.
     * @param {object} data - The data block used to initialize the component.
     * @param {Array<string | {name: string, type: string}>} properties - The array of property descriptors for the component.
     * A descriptor can be either a plain property name, or an object specifying the name and type.
     * @ignore
     */
    initializeComponentData(component, data, properties) {
        // properties need to be set in a specific order due to some setters in the component
        // having extra logic. `assets` need to be last as it checks other properties
        // to see if it should play the animation
        properties = ['activate', 'enabled', 'loop', 'speed', 'assets'];
        for (const property of properties) {
            if (data.hasOwnProperty(property)) {
                component[property] = data[property];
            }
        }

        super.initializeComponentData(component, data, _schema);
    }

    /**
     * Create a clone of component. This creates a copy of all component data variables.
     *
     * @param {import('../../entity.js').Entity} entity - The entity to clone the component from.
     * @param {import('../../entity.js').Entity} clone - The entity to clone the component into.
     * @returns {AnimationComponent} The newly cloned component.
     * @ignore
     */
    cloneComponent(entity, clone) {
        this.addComponent(clone, {});

        clone.animation.assets = entity.animation.assets.slice();
        clone.animation.speed = entity.animation.speed;
        clone.animation.loop = entity.animation.loop;
        clone.animation.activate = entity.animation.activate;
        clone.animation.enabled = entity.animation.enabled;

        const clonedAnimations = {};
        const animations = entity.animation.animations;
        for (const key in animations) {
            if (animations.hasOwnProperty(key)) {
                clonedAnimations[key] = animations[key];
            }
        }
        clone.animation.animations = clonedAnimations;

        const clonedAnimationsIndex = {};
        const animationsIndex = entity.animation.animationsIndex;
        for (const key in animationsIndex) {
            if (animationsIndex.hasOwnProperty(key)) {
                clonedAnimationsIndex[key] = animationsIndex[key];
            }
        }
        clone.animation.animationsIndex = clonedAnimationsIndex;

        return clone.animation;
    }

    /**
     * @param {import('../../entity.js').Entity} entity - The entity having its component removed.
     * @param {AnimationComponent} component - The component being removed.
     * @private
     */
    onBeforeRemove(entity, component) {
        component.onBeforeRemove();
    }

    /**
     * @param {number} dt - The time delta since the last frame.
     * @private
     */
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
