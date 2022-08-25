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
     * @type {ElementInput.constructor}
     */
    elementInput;

    /**
     * Keyboard handler for input.
     *
     * @type {Keyboard.constructor}
     */
    keyboard;

    /**
     * Mouse handler for input.
     *
     * @typeof {Mouse}
     */
    mouse;

    /**
     * TouchDevice handler for input.
     *
     * @typeof {TouchDevice}
     */
    touch;

    /**
     * Gamepad handler for input.
     *
     * @typeof {GamePads}
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
     * @typeof {SoundManager}
     */
    soundManager;

    /**
     * The graphics device.
     *
     * @typeof {GraphicsDevice}
     */
    graphicsDevice;

    /**
     * The lightmapper.
     *
     * @type {Lightmapper.constructor}
     */
    lightmapper;

    /**
     * The BatchManager.
     *
     * @type {BatchManager.constructor}
     */
    batchManager;

    /**
     * The XrManager.
     *
     * @typeof {XrManager}
     */
    xr;

    /**
     * The component systems the app requires.
     *
     * @typeof {ComponentSystem.constructor[]}
     */
    componentSystems = [];

    /**
     * The resource handlers the app requires.
     *
     * @typeof {ResourceHandler.constructor[]}
     */
    resourceHandlers = [];
}

export { AppOptions };
