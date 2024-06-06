import { EventHandler } from '../../core/event-handler.js';

/**
 * Store, access and delete instances of the various ComponentSystems.
 */
class ComponentSystemRegistry extends EventHandler {
    /**
     * Gets the {@link AnimComponentSystem} from the registry.
     *
     * @type {import('./anim/system.js').AnimComponentSystem|undefined}
     * @readonly
     */
    anim;

    /**
     * Gets the {@link AnimationComponentSystem} from the registry.
     *
     * @type {import('./animation/system.js').AnimationComponentSystem|undefined}
     * @readonly
     */
    animation;

    /**
     * Gets the {@link AudioListenerComponentSystem} from the registry.
     *
     * @type {import('./audio-listener/system.js').AudioListenerComponentSystem|undefined}
     * @readonly
     */
    audiolistener;

    /**
     * Gets the {@link ButtonComponentSystem} from the registry.
     *
     * @type {import('./button/system.js').ButtonComponentSystem|undefined}
     * @readonly
     */
    button;

    /**
     * Gets the {@link CameraComponentSystem} from the registry.
     *
     * @type {import('./camera/system.js').CameraComponentSystem|undefined}
     * @readonly
     */
    camera;

    /**
     * Gets the {@link CollisionComponentSystem} from the registry.
     *
     * @type {import('./collision/system.js').CollisionComponentSystem|undefined}
     * @readonly
     */
    collision;

    /**
     * Gets the {@link ElementComponentSystem} from the registry.
     *
     * @type {import('./element/system.js').ElementComponentSystem|undefined}
     * @readonly
     */
    element;

    /**
     * Gets the {@link JointComponentSystem} from the registry.
     *
     * @type {import('./joint/system.js').JointComponentSystem|undefined}
     * @readonly
     * @ignore
     */
    joint;

    /**
     * Gets the {@link LayoutChildComponentSystem} from the registry.
     *
     * @type {import('./layout-child/system.js').LayoutChildComponentSystem|undefined}
     * @readonly
     */
    layoutchild;

    /**
     * Gets the {@link LayoutGroupComponentSystem} from the registry.
     *
     * @type {import('./layout-group/system.js').LayoutGroupComponentSystem|undefined}
     * @readonly
     */
    layoutgroup;

    /**
     * Gets the {@link LightComponentSystem} from the registry.
     *
     * @type {import('./light/system.js').LightComponentSystem|undefined}
     * @readonly
     */
    light;

    /**
     * Gets the {@link ModelComponentSystem} from the registry.
     *
     * @type {import('./model/system.js').ModelComponentSystem|undefined}
     * @readonly
     */
    model;

    /**
     * Gets the {@link ParticleSystemComponentSystem} from the registry.
     *
     * @type {import('./particle-system/system.js').ParticleSystemComponentSystem|undefined}
     * @readonly
     */
    particlesystem;

    /**
     * Gets the {@link RenderComponentSystem} from the registry.
     *
     * @type {import('./render/system.js').RenderComponentSystem|undefined}
     * @readonly
     */
    render;

    /**
     * Gets the {@link RigidBodyComponentSystem} from the registry.
     *
     * @type {import('./rigid-body/system.js').RigidBodyComponentSystem|undefined}
     * @readonly
     */
    rigidbody;

    /**
     * Gets the {@link ScreenComponentSystem} from the registry.
     *
     * @type {import('./screen/system.js').ScreenComponentSystem|undefined}
     * @readonly
     */
    screen;

    /**
     * Gets the {@link ScriptComponentSystem} from the registry.
     *
     * @type {import('./script/system.js').ScriptComponentSystem|undefined}
     * @readonly
     */
    script;

    /**
     * Gets the {@link ScrollbarComponentSystem} from the registry.
     *
     * @type {import('./scrollbar/system.js').ScrollbarComponentSystem|undefined}
     * @readonly
     */
    scrollbar;

    /**
     * Gets the {@link ScrollViewComponentSystem} from the registry.
     *
     * @type {import('./scroll-view/system.js').ScrollViewComponentSystem|undefined}
     * @readonly
     */
    scrollview;

    /**
     * Gets the {@link SoundComponentSystem} from the registry.
     *
     * @type {import('./sound/system.js').SoundComponentSystem|undefined}
     * @readonly
     */
    sound;

    /**
     * Gets the {@link SpriteComponentSystem} from the registry.
     *
     * @type {import('./sprite/system.js').SpriteComponentSystem|undefined}
     * @readonly
     */
    sprite;

    /**
     * Gets the {@link ZoneComponentSystem} from the registry.
     *
     * @type {import('./zone/system.js').ZoneComponentSystem|undefined}
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
