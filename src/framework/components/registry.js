import { EventHandler } from '../../core/event-handler.js';

/**
 * @import { AnimationComponentSystem } from './animation/system.js'
 * @import { AnimComponentOptionsOverrides } from './anim/system.js'
 * @import { AnimComponentSystem } from './anim/system.js'
 * @import { AudioListenerComponentSystem } from './audio-listener/system.js'
 * @import { ButtonComponentOptionsOverrides } from './button/system.js'
 * @import { ButtonComponentSystem } from './button/system.js'
 * @import { CameraComponentOptionsOverrides } from './camera/system.js'
 * @import { CameraComponentSystem } from './camera/system.js'
 * @import { CollisionComponentOptionsOverrides } from './collision/system.js'
 * @import { CollisionComponentSystem } from './collision/system.js'
 * @import { ComponentSystem } from './system.js'
 * @import { ElementComponentOptionsOverrides } from './element/system.js'
 * @import { ElementComponentSystem } from './element/system.js'
 * @import { Entity } from '../entity.js'
 * @import { GSplatComponentOptionsOverrides } from './gsplat/system.js'
 * @import { GSplatComponentSystem } from './gsplat/system.js'
 * @import { JointComponentSystem } from './joint/system.js'
 * @import { LayoutChildComponentSystem } from './layout-child/system.js'
 * @import { LayoutGroupComponentOptionsOverrides } from './layout-group/system.js'
 * @import { LayoutGroupComponentSystem } from './layout-group/system.js'
 * @import { LightComponentOptionsOverrides } from './light/system.js'
 * @import { LightComponentSystem } from './light/system.js'
 * @import { ModelComponentOptionsOverrides } from './model/system.js'
 * @import { ModelComponentSystem } from './model/system.js'
 * @import { ParticleSystemComponentOptionsOverrides } from './particle-system/system.js'
 * @import { ParticleSystemComponentSystem } from './particle-system/system.js'
 * @import { RenderComponentOptionsOverrides } from './render/system.js'
 * @import { RenderComponentSystem } from './render/system.js'
 * @import { RigidBodyComponentOptionsOverrides } from './rigid-body/system.js'
 * @import { RigidBodyComponentSystem } from './rigid-body/system.js'
 * @import { ScreenComponentOptionsOverrides } from './screen/system.js'
 * @import { ScreenComponentSystem } from './screen/system.js'
 * @import { ScriptComponentOptionsOverrides } from './script/system.js'
 * @import { ScriptComponentSystem } from './script/system.js'
 * @import { ScrollbarComponentSystem } from './scrollbar/system.js'
 * @import { ScrollViewComponentOptionsOverrides } from './scroll-view/system.js'
 * @import { ScrollViewComponentSystem } from './scroll-view/system.js'
 * @import { SoundComponentOptionsOverrides } from './sound/system.js'
 * @import { SoundComponentSystem } from './sound/system.js'
 * @import { SpriteComponentOptionsOverrides } from './sprite/system.js'
 * @import { SpriteComponentSystem } from './sprite/system.js'
 * @import { ZoneComponentSystem } from './zone/system.js'
 */

/**
 * Options accepted by {@link Entity#addComponent} for each built-in component beyond what its
 * component class declares - option names that are not component properties (see
 * {@link ComponentSystem#extraDataProperties}), callbacks, and properties that also accept a plain
 * array or plain data. Each property replaces the same-named property of the options derived from
 * the component class; {@link ComponentOptions} applies them. Keyed by component name, like the
 * systems in this registry.
 *
 * @typedef {object} ComponentOptionsOverrides
 * @property {AnimComponentOptionsOverrides} anim - Overrides of the `anim` component.
 * @property {ButtonComponentOptionsOverrides} button - Overrides of the `button` component.
 * @property {CameraComponentOptionsOverrides} camera - Overrides of the `camera` component.
 * @property {CollisionComponentOptionsOverrides} collision - Overrides of the `collision` component.
 * @property {ElementComponentOptionsOverrides} element - Overrides of the `element` component.
 * @property {GSplatComponentOptionsOverrides} gsplat - Overrides of the `gsplat` component.
 * @property {LayoutGroupComponentOptionsOverrides} layoutgroup - Overrides of the `layoutgroup` component.
 * @property {LightComponentOptionsOverrides} light - Overrides of the `light` component.
 * @property {ModelComponentOptionsOverrides} model - Overrides of the `model` component.
 * @property {ParticleSystemComponentOptionsOverrides} particlesystem - Overrides of the `particlesystem` component.
 * @property {RenderComponentOptionsOverrides} render - Overrides of the `render` component.
 * @property {RigidBodyComponentOptionsOverrides} rigidbody - Overrides of the `rigidbody` component.
 * @property {ScreenComponentOptionsOverrides} screen - Overrides of the `screen` component.
 * @property {ScriptComponentOptionsOverrides} script - Overrides of the `script` component.
 * @property {ScrollViewComponentOptionsOverrides} scrollview - Overrides of the `scrollview` component.
 * @property {SoundComponentOptionsOverrides} sound - Overrides of the `sound` component.
 * @property {SpriteComponentOptionsOverrides} sprite - Overrides of the `sprite` component.
 * @ignore
 */

/**
 * The ComponentSystemRegistry manages the instances of an application's {@link ComponentSystem}s.
 * {@link AppBase} maintains a single instance of this class which can be accessed via
 * {@link AppBase#systems}.
 *
 * ```javascript
 * // Set the gravity to zero
 * app.systems.rigidbody.gravity = new Vec3(0, 0, 0);
 *
 * // Set the volume to 50%
 * app.systems.sound.volume = 0.5;
 * ```
 */
