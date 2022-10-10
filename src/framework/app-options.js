/** @typedef {import('../resources/handler.js').ResourceHandler} ResourceHandler */
/** @typedef {import('../graphics/graphics-device.js').GraphicsDevice} GraphicsDevice */
/** @typedef {import('../platform/input/element-input.js').ElementInput} ElementInput */
/** @typedef {import('../platform/input/game-pads.js').GamePads} GamePads */
/** @typedef {import('../platform/input/keyboard.js').Keyboard} Keyboard */
/** @typedef {import('../platform/input/mouse.js').Mouse} Mouse */
/** @typedef {import('../platform/input/touch-device.js').TouchDevice} TouchDevice */
/** @typedef {import('../platform/sound/manager.js').SoundManager} SoundManager */
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
     * @type {Lightmapper}
     */
    lightmapper;

    /**
     * The BatchManager.
     *
     * @type {BatchManager}
     */
    batchManager;

    /**
     * The XrManager.
     *
     * @type {XrManager}
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
