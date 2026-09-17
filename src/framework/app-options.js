/**
 * @import { Asset } from './asset/asset.js'
 * @import { BatchManager } from '../scene/batching/batch-manager.js'
 * @import { ComponentSystem } from './components/system.js'
 * @import { ElementInput } from './input/element-input.js'
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
 * @callback AppUrlResolver
 * @param {{ load: string, original: string }} url - The current load/original URL pair.
 * @param {object} options - Context for the resolution.
 * @param {Asset} [options.asset] - The asset being loaded.
 * @param {string} [options.baseUrl] - The original URL used as the base for relative paths.
 * @param {ResourceHandler} [options.handler] - The resource handler requesting the URL.
 * @returns {string|{load?: string, original?: string}|undefined|null} The rewritten URL, or an
 * object containing updated load and/or original URLs.
 */

/**
 * AppOptions holds configuration settings utilized in the creation of an {@link AppBase} instance.
 * It allows functionality to be included or excluded from the AppBase instance.
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
     * // magnopus patched
     * Callback used to resolve logical asset URLs to their final load URLs.
     *
     * @type {AppUrlResolver}
     */
    urlResolver;

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
     * if joints are used. The rigid body system registers itself as the world's contact
     * listener. When omitted, an {@link AmmoPhysicsWorld} is created automatically once
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
     * The component systems the app requires.
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
}

export { AppOptions };