class ComponentSystemRegistry extends EventHandler {
    /**
     * Gets the {@link AnimComponentSystem} from the registry.
     *
     * @type {AnimComponentSystem|undefined}
     * @readonly
     */
    anim;

    /**
     * Gets the {@link AnimationComponentSystem} from the registry.
     *
     * @type {AnimationComponentSystem|undefined}
     * @readonly
     */
    animation;

    /**
     * Gets the {@link AudioListenerComponentSystem} from the registry.
     *
     * @type {AudioListenerComponentSystem|undefined}
     * @readonly
     */
    audiolistener;

    /**
     * Gets the {@link ButtonComponentSystem} from the registry.
     *
     * @type {ButtonComponentSystem|undefined}
     * @readonly
     */
    button;

    /**
     * Gets the {@link CameraComponentSystem} from the registry.
     *
     * @type {CameraComponentSystem|undefined}
     * @readonly
     */
    camera;

    /**
     * Gets the {@link CollisionComponentSystem} from the registry.
     *
     * @type {CollisionComponentSystem|undefined}
     * @readonly
     */
    collision;

    /**
     * Gets the {@link ElementComponentSystem} from the registry.
     *
     * @type {ElementComponentSystem|undefined}
     * @readonly
     */
    element;

    /**
     * Gets the {@link GSplatComponentSystem} from the registry.
     *
     * @type {GSplatComponentSystem|undefined}
     * @readonly
     */
    gsplat;

    /**
     * Gets the {@link JointComponentSystem} from the registry.
     *
     * @type {JointComponentSystem|undefined}
     * @readonly
     * @alpha
     */
    joint;

    /**
     * Gets the {@link LayoutChildComponentSystem} from the registry.
     *
     * @type {LayoutChildComponentSystem|undefined}
     * @readonly
     */
    layoutchild;

    /**
     * Gets the {@link LayoutGroupComponentSystem} from the registry.
     *
     * @type {LayoutGroupComponentSystem|undefined}
     * @readonly
     */
    layoutgroup;

    /**
     * Gets the {@link LightComponentSystem} from the registry.
     *
     * @type {LightComponentSystem|undefined}
     * @readonly
     */
    light;

    /**
     * Gets the {@link ModelComponentSystem} from the registry.
     *
     * @type {ModelComponentSystem|undefined}
     * @readonly
     */
    model;

    /**
     * Gets the {@link ParticleSystemComponentSystem} from the registry.
     *
     * @type {ParticleSystemComponentSystem|undefined}
     * @readonly
     */
    particlesystem;

    /**
     * Gets the {@link RenderComponentSystem} from the registry.
     *
     * @type {RenderComponentSystem|undefined}
     * @readonly
     */
    render;

    /**
     * Gets the {@link RigidBodyComponentSystem} from the registry.
     *
     * @type {RigidBodyComponentSystem|undefined}
     * @readonly
     */
    rigidbody;

    /**
     * Gets the {@link ScreenComponentSystem} from the registry.
     *
     * @type {ScreenComponentSystem|undefined}
     * @readonly
     */
    screen;

    /**
     * Gets the {@link ScriptComponentSystem} from the registry.
     *
     * @type {ScriptComponentSystem|undefined}
     * @readonly
     */
    script;

    /**
     * Gets the {@link ScrollbarComponentSystem} from the registry.
     *
     * @type {ScrollbarComponentSystem|undefined}
     * @readonly
     */
    scrollbar;

    /**
     * Gets the {@link ScrollViewComponentSystem} from the registry.
     *
     * @type {ScrollViewComponentSystem|undefined}
     * @readonly
     */
    scrollview;

    /**
     * Gets the {@link SoundComponentSystem} from the registry.
     *
     * @type {SoundComponentSystem|undefined}
     * @readonly
     */
    sound;

    /**
     * Gets the {@link SpriteComponentSystem} from the registry.
     *
     * @type {SpriteComponentSystem|undefined}
     * @readonly
     */
    sprite;

    /**
     * Gets the {@link ZoneComponentSystem} from the registry.
     *
     * @type {ZoneComponentSystem|undefined}
     * @readonly
     * @ignore
     */
    zone;

    /**
     * Gets an array of all {@link ComponentSystem}s in the registry.
     *
     * @type {ComponentSystem[]}
     * @readonly
     */
    list;

    /**
     * Create a new ComponentSystemRegistry instance.
     */
    constructor() {
        super();

        /**
         * @type {ComponentSystem[]}
         * @ignore
         */
        this.list = [];
    }

    /**
     * Add a component system to the registry.
     *
     * @param {ComponentSystem} system - The ComponentSystem instance.
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
     * @param {ComponentSystem} system - The ComponentSystem instance.
     * @ignore
     */
    remove(system) {
        const id = system.id;
        if (!this[id]) {
            throw new Error(`No ComponentSystem named '${id}' registered`);
        }

        // Update the component system array
        const index = this.list.indexOf(this[id]);
        if (index !== -1) {
            this.list.splice(index, 1);
        }

        delete this[id];
    }

    /**
     * Destroys all registered component systems.
     *
     * @ignore
     */
    destroy() {
        this.off();

        for (let i = 0; i < this.list.length; i++) {
            this.list[i].destroy();
        }
    }
}

export { ComponentSystemRegistry };
