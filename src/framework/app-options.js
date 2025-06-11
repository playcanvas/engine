/**
 * @import { BatchManager } from '../scene/batching/batch-manager.js'
 * @import { ComponentSystem } from './components/system.js'
 * @import { ElementInput } from './input/element-input.js'
 * @import { GamePads } from '../platform/input/game-pads.js'
 * @import { GraphicsDevice } from '../platform/graphics/graphics-device.js'
 * @import { Keyboard } from '../platform/input/keyboard.js'
 * @import { Lightmapper } from './lightmapper/lightmapper.js'
 * @import { Mouse } from '../platform/input/mouse.js'
 * @import { ResourceHandler } from './handlers/handler.js'
 * @import { SoundManager } from '../platform/sound/manager.js'
 * @import { TouchDevice } from '../platform/input/touch-device.js'
 * @import { XrManager } from './xr/xr-manager.js'
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
