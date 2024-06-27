// #if _DEBUG
import { version, revision } from '../core/core.js';
// #endif
import { platform } from '../core/platform.js';
import { now } from '../core/time.js';
import { path } from '../core/path.js';
import { TRACEID_RENDER_FRAME, TRACEID_RENDER_FRAME_TIME } from '../core/constants.js';
import { Debug } from '../core/debug.js';
import { EventHandler } from '../core/event-handler.js';
import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { math } from '../core/math/math.js';
import { Quat } from '../core/math/quat.js';
import { Vec3 } from '../core/math/vec3.js';

import {
    PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, CULLFACE_NONE
} from '../platform/graphics/constants.js';
import { DebugGraphics } from '../platform/graphics/debug-graphics.js';
import { http } from '../platform/net/http.js';

import {
    LAYERID_DEPTH, LAYERID_IMMEDIATE, LAYERID_SKYBOX, LAYERID_UI, LAYERID_WORLD,
    SORTMODE_NONE, SORTMODE_MANUAL
} from '../scene/constants.js';
import { setProgramLibrary } from '../scene/shader-lib/get-program-library.js';
import { ProgramLibrary } from '../scene/shader-lib/program-library.js';
import { ForwardRenderer } from '../scene/renderer/forward-renderer.js';
import { FrameGraph } from '../scene/frame-graph.js';
import { AreaLightLuts } from '../scene/area-light-luts.js';
import { Layer } from '../scene/layer.js';
import { LayerComposition } from '../scene/composition/layer-composition.js';
import { Scene } from '../scene/scene.js';
import { Material } from '../scene/materials/material.js';
import { StandardMaterial } from '../scene/materials/standard-material.js';
import { setDefaultMaterial } from '../scene/materials/default-material.js';

import { Asset } from './asset/asset.js';
import { AssetRegistry } from './asset/asset-registry.js';
import { BundleRegistry } from './bundle/bundle-registry.js';
import { ComponentSystemRegistry } from './components/registry.js';
import { BundleHandler } from './handlers/bundle.js';
import { ResourceLoader } from './handlers/loader.js';
import { I18n } from './i18n/i18n.js';
import { ScriptRegistry } from './script/script-registry.js';
import { Entity } from './entity.js';
import { SceneRegistry } from './scene-registry.js';
import { script } from './script.js';
import { ApplicationStats } from './stats.js';

import {
    FILLMODE_FILL_WINDOW, FILLMODE_KEEP_ASPECT,
    RESOLUTION_AUTO, RESOLUTION_FIXED
} from './constants.js';

import {
    getApplication,
    setApplication
} from './globals.js';

// Mini-object used to measure progress of loading sets
class Progress {
    constructor(length) {
        this.length = length;
        this.count = 0;
    }

    inc() {
        this.count++;
    }

    done() {
        return (this.count === this.length);
    }
}

/**
 * Gets the current application, if any.
 *
 * @type {AppBase|null}
 * @ignore
 */
let app = null;

/**
 * An Application represents and manages your PlayCanvas application. If you are developing using
 * the PlayCanvas Editor, the Application is created for you. You can access your Application
 * instance in your scripts. Below is a skeleton script which shows how you can access the
 * application 'app' property inside the initialize and update functions:
 *
 * ```javascript
 * // Editor example: accessing the pc.Application from a script
 * var MyScript = pc.createScript('myScript');
 *
 * MyScript.prototype.initialize = function() {
 *     // Every script instance has a property 'this.app' accessible in the initialize...
 *     const app = this.app;
 * };
 *
 * MyScript.prototype.update = function(dt) {
 *     // ...and update functions.
 *     const app = this.app;
 * };
 * ```
 *
 * If you are using the Engine without the Editor, you have to create the application instance
 * manually.
 */
class AppBase extends EventHandler {
    /**
     * Callback used by {@link AppBase#configure} when configuration file is loaded and parsed (or
     * an error occurs).
     *
     * @callback ConfigureAppCallback
     * @param {string|null} err - The error message in the case where the loading or parsing fails.
     * @returns {void}
     */

    /**
     * Callback used by {@link AppBase#preload} when all assets (marked as 'preload') are loaded.
     *
     * @callback PreloadAppCallback
     * @returns {void}
     */

    /**
     * Callback used by {@link AppBase#start} and itself to request
     * the rendering of a new animation frame.
     *
     * @callback MakeTickCallback
     * @param {number} [timestamp] - The timestamp supplied by requestAnimationFrame.
     * @param {XRFrame} [frame] - XRFrame from requestAnimationFrame callback.
     * @returns {void}
     */

    /**
     * A request id returned by requestAnimationFrame, allowing us to cancel it.
     *
     * @ignore
     */
    frameRequestId;

    /**
     * Create a new AppBase instance.
     *
     * @param {HTMLCanvasElement} canvas - The canvas element.
     * @example
     * // Engine-only example: create the application manually
     * const options = new AppOptions();
     * const app = new pc.AppBase(canvas);
     * app.init(options);
     *
     * // Start the application's main loop
     * app.start();
     */
    constructor(canvas) {
        super();

        // #if _DEBUG
        if (version?.indexOf('$') < 0) {
            Debug.log(`Powered by PlayCanvas ${version} ${revision}`);
        }
        // #endif

        // Store application instance
        AppBase._applications[canvas.id] = this;
        setApplication(this);

        app = this;

        /** @private */
        this._destroyRequested = false;

        /** @private */
        this._inFrameUpdate = false;

        /** @private */
        this._time = 0;

        /**
         * Scales the global time delta. Defaults to 1.
         *
         * @type {number}
         * @example
         * // Set the app to run at half speed
         * this.app.timeScale = 0.5;
         */
        this.timeScale = 1;

        /**
         * Clamps per-frame delta time to an upper bound. Useful since returning from a tab
         * deactivation can generate huge values for dt, which can adversely affect game state.
         * Defaults to 0.1 (seconds).
         *
         * @type {number}
         * @example
         * // Don't clamp inter-frame times of 200ms or less
         * this.app.maxDeltaTime = 0.2;
         */
        this.maxDeltaTime = 0.1; // Maximum delta is 0.1s or 10 fps.

        /**
         * The total number of frames the application has updated since start() was called.
         *
         * @type {number}
         * @ignore
         */
        this.frame = 0;

        /**
         * When true, the application's render function is called every frame. Setting autoRender
         * to false is useful to applications where the rendered image may often be unchanged over
         * time. This can heavily reduce the application's load on the CPU and GPU. Defaults to
         * true.
         *
         * @type {boolean}
         * @example
         * // Disable rendering every frame and only render on a keydown event
         * this.app.autoRender = false;
         * this.app.keyboard.on('keydown', function (event) {
         *     this.app.renderNextFrame = true;
         * }, this);
         */
        this.autoRender = true;

        /**
         * Set to true to render the scene on the next iteration of the main loop. This only has an
         * effect if {@link AppBase#autoRender} is set to false. The value of renderNextFrame
         * is set back to false again as soon as the scene has been rendered.
         *
         * @type {boolean}
         * @example
         * // Render the scene only while space key is pressed
         * if (this.app.keyboard.isPressed(pc.KEY_SPACE)) {
         *     this.app.renderNextFrame = true;
         * }
         */
        this.renderNextFrame = false;

        this._librariesLoaded = false;
        this._fillMode = FILLMODE_KEEP_ASPECT;
        this._resolutionMode = RESOLUTION_FIXED;
        this._allowResize = true;
    }

