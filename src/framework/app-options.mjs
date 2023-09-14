class AppOptions {
    /**
     * Input handler for {@link ElementComponent}s.
     *
     * @type {import('./input/element-input.mjs').ElementInput}
     */
    elementInput;

    /**
     * Keyboard handler for input.
     *
     * @type {import('../platform/input/keyboard.mjs').Keyboard}
     */
    keyboard;

    /**
     * Mouse handler for input.
     *
     * @type {import('../platform/input/mouse.mjs').Mouse}
     */
    mouse;

    /**
     * TouchDevice handler for input.
     *
     * @type {import('../platform/input/touch-device.mjs').TouchDevice}
     */
    touch;

    /**
     * Gamepad handler for input.
     *
     * @type {import('../platform/input/game-pads.mjs').GamePads}
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
     * @type {import('../platform/sound/manager.mjs').SoundManager}
     */
    soundManager;

    /**
     * The graphics device.
     *
     * @type {import('../platform/graphics/graphics-device.mjs').GraphicsDevice}
     */
    graphicsDevice;

    /**
     * The lightmapper.
     *
     * @type {import('./lightmapper/lightmapper.mjs').Lightmapper}
     */
    lightmapper;

    /**
     * The BatchManager.
     *
     * @type {import('../scene/batching/batch-manager.mjs').BatchManager}
     */
    batchManager;

    /**
     * The XrManager.
     *
     * @type {import('./xr/xr-manager.mjs').XrManager}
     */
    xr;

    /**
     * The component systems the app requires.
     *
     * @type {import('./components/system.mjs').ComponentSystem[]}
     */
    componentSystems = [];

    /**
     * The resource handlers the app requires.
     *
     * @type {import('./handlers/handler.mjs').ResourceHandler[]}
     */
    resourceHandlers = [];
}

export { AppOptions };
