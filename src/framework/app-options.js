class AppOptions {
    /**
     * Input handler for {@link ElementComponent}s.
     *
     * @type {import('./input/element-input.js').ElementInput}
     */
    elementInput;

    /**
     * Keyboard handler for input.
     *
     * @type {import('../platform/input/keyboard.js').Keyboard}
     */
    keyboard;

    /**
     * Mouse handler for input.
     *
     * @type {import('../platform/input/mouse.js').Mouse}
     */
    mouse;

    /**
     * TouchDevice handler for input.
     *
     * @type {import('../platform/input/touch-device.js').TouchDevice}
     */
    touch;

    /**
     * Gamepad handler for input.
     *
     * @type {import('../platform/input/game-pads.js').GamePads}
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
     * @type {import('../platform/sound/manager.js').SoundManager}
     */
    soundManager;

    /**
     * The graphics device.
     *
     * @type {import('../platform/graphics/graphics-device.js').GraphicsDevice}
     */
    graphicsDevice;

    /**
     * The lightmapper.
     *
     * @type {import('./lightmapper/lightmapper.js').Lightmapper}
     */
    lightmapper;

    /**
     * The BatchManager.
     *
     * @type {import('../scene/batching/batch-manager.js').BatchManager}
     */
    batchManager;

    /**
     * The XrManager.
     *
     * @type {import('./xr/xr-manager.js').XrManager}
     */
    xr;

    /**
     * The component systems the app requires.
     *
     * @type {typeof import('./components/system.js').ComponentSystem[]}
     */
    componentSystems = [];

    /**
     * The resource handlers the app requires.
     *
     * @type {import('./handlers/handler.js').ResourceHandler[]}
     */
    resourceHandlers = [];
}

export { AppOptions };