    /**
     * Initialize the app.
     *
     * @param {import('./app-options.js').AppOptions} appOptions - Options specifying the init
     * parameters for the app.
     */
    init(appOptions) {
        const device = appOptions.graphicsDevice;

        Debug.assert(device, "The application cannot be created without a valid GraphicsDevice");

        /**
         * The graphics device used by the application.
         *
         * @type {import('../platform/graphics/graphics-device.js').GraphicsDevice}
         */
        this.graphicsDevice = device;

        this._initDefaultMaterial();
        this._initProgramLibrary();
        this.stats = new ApplicationStats(device);

        /**
         * @type {import('../platform/sound/manager.js').SoundManager}
         * @private
         */
        this._soundManager = appOptions.soundManager;

        /**
         * The resource loader.
         *
         * @type {ResourceLoader}
         */
        this.loader = new ResourceLoader(this);

        /**
         * Stores all entities that have been created for this app by guid.
         *
         * @type {Object<string, Entity>}
         * @ignore
         */
        this._entityIndex = {};

        /**
         * The scene managed by the application.
         *
         * @type {Scene}
         * @example
         * // Set the tone mapping property of the application's scene
         * this.app.scene.rendering.toneMapping = pc.TONEMAP_FILMIC;
         */
        this.scene = new Scene(device);
        this._registerSceneImmediate(this.scene);

        /**
         * The root entity of the application.
         *
         * @type {Entity}
         * @example
         * // Return the first entity called 'Camera' in a depth-first search of the scene hierarchy
         * const camera = this.app.root.findByName('Camera');
         */
        this.root = new Entity();
        this.root._enabledInHierarchy = true;

        /**
         * The asset registry managed by the application.
         *
         * @type {AssetRegistry}
         * @example
         * // Search the asset registry for all assets with the tag 'vehicle'
         * const vehicleAssets = this.app.assets.findByTag('vehicle');
         */
        this.assets = new AssetRegistry(this.loader);
        if (appOptions.assetPrefix) this.assets.prefix = appOptions.assetPrefix;

        /**
         * @type {BundleRegistry}
         * @ignore
         */
        this.bundles = new BundleRegistry(this.assets);

        /**
         * Set this to false if you want to run without using bundles. We set it to true only if
         * TextDecoder is available because we currently rely on it for untarring.
         *
         * @type {boolean}
         * @ignore
         */
        this.enableBundles = (typeof TextDecoder !== 'undefined');

        this.scriptsOrder = appOptions.scriptsOrder || [];

        /**
         * The application's script registry.
         *
         * @type {ScriptRegistry}
         */
        this.scripts = new ScriptRegistry(this);

        /**
         * Handles localization.
         *
         * @type {I18n}
         */
        this.i18n = new I18n(this);

        /**
         * The scene registry managed by the application.
         *
         * @type {SceneRegistry}
         * @example
         * // Search the scene registry for a item with the name 'racetrack1'
         * const sceneItem = this.app.scenes.find('racetrack1');
         *
         * // Load the scene using the item's url
         * this.app.scenes.loadScene(sceneItem.url);
         */
        this.scenes = new SceneRegistry(this);

        this.defaultLayerWorld = new Layer({ name: "World", id: LAYERID_WORLD });
        this.defaultLayerDepth = new Layer({ name: "Depth", id: LAYERID_DEPTH, enabled: false, opaqueSortMode: SORTMODE_NONE });
        this.defaultLayerSkybox = new Layer({ name: "Skybox", id: LAYERID_SKYBOX, opaqueSortMode: SORTMODE_NONE });
        this.defaultLayerUi = new Layer({ name: "UI", id: LAYERID_UI, transparentSortMode: SORTMODE_MANUAL });
        this.defaultLayerImmediate = new Layer({ name: "Immediate", id: LAYERID_IMMEDIATE, opaqueSortMode: SORTMODE_NONE });

        const defaultLayerComposition = new LayerComposition("default");
        defaultLayerComposition.pushOpaque(this.defaultLayerWorld);
        defaultLayerComposition.pushOpaque(this.defaultLayerDepth);
        defaultLayerComposition.pushOpaque(this.defaultLayerSkybox);
        defaultLayerComposition.pushTransparent(this.defaultLayerWorld);
        defaultLayerComposition.pushOpaque(this.defaultLayerImmediate);
        defaultLayerComposition.pushTransparent(this.defaultLayerImmediate);
        defaultLayerComposition.pushTransparent(this.defaultLayerUi);
        this.scene.layers = defaultLayerComposition;

        // placeholder texture for area light LUTs
        AreaLightLuts.createPlaceholder(device);

        /**
         * The forward renderer.
         *
         * @type {ForwardRenderer}
         * @ignore
         */
        this.renderer = new ForwardRenderer(device);
        this.renderer.scene = this.scene;

        /**
         * The frame graph.
         *
         * @type {FrameGraph}
         * @ignore
         */
        this.frameGraph = new FrameGraph();

        /**
         * The run-time lightmapper.
         *
         * @type {import('./lightmapper/lightmapper.js').Lightmapper}
         */
        this.lightmapper = null;
        if (appOptions.lightmapper) {
            this.lightmapper = new appOptions.lightmapper(device, this.root, this.scene, this.renderer, this.assets);
            this.once('prerender', this._firstBake, this);
        }

        /**
         * The application's batch manager.
         *
         * @type {import('../scene/batching/batch-manager.js').BatchManager}
         * @private
         */
        this._batcher = null;
        if (appOptions.batchManager) {
            this._batcher = new appOptions.batchManager(device, this.root, this.scene);
            this.once('prerender', this._firstBatch, this);
        }

        /**
         * The keyboard device.
         *
         * @type {import('../platform/input/keyboard.js').Keyboard}
         */
        this.keyboard = appOptions.keyboard || null;

        /**
         * The mouse device.
         *
         * @type {import('../platform/input/mouse.js').Mouse}
         */
        this.mouse = appOptions.mouse || null;

        /**
         * Used to get touch events input.
         *
         * @type {import('../platform/input/touch-device.js').TouchDevice}
         */
        this.touch = appOptions.touch || null;

        /**
         * Used to access GamePad input.
         *
         * @type {import('../platform/input/game-pads.js').GamePads}
         */
        this.gamepads = appOptions.gamepads || null;

        /**
         * Used to handle input for {@link ElementComponent}s.
         *
         * @type {import('./input/element-input.js').ElementInput}
         */
        this.elementInput = appOptions.elementInput || null;
        if (this.elementInput)
            this.elementInput.app = this;

        /**
         * The XR Manager that provides ability to start VR/AR sessions.
         *
         * @type {import('./xr/xr-manager.js').XrManager}
         * @example
         * // check if VR is available
         * if (app.xr.isAvailable(pc.XRTYPE_VR)) {
         *     // VR is available
         * }
         */
        this.xr = appOptions.xr ? new appOptions.xr(this) : null;

        if (this.elementInput)
            this.elementInput.attachSelectEvents();

        /**
         * @type {boolean}
         * @ignore
         */
        this._inTools = false;

        /**
         * @type {Asset|null}
         * @private
         */
        this._skyboxAsset = null;

        /**
         * @type {string}
         * @ignore
         */
        this._scriptPrefix = appOptions.scriptPrefix || '';

        if (this.enableBundles) {
            this.loader.addHandler("bundle", new BundleHandler(this));
        }

        // create and register all required resource handlers
        appOptions.resourceHandlers.forEach((resourceHandler) => {
            const handler = new resourceHandler(this);
            this.loader.addHandler(handler.handlerType, handler);
        });

        /**
         * The application's component system registry. The Application constructor adds the
         * following component systems to its component system registry:
         *
         * - anim ({@link AnimComponentSystem})
         * - animation ({@link AnimationComponentSystem})
         * - audiolistener ({@link AudioListenerComponentSystem})
         * - button ({@link ButtonComponentSystem})
         * - camera ({@link CameraComponentSystem})
         * - collision ({@link CollisionComponentSystem})
         * - element ({@link ElementComponentSystem})
         * - layoutchild ({@link LayoutChildComponentSystem})
         * - layoutgroup ({@link LayoutGroupComponentSystem})
         * - light ({@link LightComponentSystem})
         * - model ({@link ModelComponentSystem})
         * - particlesystem ({@link ParticleSystemComponentSystem})
         * - rigidbody ({@link RigidBodyComponentSystem})
         * - render ({@link RenderComponentSystem})
         * - screen ({@link ScreenComponentSystem})
         * - script ({@link ScriptComponentSystem})
         * - scrollbar ({@link ScrollbarComponentSystem})
         * - scrollview ({@link ScrollViewComponentSystem})
         * - sound ({@link SoundComponentSystem})
         * - sprite ({@link SpriteComponentSystem})
         *
         * @type {ComponentSystemRegistry}
         * @example
         * // Set global gravity to zero
         * this.app.systems.rigidbody.gravity.set(0, 0, 0);
         * @example
         * // Set the global sound volume to 50%
         * this.app.systems.sound.volume = 0.5;
         */
        this.systems = new ComponentSystemRegistry();

        // create and register all required component systems
        appOptions.componentSystems.forEach((componentSystem) => {
            this.systems.add(new componentSystem(this));
        });

        /** @private */
        this._visibilityChangeHandler = this.onVisibilityChange.bind(this);

        // Depending on browser add the correct visibilitychange event and store the name of the
        // hidden attribute in this._hiddenAttr.
        if (typeof document !== 'undefined') {
            if (document.hidden !== undefined) {
                this._hiddenAttr = 'hidden';
                document.addEventListener('visibilitychange', this._visibilityChangeHandler, false);
            } else if (document.mozHidden !== undefined) {
                this._hiddenAttr = 'mozHidden';
                document.addEventListener('mozvisibilitychange', this._visibilityChangeHandler, false);
            } else if (document.msHidden !== undefined) {
                this._hiddenAttr = 'msHidden';
                document.addEventListener('msvisibilitychange', this._visibilityChangeHandler, false);
            } else if (document.webkitHidden !== undefined) {
                this._hiddenAttr = 'webkitHidden';
                document.addEventListener('webkitvisibilitychange', this._visibilityChangeHandler, false);
            }
        }

        // bind tick function to current scope
        /* eslint-disable-next-line no-use-before-define */
        this.tick = makeTick(this); // Circular linting issue as makeTick and Application reference each other
    }

