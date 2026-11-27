/**
 * @import { BatchManager } from '../scene/batching/batch-manager.js'
 * @import { ComponentSystem } from './components/system.js'
 * @import { ElementInput } from './input/element-input.js'
 * @import { Feature } from '../scene/features/feature.js'
 * @import { GamePads } from '../platform/input/game-pads.js'
 * @import { GraphicsDevice } from '../platform/graphics/graphics-device.js'
 * @import { Keyboard } from '../platform/input/keyboard.js'
 * @import { Lightmapper } from './lightmapper/lightmapper.js'
 * @import { Mouse } from '../platform/input/mouse.js'
 * @import { PhysicsWorld } from './physics/physics-world.js'
 * @import { ResourceHandler } from './handlers/handler.js'
 * @import { SoundManager } from '../platform/sound/manager.js'
 * @import { TouchDevice } from '../platform/input/touch-device.js'
 * @import { XrManager } from './xr/xr-manager.js'
 */

/**
 * AppOptions holds configuration settings utilized in the creation of an {@link AppBase} instance.
 * It allows functionality to be included or excluded from the AppBase instance.
 *
 * @category Framework
 */
class AppOptions {
    /**
     * Input handler for {@link ElementComponent}s.
     *
     * @type {ElementInput}
     */
    elementInput;

    /**
     * Keyboard handler for input.
     *
     * @type {Keyboard}
     */
    keyboard;

    /**
     * Mouse handler for input.
     *
     * @type {Mouse}
     */
    mouse;

    /**
     * TouchDevice handler for input.
     *
     * @type {TouchDevice}
     */
    touch;

    /**
     * Gamepad handler for input.
     *
     * @type {GamePads}
     */
    gamepads;

    /**
     * Prefix to apply to script urls before loading.
     *
     * @type {string}
     */
    scriptPrefix;

    /**
     * Prefix to apply to asset urls before loading.
     *
     * @type {string}
     */
    assetPrefix;

    /**
     * Scripts in order of loading first.
     *
     * @type {string[]}
     */
    scriptsOrder;

    /**
     * The sound manager
     *
     * @type {SoundManager}
     */
    soundManager;

    /**
     * The physics backend used to simulate rigid bodies, collisions and joints, such as
     * {@link AmmoPhysicsWorld} or {@link NullPhysicsWorld}. When set, the application installs
     * it into the {@link RigidBodyComponentSystem} during {@link AppBase#init}, so
     * {@link AppOptions#componentSystems} must include {@link RigidBodyComponentSystem}. A
     * useful simulation also requires {@link CollisionComponentSystem} - rigid bodies and
     * triggers obtain their shapes from collision components - and {@link JointComponentSystem}
     * if joints are used. The rigid body system registers its contact listener with the
     * world. When omitted, an {@link AmmoPhysicsWorld} is created automatically once
     * application libraries have loaded, if the Ammo.js WasmModule is present. The application
     * takes ownership of the world and destroys it with the application.
     *
     * @type {PhysicsWorld}
     * @alpha
     */
    physicsWorld;

    /**
     * The graphics device.
     *
     * @type {GraphicsDevice}
     */
    graphicsDevice;

    /**
     * The lightmapper.
     *
     * @type {typeof Lightmapper}
     */
    lightmapper;

    /**
     * The BatchManager.
     *
     * @type {typeof BatchManager}
     */
    batchManager;

    /**
     * The XrManager.
     *
     * @type {typeof XrManager}
     */
    xr;

    /**
     * The features the app requires, such as {@link featureAnim}. A feature brings in everything
     * one piece of engine functionality needs, for example its component system and the resource
     * handlers of its assets, and features the app does not list can be dropped from its bundle by
     * tree-shaking. Features a listed feature depends on are installed with it.
     *
     * @type {Feature[]}
     * @example
     * const options = new AppOptions();
     * options.features = [featureAnim];
     */
    features = [];

    /**
     * The component systems the app requires. Component systems installed by a feature, such as
     * the {@link AnimComponentSystem} by {@link featureAnim}, are not listed here.
     *
     * @type {typeof ComponentSystem[]}
     */
    componentSystems = [];

    /**
     * The resource handlers the app requires.
     *
     * @type {typeof ResourceHandler[]}
     */
    resourceHandlers = [];

    /**
     * Whether the app announces itself to developer tools, such as the PlayCanvas Inspector
     * browser extension, so they can find and inspect it. Set to false to keep a production build
     * from announcing itself. This is an opt-out, not a protection: code running on the page can
     * still reach the app by other means. Defaults to true.
     *
     * @type {boolean}
     */
    devtools = true;
}

export { AppOptions };
