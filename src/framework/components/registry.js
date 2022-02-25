import { EventHandler } from '../../core/event-handler.js';

/** @typedef {import('./anim/system.js').AnimComponentSystem} AnimComponentSystem */
/** @typedef {import('./animation/system.js').AnimationComponentSystem} AnimationComponentSystem */
/** @typedef {import('./audio-listener/system.js').AudioListenerComponentSystem} AudioListenerComponentSystem */
/** @typedef {import('./audio-source/system.js').AudioSourceComponentSystem} AudioSourceComponentSystem */
/** @typedef {import('./button/system.js').ButtonComponentSystem} ButtonComponentSystem */
/** @typedef {import('./camera/system.js').CameraComponentSystem} CameraComponentSystem */
/** @typedef {import('./collision/system.js').CollisionComponentSystem} CollisionComponentSystem */
/** @typedef {import('./element/system.js').ElementComponentSystem} ElementComponentSystem */
/** @typedef {import('./joint/system.js').JointComponentSystem} JointComponentSystem */
/** @typedef {import('./layout-child/system.js').LayoutChildComponentSystem} LayoutChildComponentSystem */
/** @typedef {import('./layout-group/system.js').LayoutGroupComponentSystem} LayoutGroupComponentSystem */
/** @typedef {import('./light/system.js').LightComponentSystem} LightComponentSystem */
/** @typedef {import('./model/system.js').ModelComponentSystem} ModelComponentSystem */
/** @typedef {import('./particle-system/system.js').ParticleSystemComponentSystem} ParticleSystemComponentSystem */
/** @typedef {import('./render/system.js').RenderComponentSystem} RenderComponentSystem */
/** @typedef {import('./rigid-body/system.js').RigidBodyComponentSystem} RigidBodyComponentSystem */
/** @typedef {import('./screen/system.js').ScreenComponentSystem} ScreenComponentSystem */
/** @typedef {import('./script/system.js').ScriptComponentSystem} ScriptComponentSystem */
/** @typedef {import('./scrollbar/system.js').ScrollbarComponentSystem} ScrollbarComponentSystem */
/** @typedef {import('./scroll-view/system.js').ScrollViewComponentSystem} ScrollViewComponentSystem */
/** @typedef {import('./sound/system.js').SoundComponentSystem} SoundComponentSystem */
/** @typedef {import('./sprite/system.js').SpriteComponentSystem} SpriteComponentSystem */
/** @typedef {import('./zone/system.js').ZoneComponentSystem} ZoneComponentSystem */

/**
 * Store, access and delete instances of the various ComponentSystems.
 */
class ComponentSystemRegistry extends EventHandler {
    /**
     * Gets the {@link AnimComponentSystem} from the registry.
     *
     * @type {AnimComponentSystem}
     * @readonly
     */
    anim;

    /**
     * Gets the {@link AnimationComponentSystem} from the registry.
     *
     * @type {AnimationComponentSystem}
     * @readonly
     */
    animation;

    /**
     * Gets the {@link AudioListenerComponentSystem} from the registry.
     *
     * @type {AudioListenerComponentSystem}
     * @readonly
     */
    audiolistener;

    /**
     * Gets the {@link AudioSourceComponentSystem} from the registry.
     *
     * @type {AudioSourceComponentSystem}
     * @readonly
     * @ignore
     */
    audiosource;

    /**
     * Gets the {@link ButtonComponentSystem} from the registry.
     *
     * @type {ButtonComponentSystem}
     * @readonly
     */
    button;

    /**
     * Gets the {@link CameraComponentSystem} from the registry.
     *
     * @type {CameraComponentSystem}
     * @readonly
     */
    camera;

    /**
     * Gets the {@link CollisionComponentSystem} from the registry.
     *
     * @type {CollisionComponentSystem}
     * @readonly
     */
    collision;

    /**
     * Gets the {@link ElementComponentSystem} from the registry.
     *
     * @type {ElementComponentSystem}
     * @readonly
     */
    element;

    /**
     * Gets the {@link JointComponentSystem} from the registry.
     *
     * @type {JointComponentSystem}
     * @readonly
     * @ignore
     */
    joint;

    /**
     * Gets the {@link LayoutChildComponentSystem} from the registry.
     *
     * @type {LayoutChildComponentSystem}
     * @readonly
     */
    layoutchild;

    /**
     * Gets the {@link LayoutGroupComponentSystem} from the registry.
     *
     * @type {LayoutGroupComponentSystem}
     * @readonly
     */
    layoutgroup;

    /**
     * Gets the {@link LightComponentSystem} from the registry.
     *
     * @type {LightComponentSystem}
     * @readonly
     */
    light;

    /**
     * Gets the {@link ModelComponentSystem} from the registry.
     *
     * @type {ModelComponentSystem}
     * @readonly
     */
    model;

    /**
     * Gets the {@link ParticleSystemComponentSystem} from the registry.
     *
     * @type {ParticleSystemComponentSystem}
     * @readonly
     */
    particlesystem;

    /**
     * Gets the {@link RenderComponentSystem} from the registry.
     *
     * @type {RenderComponentSystem}
     * @readonly
     */
    render;

    /**
     * Gets the {@link RigidBodyComponentSystem} from the registry.
     *
     * @type {RigidBodyComponentSystem}
     * @readonly
     */
    rigidbody;

    /**
     * Gets the {@link ScreenComponentSystem} from the registry.
     *
     * @type {ScreenComponentSystem}
     * @readonly
     */
    screen;

    /**
     * Gets the {@link ScriptComponentSystem} from the registry.
     *
     * @type {ScriptComponentSystem}
     * @readonly
     */
    script;

    /**
     * Gets the {@link ScrollbarComponentSystem} from the registry.
     *
     * @type {ScrollbarComponentSystem}
     * @readonly
     */
    scrollbar;

    /**
     * Gets the {@link ScrollViewComponentSystem} from the registry.
     *
     * @type {ScrollViewComponentSystem}
     * @readonly
     */
    scrollview;

    /**
     * Gets the {@link SoundComponentSystem} from the registry.
     *
     * @type {SoundComponentSystem}
     * @readonly
     */
    sound;

    /**
     * Gets the {@link SpriteComponentSystem} from the registry.
     *
     * @type {SpriteComponentSystem}
     * @readonly
     */
    sprite;

    /**
     * Gets the {@link ZoneComponentSystem} from the registry.
     *
     * @type {ZoneComponentSystem}
     * @readonly
     * @ignore
     */
    zone;

     /**
      * Create a new ComponentSystemRegistry instance.
      */
    constructor() {
        super();

        // An array of pc.ComponentSystem objects
        this.list = [];
    }

    /**
     * Add a component system to the registry.
     *
     * @param {object} system - The {@link ComponentSystem} instance.
     * @ignore
     */
    add(system) {
        const id = system.id;
        if (this[id]) {
            throw new Error(`ComponentSystem name '${id}' already registered or not allowed`);
        }

        this[id] = system;

        // Update the component system array
        this.list.push(system);
    }

    /**
     * Remove a component system from the registry.
     *
     * @param {object} system - The {@link ComponentSystem} instance.
     * @ignore
     */
    remove(system) {
        const id = system.id;
        if (!this[id]) {
            throw new Error(`No ComponentSystem named '${id}' registered`);
        }

        delete this[id];

        // Update the component system array
        const index = this.list.indexOf(this[id]);
        if (index !== -1) {
            this.list.splice(index, 1);
        }
    }

    destroy() {
        this.off();

        for (let i = 0; i < this.list.length; i++) {
            this.list[i].destroy();
        }
    }
}

export { ComponentSystemRegistry };