    static _applications = {};

    /**
     * Get the current application. In the case where there are multiple running applications, the
     * function can get an application based on a supplied canvas id. This function is particularly
     * useful when the current Application is not readily available. For example, in the JavaScript
     * console of the browser's developer tools.
     *
     * @param {string} [id] - If defined, the returned application should use the canvas which has
     * this id. Otherwise current application will be returned.
     * @returns {AppBase|undefined} The running application, if any.
     * @example
     * const app = pc.AppBase.getApplication();
     */
    static getApplication(id) {
        return id ? AppBase._applications[id] : getApplication();
    }

    /** @private */
    _initDefaultMaterial() {
        const material = new StandardMaterial();
        material.name = "Default Material";
        setDefaultMaterial(this.graphicsDevice, material);
    }

    /** @private */
    _initProgramLibrary() {
        const library = new ProgramLibrary(this.graphicsDevice, new StandardMaterial());
        setProgramLibrary(this.graphicsDevice, library);
    }

    /**
     * @type {import('../platform/sound/manager.js').SoundManager}
     * @ignore
     */
    get soundManager() {
        return this._soundManager;
    }

    /**
     * The application's batch manager. The batch manager is used to merge mesh instances in
     * the scene, which reduces the overall number of draw calls, thereby boosting performance.
     *
     * @type {import('../scene/batching/batch-manager.js').BatchManager}
     */
    get batcher() {
        Debug.assert(this._batcher, "BatchManager has not been created and is required for correct functionality.");
        return this._batcher;
    }

    /**
     * The current fill mode of the canvas. Can be:
     *
     * - {@link FILLMODE_NONE}: the canvas will always match the size provided.
     * - {@link FILLMODE_FILL_WINDOW}: the canvas will simply fill the window, changing aspect ratio.
     * - {@link FILLMODE_KEEP_ASPECT}: the canvas will grow to fill the window as best it can while
     * maintaining the aspect ratio.
     *
     * @type {string}
     */
    get fillMode() {
        return this._fillMode;
    }

    /**
     * The current resolution mode of the canvas, Can be:
     *
     * - {@link RESOLUTION_AUTO}: if width and height are not provided, canvas will be resized to
     * match canvas client size.
     * - {@link RESOLUTION_FIXED}: resolution of canvas will be fixed.
     *
     * @type {string}
     */
    get resolutionMode() {
        return this._resolutionMode;
    }

    /**
     * Load the application configuration file and apply application properties and fill the asset
     * registry.
     *
     * @param {string} url - The URL of the configuration file to load.
     * @param {ConfigureAppCallback} callback - The Function called when the configuration file is
     * loaded and parsed (or an error occurs).
     */
    configure(url, callback) {
        http.get(url, (err, response) => {
            if (err) {
                callback(err);
                return;
            }

            const props = response.application_properties;
            const scenes = response.scenes;
            const assets = response.assets;

            this._parseApplicationProperties(props, (err) => {
                this._parseScenes(scenes);
                this._parseAssets(assets);
                if (!err) {
                    callback(null);
                } else {
                    callback(err);
                }
            });
        });
    }

    /**
     * Load all assets in the asset registry that are marked as 'preload'.
     *
     * @param {PreloadAppCallback} callback - Function called when all assets are loaded.
     */
    preload(callback) {
        this.fire("preload:start");

        // get list of assets to preload
        const assets = this.assets.list({
            preload: true
        });

        const progress = new Progress(assets.length);

        let _done = false;

        // check if all loading is done
        const done = () => {
            // do not proceed if application destroyed
            if (!this.graphicsDevice) {
                return;
            }

            if (!_done && progress.done()) {
                _done = true;
                this.fire("preload:end");
                callback();
            }
        };

        // totals loading progress of assets
        const total = assets.length;

        if (progress.length) {
            const onAssetLoad = (asset) => {
                progress.inc();
                this.fire('preload:progress', progress.count / total);

                if (progress.done())
                    done();
            };

            const onAssetError = (err, asset) => {
                progress.inc();
                this.fire('preload:progress', progress.count / total);

                if (progress.done())
                    done();
            };

            // for each asset
            for (let i = 0; i < assets.length; i++) {
                if (!assets[i].loaded) {
                    assets[i].once('load', onAssetLoad);
                    assets[i].once('error', onAssetError);

                    this.assets.load(assets[i]);
                } else {
                    progress.inc();
                    this.fire("preload:progress", progress.count / total);

                    if (progress.done())
                        done();
                }
            }
        } else {
            done();
        }
    }

    _preloadScripts(sceneData, callback) {
        callback();
    }

    // set application properties from data file
    _parseApplicationProperties(props, callback) {
        // configure retrying assets
        if (typeof props.maxAssetRetries === 'number' && props.maxAssetRetries > 0) {
            this.loader.enableRetry(props.maxAssetRetries);
        }

        // TODO: remove this temporary block after migrating properties
        if (!props.useDevicePixelRatio)
            props.useDevicePixelRatio = props.use_device_pixel_ratio;
        if (!props.resolutionMode)
            props.resolutionMode = props.resolution_mode;
        if (!props.fillMode)
            props.fillMode = props.fill_mode;

        this._width = props.width;
        this._height = props.height;
        if (props.useDevicePixelRatio) {
            this.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
        }

        this.setCanvasResolution(props.resolutionMode, this._width, this._height);
        this.setCanvasFillMode(props.fillMode, this._width, this._height);

        // set up layers
        if (props.layers && props.layerOrder) {
            const composition = new LayerComposition("application");

            const layers = {};
            for (const key in props.layers) {
                const data = props.layers[key];
                data.id = parseInt(key, 10);
                // depth layer should only be enabled when needed
                // by incrementing its ref counter
                data.enabled = data.id !== LAYERID_DEPTH;
                layers[key] = new Layer(data);
            }

            for (let i = 0, len = props.layerOrder.length; i < len; i++) {
                const sublayer = props.layerOrder[i];
                const layer = layers[sublayer.layer];
                if (!layer) continue;

                if (sublayer.transparent) {
                    composition.pushTransparent(layer);
                } else {
                    composition.pushOpaque(layer);
                }

                composition.subLayerEnabled[i] = sublayer.enabled;
            }

            this.scene.layers = composition;
        }

        // add batch groups
        if (props.batchGroups) {
            const batcher = this.batcher;
            if (batcher) {
                for (let i = 0, len = props.batchGroups.length; i < len; i++) {
                    const grp = props.batchGroups[i];
                    batcher.addGroup(grp.name, grp.dynamic, grp.maxAabbSize, grp.id, grp.layers);
                }
            }
        }

        // set localization assets
        if (props.i18nAssets) {
            this.i18n.assets = props.i18nAssets;
        }

        this._loadLibraries(props.libraries, callback);
    }

    /**
     * @param {string[]} urls - List of URLs to load.
     * @param {Function} callback - Callback function.
     * @private
     */
    _loadLibraries(urls, callback) {
        const len = urls.length;
        let count = len;

        const regex = /^http(s)?:\/\//;

        if (len) {
            const onLoad = (err, script) => {
                count--;
                if (err) {
                    callback(err);
                } else if (count === 0) {
                    this.onLibrariesLoaded();
                    callback(null);
                }
            };

            for (let i = 0; i < len; ++i) {
                let url = urls[i];

                if (!regex.test(url.toLowerCase()) && this._scriptPrefix)
                    url = path.join(this._scriptPrefix, url);

                this.loader.load(url, 'script', onLoad);
            }
        } else {
            this.onLibrariesLoaded();
            callback(null);
        }
    }

    /**
     * Insert scene name/urls into the registry.
     *
     * @param {*} scenes - Scenes to add to the scene registry.
     * @private
     */
    _parseScenes(scenes) {
        if (!scenes) return;

        for (let i = 0; i < scenes.length; i++) {
            this.scenes.add(scenes[i].name, scenes[i].url);
        }
    }

