/** @typedef {import('../resources/handler.js').ResourceHandler} ResourceHandler */
/** @typedef {import('../graphics/graphics-device.js').GraphicsDevice} GraphicsDevice */
/** @typedef {import('../input/element-input.js').ElementInput} ElementInput */
/** @typedef {import('../input/game-pads.js').GamePads} GamePads */
/** @typedef {import('../input/keyboard.js').Keyboard} Keyboard */
/** @typedef {import('../input/mouse.js').Mouse} Mouse */
/** @typedef {import('../input/touch-device.js').TouchDevice} TouchDevice */
/** @typedef {import('../sound/manager.js').SoundManager} SoundManager */
/** @typedef {import('../scene/lightmapper/lightmapper.js').Lightmapper} Lightmapper */
/** @typedef {import('../scene/batching/batch-manager.js').BatchManager} BatchManager */
/** @typedef {import('./components/system.js').ComponentSystem} ComponentSystem */
/** @typedef {import('../xr/xr-manager.js').XrManager} XrManager */

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
     * @type {ComponentSystem[]}
     */
    componentSystems = [];

    /**
     * The resource handlers the app requires.
     *
     * @type {ResourceHandler[]}
     */
    resourceHandlers = [];
}

export { AppOptions };
