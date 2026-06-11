import { ComponentSystem } from '../system.js';
import { AnimationComponent } from './component.js';

/**
 * @import { AppBase } from '../../app-base.js'
 * @import { Entity } from '../../entity.js'
 */

// properties need to be set in a specific order due to some setters in the component
// having extra logic. `assets` needs to be last as it checks other properties
// to see if it should play the animation
const _properties = ['activate', 'enabled', 'loop', 'speed', 'assets'];

/**
 * The AnimationComponentSystem manages creating and deleting AnimationComponents.
 *
 * @category Animation
 */
class AnimationComponentSystem extends ComponentSystem {
    /**
     * Create an AnimationComponentSystem instance.
     *
     * @param {AppBase} app - The application managing this system.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'animation';

        this.ComponentType = AnimationComponent;

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
     * @ignore
     */
    initializeComponentData(component, data) {
        for (const property of _properties) {
            if (data.hasOwnProperty(property)) {
                component[property] = data[property];
            }
        }

        super.initializeComponentData(component, data);
    }

    /**
     * Create a clone of component. This creates a copy of all component data variables.
     *
     * @param {Entity} entity - The entity to clone the component from.
     * @param {Entity} clone - The entity to clone the component into.
     * @returns {AnimationComponent} The newly cloned component.
     * @ignore
     */
    cloneComponent(entity, clone) {
        const c = entity.animation;

        const data = {};

        for (const property of _properties) {
            // copy the assets array so the clone does not share it with the source
            data[property] = property === 'assets' ? c.assets.slice() : c[property];
        }

        const component = this.addComponent(clone, data);

        const clonedAnimations = {};
        const animations = c.animations;
        for (const key in animations) {
            if (animations.hasOwnProperty(key)) {
                clonedAnimations[key] = animations[key];
            }
        }
        component.animations = clonedAnimations;

        const clonedAnimationsIndex = {};
        const animationsIndex = c.animationsIndex;
        for (const key in animationsIndex) {
            if (animationsIndex.hasOwnProperty(key)) {
                clonedAnimationsIndex[key] = animationsIndex[key];
            }
        }
        component.animationsIndex = clonedAnimationsIndex;

        return component;
    }

    /**
     * @param {Entity} entity - The entity having its component removed.
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
                const { entity } = components[id];

                if (entity.animation.enabled && entity.enabled) {
                    entity.animation.update(dt);
                }
            }
        }
    }

    destroy() {
        super.destroy();

        this.app.systems.off('update', this.onUpdate, this);
    }
}

export { AnimationComponentSystem };