    /**
     * Insert assets into registry.
     *
     * @param {*} assets - Assets to insert.
     * @private
     */
    _parseAssets(assets) {
        const list = [];

        const scriptsIndex = {};
        const bundlesIndex = {};

        // add scripts in order of loading first
        for (let i = 0; i < this.scriptsOrder.length; i++) {
            const id = this.scriptsOrder[i];
            if (!assets[id])
                continue;

            scriptsIndex[id] = true;
            list.push(assets[id]);
        }

        // then add bundles
        if (this.enableBundles) {
            for (const id in assets) {
                if (assets[id].type === 'bundle') {
                    bundlesIndex[id] = true;
                    list.push(assets[id]);
                }
            }
        }

        // then add rest of assets
        for (const id in assets) {
            if (scriptsIndex[id] || bundlesIndex[id])
                continue;

            list.push(assets[id]);
        }

        for (let i = 0; i < list.length; i++) {
            const data = list[i];
            const asset = new Asset(data.name, data.type, data.file, data.data);
            asset.id = parseInt(data.id, 10);
            asset.preload = data.preload ? data.preload : false;
            // if this is a script asset and has already been embedded in the page then
            // mark it as loaded
            asset.loaded = data.type === 'script' && data.data && data.data.loadingType > 0;
            // tags
            asset.tags.add(data.tags);
            // i18n
            if (data.i18n) {
                for (const locale in data.i18n) {
                    asset.addLocalizedAssetId(locale, data.i18n[locale]);
                }
            }
            // registry
            this.assets.add(asset);
        }
    }

    /**
     * @param {Scene} scene - The scene.
     * @returns {Array} - The list of scripts that are referenced by the scene.
     * @private
     */
    _getScriptReferences(scene) {
        let priorityScripts = [];
        if (scene.settings.priority_scripts) {
            priorityScripts = scene.settings.priority_scripts;
        }

        const _scripts = [];
        const _index = {};

        // first add priority scripts
        for (let i = 0; i < priorityScripts.length; i++) {
            _scripts.push(priorityScripts[i]);
            _index[priorityScripts[i]] = true;
        }

        // then iterate hierarchy to get referenced scripts
        const entities = scene.entities;
        for (const key in entities) {
            if (!entities[key].components.script) {
                continue;
            }

            const scripts = entities[key].components.script.scripts;
            for (let i = 0; i < scripts.length; i++) {
                if (_index[scripts[i].url])
                    continue;
                _scripts.push(scripts[i].url);
                _index[scripts[i].url] = true;
            }
        }

        return _scripts;
    }

    /**
     * Start the application. This function does the following:
     *
     * 1. Fires an event on the application named 'start'
     * 2. Calls initialize for all components on entities in the hierarchy
     * 3. Fires an event on the application named 'initialize'
     * 4. Calls postInitialize for all components on entities in the hierarchy
     * 5. Fires an event on the application named 'postinitialize'
     * 6. Starts executing the main loop of the application
     *
     * This function is called internally by PlayCanvas applications made in the Editor but you
     * will need to call start yourself if you are using the engine stand-alone.
     *
     * @example
     * app.start();
     */
    start() {

        Debug.call(() => {
            Debug.assert(!this._alreadyStarted, "The application can be started only one time.");
            this._alreadyStarted = true;
        });

        this.frame = 0;

        this.fire("start", {
            timestamp: now(),
            target: this
        });

        if (!this._librariesLoaded) {
            this.onLibrariesLoaded();
        }

        this.systems.fire('initialize', this.root);
        this.fire('initialize');

        this.systems.fire('postInitialize', this.root);
        this.systems.fire('postPostInitialize', this.root);
        this.fire('postinitialize');

        this.tick();
    }

    /**
     * Update all input devices managed by the application.
     *
     * @param {number} dt - The time in seconds since the last update.
     * @private
     */
    inputUpdate(dt) {
        if (this.controller) {
            this.controller.update(dt);
        }
        if (this.mouse) {
            this.mouse.update();
        }
        if (this.keyboard) {
            this.keyboard.update();
        }
        if (this.gamepads) {
            this.gamepads.update();
        }
    }

    /**
     * Update the application. This function will call the update functions and then the postUpdate
     * functions of all enabled components. It will then update the current state of all connected
     * input devices. This function is called internally in the application's main loop and does
     * not need to be called explicitly.
     *
     * @param {number} dt - The time delta in seconds since the last frame.
     */
    update(dt) {
        this.frame++;

        this.graphicsDevice.updateClientRect();

        // #if _PROFILER
        this.stats.frame.updateStart = now();
        // #endif

        this.systems.fire(this._inTools ? 'toolsUpdate' : 'update', dt);
        this.systems.fire('animationUpdate', dt);
        this.systems.fire('postUpdate', dt);

        // fire update event
        this.fire("update", dt);

        // update input devices
        this.inputUpdate(dt);

        // #if _PROFILER
        this.stats.frame.updateTime = now() - this.stats.frame.updateStart;
        // #endif
    }

    frameStart() {
        this.graphicsDevice.frameStart();
    }

    frameEnd() {
        this.graphicsDevice.frameEnd();
    }

    /**
     * Render the application's scene. More specifically, the scene's {@link LayerComposition} is
     * rendered. This function is called internally in the application's main loop and does not
     * need to be called explicitly.
     *
     * @ignore
     */
    render() {
        // #if _PROFILER
        this.stats.frame.renderStart = now();
        // #endif

        this.fire('prerender');
        this.root.syncHierarchy();

        if (this._batcher) {
            this._batcher.updateAll();
        }

        // #if _PROFILER
        ForwardRenderer._skipRenderCounter = 0;
        // #endif

        // render the scene composition
        this.renderComposition(this.scene.layers);

        this.fire('postrender');

        // #if _PROFILER
        this.stats.frame.renderTime = now() - this.stats.frame.renderStart;
        // #endif
    }

    // render a layer composition
    renderComposition(layerComposition) {
        DebugGraphics.clearGpuMarkers();

        // update composition, cull everything, assign atlas slots for clustered lighting
        this.renderer.update(layerComposition);

        this.renderer.buildFrameGraph(this.frameGraph, layerComposition);
        this.frameGraph.render(this.graphicsDevice);
    }

    /**
     * @param {number} now - The timestamp passed to the requestAnimationFrame callback.
     * @param {number} dt - The time delta in seconds since the last frame. This is subject to the
     * application's time scale and max delta values.
     * @param {number} ms - The time in milliseconds since the last frame.
     * @private
     */
    _fillFrameStatsBasic(now, dt, ms) {
        // Timing stats
        const stats = this.stats.frame;
        stats.dt = dt;
        stats.ms = ms;
        if (now > stats._timeToCountFrames) {
            stats.fps = stats._fpsAccum;
            stats._fpsAccum = 0;
            stats._timeToCountFrames = now + 1000;
        } else {
            stats._fpsAccum++;
        }

        // total draw call
        this.stats.drawCalls.total = this.graphicsDevice._drawCallsPerFrame;
        this.graphicsDevice._drawCallsPerFrame = 0;
    }

    /** @private */
    _fillFrameStats() {
        let stats = this.stats.frame;

        // Render stats
        stats.cameras = this.renderer._camerasRendered;
        stats.materials = this.renderer._materialSwitches;
        stats.shaders = this.graphicsDevice._shaderSwitchesPerFrame;
        stats.shadowMapUpdates = this.renderer._shadowMapUpdates;
        stats.shadowMapTime = this.renderer._shadowMapTime;
        stats.depthMapTime = this.renderer._depthMapTime;
        stats.forwardTime = this.renderer._forwardTime;
        const prims = this.graphicsDevice._primsPerFrame;
        stats.triangles = prims[PRIMITIVE_TRIANGLES] / 3 +
            Math.max(prims[PRIMITIVE_TRISTRIP] - 2, 0) +
            Math.max(prims[PRIMITIVE_TRIFAN] - 2, 0);
        stats.cullTime = this.renderer._cullTime;
        stats.sortTime = this.renderer._sortTime;
        stats.skinTime = this.renderer._skinTime;
        stats.morphTime = this.renderer._morphTime;
        stats.lightClusters = this.renderer._lightClusters;
        stats.lightClustersTime = this.renderer._lightClustersTime;
        stats.otherPrimitives = 0;
        for (let i = 0; i < prims.length; i++) {
            if (i < PRIMITIVE_TRIANGLES) {
                stats.otherPrimitives += prims[i];
            }
            prims[i] = 0;
        }
        this.renderer._camerasRendered = 0;
        this.renderer._materialSwitches = 0;
        this.renderer._shadowMapUpdates = 0;
        this.graphicsDevice._shaderSwitchesPerFrame = 0;
        this.renderer._cullTime = 0;
        this.renderer._layerCompositionUpdateTime = 0;
        this.renderer._lightClustersTime = 0;
        this.renderer._sortTime = 0;
        this.renderer._skinTime = 0;
        this.renderer._morphTime = 0;
        this.renderer._shadowMapTime = 0;
        this.renderer._depthMapTime = 0;
        this.renderer._forwardTime = 0;

        // Draw call stats
        stats = this.stats.drawCalls;
        stats.forward = this.renderer._forwardDrawCalls;
        stats.culled = this.renderer._numDrawCallsCulled;
        stats.depth = 0;
        stats.shadow = this.renderer._shadowDrawCalls;
        stats.skinned = this.renderer._skinDrawCalls;
        stats.immediate = 0;
        stats.instanced = 0;
        stats.removedByInstancing = 0;
        stats.misc = stats.total - (stats.forward + stats.shadow);
        this.renderer._depthDrawCalls = 0;
        this.renderer._shadowDrawCalls = 0;
        this.renderer._forwardDrawCalls = 0;
        this.renderer._numDrawCallsCulled = 0;
        this.renderer._skinDrawCalls = 0;
        this.renderer._immediateRendered = 0;
        this.renderer._instancedDrawCalls = 0;

        this.stats.misc.renderTargetCreationTime = this.graphicsDevice.renderTargetCreationTime;

        stats = this.stats.particles;
        stats.updatesPerFrame = stats._updatesPerFrame;
        stats.frameTime = stats._frameTime;
        stats._updatesPerFrame = 0;
        stats._frameTime = 0;
    }

    /**
     * Controls how the canvas fills the window and resizes when the window changes.
     *
     * @param {string} mode - The mode to use when setting the size of the canvas. Can be:
     *
     * - {@link FILLMODE_NONE}: the canvas will always match the size provided.
     * - {@link FILLMODE_FILL_WINDOW}: the canvas will simply fill the window, changing aspect ratio.
     * - {@link FILLMODE_KEEP_ASPECT}: the canvas will grow to fill the window as best it can while
     * maintaining the aspect ratio.
     *
     * @param {number} [width] - The width of the canvas (only used when mode is {@link FILLMODE_NONE}).
     * @param {number} [height] - The height of the canvas (only used when mode is {@link FILLMODE_NONE}).
     */
    setCanvasFillMode(mode, width, height) {
        this._fillMode = mode;
        this.resizeCanvas(width, height);
    }

    /**
     * Change the resolution of the canvas, and set the way it behaves when the window is resized.
     *
     * @param {string} mode - The mode to use when setting the resolution. Can be:
     *
     * - {@link RESOLUTION_AUTO}: if width and height are not provided, canvas will be resized to
     * match canvas client size.
     * - {@link RESOLUTION_FIXED}: resolution of canvas will be fixed.
     *
     * @param {number} [width] - The horizontal resolution, optional in AUTO mode, if not provided
     * canvas clientWidth is used.
     * @param {number} [height] - The vertical resolution, optional in AUTO mode, if not provided
     * canvas clientHeight is used.
     */
    setCanvasResolution(mode, width, height) {
        this._resolutionMode = mode;

        // In AUTO mode the resolution is the same as the canvas size, unless specified
        if (mode === RESOLUTION_AUTO && (width === undefined)) {
            width = this.graphicsDevice.canvas.clientWidth;
            height = this.graphicsDevice.canvas.clientHeight;
        }

        this.graphicsDevice.resizeCanvas(width, height);
    }

    /**
     * Queries the visibility of the window or tab in which the application is running.
     *
     * @returns {boolean} True if the application is not visible and false otherwise.
     */
    isHidden() {
        return document[this._hiddenAttr];
    }

    /**
     * Called when the visibility state of the current tab/window changes.
     *
     * @private
     */
    onVisibilityChange() {
        if (this.isHidden()) {
            if (this._soundManager) {
                this._soundManager.suspend();
            }
        } else {
            if (this._soundManager) {
                this._soundManager.resume();
            }
        }
    }

    /**
     * Resize the application's canvas element in line with the current fill mode.
     *
     * - In {@link FILLMODE_KEEP_ASPECT} mode, the canvas will grow to fill the window as best it
     * can while maintaining the aspect ratio.
     * - In {@link FILLMODE_FILL_WINDOW} mode, the canvas will simply fill the window, changing
     * aspect ratio.
     * - In {@link FILLMODE_NONE} mode, the canvas will always match the size provided.
     *
     * @param {number} [width] - The width of the canvas. Only used if current fill mode is {@link FILLMODE_NONE}.
     * @param {number} [height] - The height of the canvas. Only used if current fill mode is {@link FILLMODE_NONE}.
     * @returns {object} A object containing the values calculated to use as width and height.
     */
    resizeCanvas(width, height) {
        if (!this._allowResize) return undefined; // prevent resizing (e.g. if presenting in VR HMD)

        // prevent resizing when in XR session
        if (this.xr && this.xr.session)
            return undefined;

        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        if (this._fillMode === FILLMODE_KEEP_ASPECT) {
            const r = this.graphicsDevice.canvas.width / this.graphicsDevice.canvas.height;
            const winR = windowWidth / windowHeight;

            if (r > winR) {
                width = windowWidth;
                height = width / r;
            } else {
                height = windowHeight;
                width = height * r;
            }
        } else if (this._fillMode === FILLMODE_FILL_WINDOW) {
            width = windowWidth;
            height = windowHeight;
        }
        // OTHERWISE: FILLMODE_NONE use width and height that are provided

        this.graphicsDevice.canvas.style.width = width + 'px';
        this.graphicsDevice.canvas.style.height = height + 'px';

        this.updateCanvasSize();

        // return the final values calculated for width and height
        return {
            width: width,
            height: height
        };
    }

    /**
     * Updates the {@link GraphicsDevice} canvas size to match the canvas size on the document
     * page. It is recommended to call this function when the canvas size changes (e.g on window
     * resize and orientation change events) so that the canvas resolution is immediately updated.
     */
    updateCanvasSize() {
        // Don't update if we are in VR or XR
        if ((!this._allowResize) || (this.xr?.active)) {
            return;
        }

        // In AUTO mode the resolution is changed to match the canvas size
        if (this._resolutionMode === RESOLUTION_AUTO) {
            // Check if the canvas DOM has changed size
            const canvas = this.graphicsDevice.canvas;
            this.graphicsDevice.resizeCanvas(canvas.clientWidth, canvas.clientHeight);
        }
    }

    /**
     * Event handler called when all code libraries have been loaded. Code libraries are passed
     * into the constructor of the Application and the application won't start running or load
     * packs until all libraries have been loaded.
     *
     * @private
     */
    onLibrariesLoaded() {
        this._librariesLoaded = true;

        if (this.systems.rigidbody) {
            this.systems.rigidbody.onLibraryLoaded();
        }
    }

    /**
     * Apply scene settings to the current scene. Useful when your scene settings are parsed or
     * generated from a non-URL source.
     *
     * @param {object} settings - The scene settings to be applied.
     * @param {object} settings.physics - The physics settings to be applied.
     * @param {number[]} settings.physics.gravity - The world space vector representing global
     * gravity in the physics simulation. Must be a fixed size array with three number elements,
     * corresponding to each axis [ X, Y, Z ].
     * @param {object} settings.render - The rendering settings to be applied.
     * @param {number[]} settings.render.global_ambient - The color of the scene's ambient light.
     * Must be a fixed size array with three number elements, corresponding to each color channel
     * [ R, G, B ].
     * @param {string} settings.render.fog - The type of fog used by the scene. Can be:
     *
     * - {@link FOG_NONE}
     * - {@link FOG_LINEAR}
     * - {@link FOG_EXP}
     * - {@link FOG_EXP2}
     *
     * @param {number[]} settings.render.fog_color - The color of the fog (if enabled). Must be a
     * fixed size array with three number elements, corresponding to each color channel [ R, G, B ].
     * @param {number} settings.render.fog_density - The density of the fog (if enabled). This
     * property is only valid if the fog property is set to {@link FOG_EXP} or {@link FOG_EXP2}.
     * @param {number} settings.render.fog_start - The distance from the viewpoint where linear fog
     * begins. This property is only valid if the fog property is set to {@link FOG_LINEAR}.
     * @param {number} settings.render.fog_end - The distance from the viewpoint where linear fog
     * reaches its maximum. This property is only valid if the fog property is set to {@link FOG_LINEAR}.
     * @param {number} settings.render.gamma_correction - The gamma correction to apply when
     * rendering the scene. Can be:
     *
     * - {@link GAMMA_NONE}
     * - {@link GAMMA_SRGB}
     *
     * @param {number} settings.render.tonemapping - The tonemapping transform to apply when
     * writing fragments to the frame buffer. Can be:
     *
     * - {@link TONEMAP_LINEAR}
     * - {@link TONEMAP_FILMIC}
     * - {@link TONEMAP_HEJL}
     * - {@link TONEMAP_ACES}
     * - {@link TONEMAP_ACES2}
     * - {@link TONEMAP_NEUTRAL}
     *
     * @param {number} settings.render.exposure - The exposure value tweaks the overall brightness
     * of the scene.
     * @param {number|null} [settings.render.skybox] - The asset ID of the cube map texture to be
     * used as the scene's skybox. Defaults to null.
     * @param {number} settings.render.skyboxIntensity - Multiplier for skybox intensity.
     * @param {number} settings.render.skyboxLuminance - Lux (lm/m^2) value for skybox intensity when physical light units are enabled.
     * @param {number} settings.render.skyboxMip - The mip level of the skybox to be displayed.
     * Only valid for prefiltered cubemap skyboxes.
     * @param {number[]} settings.render.skyboxRotation - Rotation of skybox.
     * @param {number} settings.render.lightmapSizeMultiplier - The lightmap resolution multiplier.
     * @param {number} settings.render.lightmapMaxResolution - The maximum lightmap resolution.
     * @param {number} settings.render.lightmapMode - The lightmap baking mode. Can be:
     *
     * - {@link BAKE_COLOR}: single color lightmap
     * - {@link BAKE_COLORDIR}: single color lightmap + dominant light direction (used for bump/specular)
     *
     * @param {boolean} settings.render.ambientBake - Enable baking ambient light into lightmaps.
     * @param {number} settings.render.ambientBakeNumSamples - Number of samples to use when baking ambient light.
     * @param {number} settings.render.ambientBakeSpherePart - How much of the sphere to include when baking ambient light.
     * @param {number} settings.render.ambientBakeOcclusionBrightness - Brightness of the baked ambient occlusion.
     * @param {number} settings.render.ambientBakeOcclusionContrast - Contrast of the baked ambient occlusion.
     * @param {number} settings.render.ambientLuminance - Lux (lm/m^2) value for ambient light intensity.
     *
     * @param {boolean} settings.render.clusteredLightingEnabled - Enable clustered lighting.
     * @param {boolean} settings.render.lightingShadowsEnabled - If set to true, the clustered lighting will support shadows.
     * @param {boolean} settings.render.lightingCookiesEnabled - If set to true, the clustered lighting will support cookie textures.
     * @param {boolean} settings.render.lightingAreaLightsEnabled - If set to true, the clustered lighting will support area lights.
     * @param {number} settings.render.lightingShadowAtlasResolution - Resolution of the atlas texture storing all non-directional shadow textures.
     * @param {number} settings.render.lightingCookieAtlasResolution - Resolution of the atlas texture storing all non-directional cookie textures.
     * @param {number} settings.render.lightingMaxLightsPerCell - Maximum number of lights a cell can store.
     * @param {number} settings.render.lightingShadowType - The type of shadow filtering used by all shadows. Can be:
     *
     * - {@link SHADOW_PCF1}: PCF 1x1 sampling.
     * - {@link SHADOW_PCF3}: PCF 3x3 sampling.
     * - {@link SHADOW_PCF5}: PCF 5x5 sampling. Falls back to {@link SHADOW_PCF3} on WebGL 1.0.
     *
     * @param {Vec3} settings.render.lightingCells - Number of cells along each world space axis the space containing lights
     * is subdivided into.
     *
     * Only lights with bakeDir=true will be used for generating the dominant light direction.
     * @example
     *
     * const settings = {
     *     physics: {
     *         gravity: [0, -9.8, 0]
     *     },
     *     render: {
     *         fog_end: 1000,
     *         tonemapping: 0,
     *         skybox: null,
     *         fog_density: 0.01,
     *         gamma_correction: 1,
     *         exposure: 1,
     *         fog_start: 1,
     *         global_ambient: [0, 0, 0],
     *         skyboxIntensity: 1,
     *         skyboxRotation: [0, 0, 0],
     *         fog_color: [0, 0, 0],
     *         lightmapMode: 1,
     *         fog: 'none',
     *         lightmapMaxResolution: 2048,
     *         skyboxMip: 2,
     *         lightmapSizeMultiplier: 16
     *     }
     * };
     * app.applySceneSettings(settings);
     */
    applySceneSettings(settings) {
        let asset;

        if (this.systems.rigidbody && typeof Ammo !== 'undefined') {
            const gravity = settings.physics.gravity;
            this.systems.rigidbody.gravity.set(gravity[0], gravity[1], gravity[2]);
        }

        this.scene.applySettings(settings);

        if (settings.render.hasOwnProperty('skybox')) {
            if (settings.render.skybox) {
                asset = this.assets.get(settings.render.skybox);

                if (asset) {
                    this.setSkybox(asset);
                } else {
                    this.assets.once('add:' + settings.render.skybox, this.setSkybox, this);
                }
            } else {
                this.setSkybox(null);
            }
        }
    }

    /**
     * Sets the area light LUT tables for this app.
     *
     * @param {number[]} ltcMat1 - LUT table of type `array` to be set.
     * @param {number[]} ltcMat2 - LUT table of type `array` to be set.
     */
    setAreaLightLuts(ltcMat1, ltcMat2) {

        if (ltcMat1 && ltcMat2) {
            AreaLightLuts.set(this.graphicsDevice, ltcMat1, ltcMat2);
        } else {
            Debug.warn("setAreaLightLuts: LUTs for area light are not valid");
        }
    }

    /**
     * Sets the skybox asset to current scene, and subscribes to asset load/change events.
     *
     * @param {Asset} asset - Asset of type `skybox` to be set to, or null to remove skybox.
     */
    setSkybox(asset) {
        if (asset !== this._skyboxAsset) {
            const onSkyboxRemoved = () => {
                this.setSkybox(null);
            };

            const onSkyboxChanged = () => {
                this.scene.setSkybox(this._skyboxAsset ? this._skyboxAsset.resources : null);
            };

            // cleanup previous asset
            if (this._skyboxAsset) {
                this.assets.off('load:' + this._skyboxAsset.id, onSkyboxChanged, this);
                this.assets.off('remove:' + this._skyboxAsset.id, onSkyboxRemoved, this);
                this._skyboxAsset.off('change', onSkyboxChanged, this);
            }

            // set new asset
            this._skyboxAsset = asset;
            if (this._skyboxAsset) {
                this.assets.on('load:' + this._skyboxAsset.id, onSkyboxChanged, this);
                this.assets.once('remove:' + this._skyboxAsset.id, onSkyboxRemoved, this);
                this._skyboxAsset.on('change', onSkyboxChanged, this);

                if (this.scene.skyboxMip === 0 && !this._skyboxAsset.loadFaces) {
                    this._skyboxAsset.loadFaces = true;
                }

                this.assets.load(this._skyboxAsset);
            }

            onSkyboxChanged();
        }
    }

    /** @private */
    _firstBake() {
        this.lightmapper?.bake(null, this.scene.lightmapMode);
    }

    /** @private */
    _firstBatch() {
        this.batcher?.generate();
    }

    /**
     * Provide an opportunity to modify the timestamp supplied by requestAnimationFrame.
     *
     * @param {number} [timestamp] - The timestamp supplied by requestAnimationFrame.
     * @returns {number|undefined} The modified timestamp.
     * @ignore
     */
    _processTimestamp(timestamp) {
        return timestamp;
    }

    /**
     * Draws a single line. Line start and end coordinates are specified in world space. The line
     * will be flat-shaded with the specified color.
     *
     * @param {Vec3} start - The start world space coordinate of the line.
     * @param {Vec3} end - The end world space coordinate of the line.
     * @param {Color} [color] - The color of the line. It defaults to white if not specified.
     * @param {boolean} [depthTest] - Specifies if the line is depth tested against the depth
     * buffer. Defaults to true.
     * @param {Layer} [layer] - The layer to render the line into. Defaults to {@link LAYERID_IMMEDIATE}.
     * @example
     * // Render a 1-unit long white line
     * const start = new pc.Vec3(0, 0, 0);
     * const end = new pc.Vec3(1, 0, 0);
     * app.drawLine(start, end);
     * @example
     * // Render a 1-unit long red line which is not depth tested and renders on top of other geometry
     * const start = new pc.Vec3(0, 0, 0);
     * const end = new pc.Vec3(1, 0, 0);
     * app.drawLine(start, end, pc.Color.RED, false);
     * @example
     * // Render a 1-unit long white line into the world layer
     * const start = new pc.Vec3(0, 0, 0);
     * const end = new pc.Vec3(1, 0, 0);
     * const worldLayer = app.scene.layers.getLayerById(pc.LAYERID_WORLD);
     * app.drawLine(start, end, pc.Color.WHITE, true, worldLayer);
     */
    drawLine(start, end, color, depthTest, layer) {
        this.scene.drawLine(start, end, color, depthTest, layer);
    }

    /**
     * Renders an arbitrary number of discrete line segments. The lines are not connected by each
     * subsequent point in the array. Instead, they are individual segments specified by two
     * points. Therefore, the lengths of the supplied position and color arrays must be the same
     * and also must be a multiple of 2. The colors of the ends of each line segment will be
     * interpolated along the length of each line.
     *
     * @param {Vec3[]} positions - An array of points to draw lines between. The length of the
     * array must be a multiple of 2.
     * @param {Color[] | Color} colors - An array of colors or a single color. If an array is
     * specified, this must be the same length as the position array. The length of the array
     * must also be a multiple of 2.
     * @param {boolean} [depthTest] - Specifies if the lines are depth tested against the depth
     * buffer. Defaults to true.
     * @param {Layer} [layer] - The layer to render the lines into. Defaults to {@link LAYERID_IMMEDIATE}.
     * @example
     * // Render a single line, with unique colors for each point
     * const start = new pc.Vec3(0, 0, 0);
     * const end = new pc.Vec3(1, 0, 0);
     * app.drawLines([start, end], [pc.Color.RED, pc.Color.WHITE]);
     * @example
     * // Render 2 discrete line segments
     * const points = [
     *     // Line 1
     *     new pc.Vec3(0, 0, 0),
     *     new pc.Vec3(1, 0, 0),
     *     // Line 2
     *     new pc.Vec3(1, 1, 0),
     *     new pc.Vec3(1, 1, 1)
     * ];
     * const colors = [
     *     // Line 1
     *     pc.Color.RED,
     *     pc.Color.YELLOW,
     *     // Line 2
     *     pc.Color.CYAN,
     *     pc.Color.BLUE
     * ];
     * app.drawLines(points, colors);
     */
    drawLines(positions, colors, depthTest = true, layer = this.scene.defaultDrawLayer) {
        this.scene.drawLines(positions, colors, depthTest, layer);
    }

    /**
     * Renders an arbitrary number of discrete line segments. The lines are not connected by each
     * subsequent point in the array. Instead, they are individual segments specified by two
     * points.
     *
     * @param {number[]} positions - An array of points to draw lines between. Each point is
     * represented by 3 numbers - x, y and z coordinate.
     * @param {number[]|Color} colors - A single color for all lines, or an array of colors to color
     * the lines. If an array is specified, number of colors it stores must match the number of
     * positions provided.
     * @param {boolean} [depthTest] - Specifies if the lines are depth tested against the depth
     * buffer. Defaults to true.
     * @param {Layer} [layer] - The layer to render the lines into. Defaults to {@link LAYERID_IMMEDIATE}.
     * @example
     * // Render 2 discrete line segments
     * const points = [
     *     // Line 1
     *     0, 0, 0,
     *     1, 0, 0,
     *     // Line 2
     *     1, 1, 0,
     *     1, 1, 1
     * ];
     * const colors = [
     *     // Line 1
     *     1, 0, 0, 1,  // red
     *     0, 1, 0, 1,  // green
     *     // Line 2
     *     0, 0, 1, 1,  // blue
     *     1, 1, 1, 1   // white
     * ];
     * app.drawLineArrays(points, colors);
     */
    drawLineArrays(positions, colors, depthTest = true, layer = this.scene.defaultDrawLayer) {
        this.scene.drawLineArrays(positions, colors, depthTest, layer);
    }

    /**
     * Draws a wireframe sphere with center, radius and color.
     *
     * @param {Vec3} center - The center of the sphere.
     * @param {number} radius - The radius of the sphere.
     * @param {Color} [color] - The color of the sphere. It defaults to white if not specified.
     * @param {number} [segments] - Number of line segments used to render the circles forming the
     * sphere. Defaults to 20.
     * @param {boolean} [depthTest] - Specifies if the sphere lines are depth tested against the
     * depth buffer. Defaults to true.
     * @param {Layer} [layer] - The layer to render the sphere into. Defaults to {@link LAYERID_IMMEDIATE}.
     * @example
     * // Render a red wire sphere with radius of 1
     * const center = new pc.Vec3(0, 0, 0);
     * app.drawWireSphere(center, 1.0, pc.Color.RED);
     * @ignore
     */
    drawWireSphere(center, radius, color = Color.WHITE, segments = 20, depthTest = true, layer = this.scene.defaultDrawLayer) {
        this.scene.immediate.drawWireSphere(center, radius, color, segments, depthTest, layer);
    }

    /**
     * Draws a wireframe axis aligned box specified by min and max points and color.
     *
     * @param {Vec3} minPoint - The min corner point of the box.
     * @param {Vec3} maxPoint - The max corner point of the box.
     * @param {Color} [color] - The color of the sphere. It defaults to white if not specified.
     * @param {boolean} [depthTest] - Specifies if the sphere lines are depth tested against the
     * depth buffer. Defaults to true.
     * @param {Layer} [layer] - The layer to render the sphere into. Defaults to {@link LAYERID_IMMEDIATE}.
     * @param {Mat4} [mat] - Matrix to transform the box before rendering.
     * @example
     * // Render a red wire aligned box
     * const min = new pc.Vec3(-1, -1, -1);
     * const max = new pc.Vec3(1, 1, 1);
     * app.drawWireAlignedBox(min, max, pc.Color.RED);
     * @ignore
     */
    drawWireAlignedBox(minPoint, maxPoint, color = Color.WHITE, depthTest = true, layer = this.scene.defaultDrawLayer, mat) {
        this.scene.immediate.drawWireAlignedBox(minPoint, maxPoint, color, depthTest, layer, mat);
    }

    /**
     * Draw meshInstance at this frame
     *
     * @param {import('../scene/mesh-instance.js').MeshInstance} meshInstance - The mesh instance
     * to draw.
     * @param {Layer} [layer] - The layer to render the mesh instance into. Defaults to
     * {@link LAYERID_IMMEDIATE}.
     * @ignore
     */
    drawMeshInstance(meshInstance, layer = this.scene.defaultDrawLayer) {
        this.scene.immediate.drawMesh(null, null, null, meshInstance, layer);
    }

    /**
     * Draw mesh at this frame.
     *
     * @param {import('../scene/mesh.js').Mesh} mesh - The mesh to draw.
     * @param {Material} material - The material to use to render the mesh.
     * @param {Mat4} matrix - The matrix to use to render the mesh.
     * @param {Layer} [layer] - The layer to render the mesh into. Defaults to {@link LAYERID_IMMEDIATE}.
     * @ignore
     */
    drawMesh(mesh, material, matrix, layer = this.scene.defaultDrawLayer) {
        this.scene.immediate.drawMesh(material, matrix, mesh, null, layer);
    }

    /**
     * Draw quad of size [-0.5, 0.5] at this frame.
     *
     * @param {Mat4} matrix - The matrix to use to render the quad.
     * @param {Material} material - The material to use to render the quad.
     * @param {Layer} [layer] - The layer to render the quad into. Defaults to {@link LAYERID_IMMEDIATE}.
     * @ignore
     */
    drawQuad(matrix, material, layer = this.scene.defaultDrawLayer) {
        this.scene.immediate.drawMesh(material, matrix, this.scene.immediate.getQuadMesh(), null, layer);
    }

    /**
     * Draws a texture at [x, y] position on screen, with size [width, height]. The origin of the
     * screen is top-left [0, 0]. Coordinates and sizes are in projected space (-1 .. 1).
     *
     * @param {number} x - The x coordinate on the screen of the top left corner of the texture.
     * Should be in the range [-1, 1].
     * @param {number} y - The y coordinate on the screen of the top left corner of the texture.
     * Should be in the range [-1, 1].
     * @param {number} width - The width of the rectangle of the rendered texture. Should be in the
     * range [0, 2].
     * @param {number} height - The height of the rectangle of the rendered texture. Should be in
     * the range [0, 2].
     * @param {import('../platform/graphics/texture.js').Texture} texture - The texture to render.
     * @param {Material} material - The material used when rendering the texture.
     * @param {Layer} [layer] - The layer to render the texture into. Defaults to {@link LAYERID_IMMEDIATE}.
     * @param {boolean} [filterable] - Indicate if the texture can be sampled using filtering.
     * Passing false uses unfiltered sampling, allowing a depth texture to be sampled on WebGPU.
     * Defaults to true.
     * @ignore
     */
    drawTexture(x, y, width, height, texture, material, layer = this.scene.defaultDrawLayer, filterable = true) {

        // only WebGPU supports filterable parameter to be false, allowing a depth texture / shadow
        // map to be fetched (without filtering) and rendered
        if (filterable === false && !this.graphicsDevice.isWebGPU)
            return;

        // TODO: if this is used for anything other than debug texture display, we should optimize this to avoid allocations
        const matrix = new Mat4();
        matrix.setTRS(new Vec3(x, y, 0.0), Quat.IDENTITY, new Vec3(width, -height, 0.0));

        if (!material) {
            material = new Material();
            material.cull = CULLFACE_NONE;
            material.setParameter("colorMap", texture);
            material.shader = filterable ? this.scene.immediate.getTextureShader(texture.encoding) : this.scene.immediate.getUnfilterableTextureShader();
            material.update();
        }

        this.drawQuad(matrix, material, layer);
    }

    /**
     * Draws a depth texture at [x, y] position on screen, with size [width, height]. The origin of
     * the screen is top-left [0, 0]. Coordinates and sizes are in projected space (-1 .. 1).
     *
     * @param {number} x - The x coordinate on the screen of the top left corner of the texture.
     * Should be in the range [-1, 1].
     * @param {number} y - The y coordinate on the screen of the top left corner of the texture.
     * Should be in the range [-1, 1].
     * @param {number} width - The width of the rectangle of the rendered texture. Should be in the
     * range [0, 2].
     * @param {number} height - The height of the rectangle of the rendered texture. Should be in
     * the range [0, 2].
     * @param {Layer} [layer] - The layer to render the texture into. Defaults to {@link LAYERID_IMMEDIATE}.
     * @ignore
     */
    drawDepthTexture(x, y, width, height, layer = this.scene.defaultDrawLayer) {
        const material = new Material();
        material.cull = CULLFACE_NONE;
        material.shader = this.scene.immediate.getDepthTextureShader();
        material.update();

        this.drawTexture(x, y, width, height, null, material, layer);
    }

    /**
     * Destroys application and removes all event listeners at the end of the current engine frame
     * update. However, if called outside of the engine frame update, calling destroy() will
     * destroy the application immediately.
     *
     * @example
     * app.destroy();
     */
    destroy() {
        if (this._inFrameUpdate) {
            this._destroyRequested = true;
            return;
        }

        const canvasId = this.graphicsDevice.canvas.id;

        this.fire('destroy', this); // fire destroy event
        this.off('librariesloaded');

        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this._visibilityChangeHandler, false);
            document.removeEventListener('mozvisibilitychange', this._visibilityChangeHandler, false);
            document.removeEventListener('msvisibilitychange', this._visibilityChangeHandler, false);
            document.removeEventListener('webkitvisibilitychange', this._visibilityChangeHandler, false);
        }
        this._visibilityChangeHandler = null;

        this.root.destroy();
        this.root = null;

        if (this.mouse) {
            this.mouse.off();
            this.mouse.detach();
            this.mouse = null;
        }

        if (this.keyboard) {
            this.keyboard.off();
            this.keyboard.detach();
            this.keyboard = null;
        }

        if (this.touch) {
            this.touch.off();
            this.touch.detach();
            this.touch = null;
        }

        if (this.elementInput) {
            this.elementInput.detach();
            this.elementInput = null;
        }

        if (this.gamepads) {
            this.gamepads.destroy();
            this.gamepads = null;
        }

        if (this.controller) {
            this.controller = null;
        }

        this.systems.destroy();

        // layer composition
        if (this.scene.layers) {
            this.scene.layers.destroy();
        }

        // destroy all texture resources
        const assets = this.assets.list();
        for (let i = 0; i < assets.length; i++) {
            assets[i].unload();
            assets[i].off();
        }
        this.assets.off();


        // destroy bundle registry
        this.bundles.destroy();
        this.bundles = null;

        this.i18n.destroy();
        this.i18n = null;

        const scriptHandler = this.loader.getHandler('script');
        scriptHandler?.clearCache();

        this.loader.destroy();
        this.loader = null;

        this.scene.destroy();
        this.scene = null;

        this.systems = null;
        this.context = null;

        // script registry
        this.scripts.destroy();
        this.scripts = null;

        this.scenes.destroy();
        this.scenes = null;

        this.lightmapper?.destroy();
        this.lightmapper = null;

        if (this._batcher) {
            this._batcher.destroy();
            this._batcher = null;
        }

        this._entityIndex = {};

        this.defaultLayerDepth.onPreRenderOpaque = null;
        this.defaultLayerDepth.onPostRenderOpaque = null;
        this.defaultLayerDepth.onDisable = null;
        this.defaultLayerDepth.onEnable = null;
        this.defaultLayerDepth = null;
        this.defaultLayerWorld = null;

        this.xr?.end();
        this.xr?.destroy();

        this.renderer.destroy();
        this.renderer = null;

        this.graphicsDevice.destroy();
        this.graphicsDevice = null;

        this.tick = null;

        this.off(); // remove all events

        this._soundManager?.destroy();
        this._soundManager = null;

        script.app = null;

        AppBase._applications[canvasId] = null;

        if (getApplication() === this) {
            setApplication(null);
        }

        AppBase.cancelTick(this);
    }

    static cancelTick(app) {
        if (app.frameRequestId) {
            window.cancelAnimationFrame(app.frameRequestId);
            app.frameRequestId = undefined;
        }
    }

    /**
     * Get entity from the index by guid.
     *
     * @param {string} guid - The GUID to search for.
     * @returns {Entity} The Entity with the GUID or null.
     * @ignore
     */
    getEntityFromIndex(guid) {
        return this._entityIndex[guid];
    }

    /**
     * @param {Scene} scene - The scene.
     * @private
     */
    _registerSceneImmediate(scene) {
        this.on('postrender', scene.immediate.onPostRender, scene.immediate);
    }
}

// static data
const _frameEndData = {};

/**
 * Create tick function to be wrapped in closure.
 *
 * @param {AppBase} _app - The application.
 * @returns {MakeTickCallback} The tick function.
 * @private
 */
const makeTick = function (_app) {
    const application = _app;
    /**
     * @param {number} [timestamp] - The timestamp supplied by requestAnimationFrame.
     * @param {XRFrame} [frame] - XRFrame from requestAnimationFrame callback.
     */
    return function (timestamp, frame) {
        if (!application.graphicsDevice)
            return;

        // cancel any hanging rAF to avoid multiple rAF callbacks per frame
        if (application.frameRequestId) {
            application.xr?.session?.cancelAnimationFrame(application.frameRequestId);
            cancelAnimationFrame(application.frameRequestId);
            application.frameRequestId = null;
        }

        application._inFrameUpdate = true;

        setApplication(application);

        // have current application pointer in pc
        app = application;

        const currentTime = application._processTimestamp(timestamp) || now();
        const ms = currentTime - (application._time || currentTime);
        let dt = ms / 1000.0;
        dt = math.clamp(dt, 0, application.maxDeltaTime);
        dt *= application.timeScale;

        application._time = currentTime;

        // Submit a request to queue up a new animation frame immediately
        if (application.xr?.session) {
            application.frameRequestId = application.xr.session.requestAnimationFrame(application.tick);
        } else {
            application.frameRequestId = platform.browser ? window.requestAnimationFrame(application.tick) : null;
        }

        if (application.graphicsDevice.contextLost)
            return;

        application._fillFrameStatsBasic(currentTime, dt, ms);

        // #if _PROFILER
        application._fillFrameStats();
        // #endif

        application.fire("frameupdate", ms);

        let shouldRenderFrame = true;

        if (frame) {
            shouldRenderFrame = application.xr?.update(frame);
            application.graphicsDevice.defaultFramebuffer = frame.session.renderState.baseLayer.framebuffer;
        } else {
            application.graphicsDevice.defaultFramebuffer = null;
        }

        if (shouldRenderFrame) {

            Debug.trace(TRACEID_RENDER_FRAME, `---- Frame ${application.frame}`);
            Debug.trace(TRACEID_RENDER_FRAME_TIME, `-- UpdateStart ${now().toFixed(2)}ms`);

            application.update(dt);

            application.fire("framerender");


            if (application.autoRender || application.renderNextFrame) {

                Debug.trace(TRACEID_RENDER_FRAME_TIME, `-- RenderStart ${now().toFixed(2)}ms`);

                application.updateCanvasSize();
                application.frameStart();
                application.render();
                application.frameEnd();
                application.renderNextFrame = false;

                Debug.trace(TRACEID_RENDER_FRAME_TIME, `-- RenderEnd ${now().toFixed(2)}ms`);
            }

            // set event data
            _frameEndData.timestamp = now();
            _frameEndData.target = application;

            application.fire("frameend", _frameEndData);
        }

        application._inFrameUpdate = false;

        if (application._destroyRequested) {
            application.destroy();
        }
    };
};

export { app, AppBase };
