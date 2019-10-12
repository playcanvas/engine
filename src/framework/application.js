Object.assign(pc, function () {
    /**
     * @constructor
     * @name pc.Application
     * @extends pc.EventHandler
     * @classdesc A pc.Application represents and manages your PlayCanvas application.
     * If you are developing using the PlayCanvas Editor, the pc.Application is created
     * for you. You can access your pc.Application instance in your scripts. Below is a
     * skeleton script which shows how you can access the application 'app' property inside
     * the initialize and update functions:
     * <pre><code class="javascript">// Editor example: accessing the pc.Application from a script
     * var MyScript = pc.createScript('myScript');
     *
     * MyScript.prototype.initialize = function() {
     *     // Every script instance has a property 'this.app' accessible in the initialize...
     *     var app = this.app;
     * }
     *
     * MyScript.prototype.update = function(dt) {
     *     // ...and update functions.
     *     var app = this.app;
     * }</code></pre>
     * If you are using the Engine without the Editor, you have to create the application
     * instance manually.
     * @description Create a new Application.
     * @param {Element} canvas The canvas element
     * @param {Object} options
     * @param {pc.ElementInput} [options.elementInput] Input handler for {@link pc.ElementComponent}s
     * @param {pc.Keyboard} [options.keyboard] Keyboard handler for input
     * @param {pc.Mouse} [options.mouse] Mouse handler for input
     * @param {pc.TouchDevice} [options.touch] TouchDevice handler for input
     * @param {pc.GamePads} [options.gamepads] Gamepad handler for input
     * @param {String} [options.scriptPrefix] Prefix to apply to script urls before loading
     * @param {String} [options.assetPrefix] Prefix to apply to asset urls before loading
     * @param {Object} [options.graphicsDeviceOptions] Options object that is passed into the {@link pc.GraphicsDevice} constructor
     * @param {String[]} [options.scriptsOrder] Scripts in order of loading first
     * @example
     * // Engine-only example: create the application manually
     * var app = new pc.Application(canvas, options);
     *
     * // Start the application's main loop
     * app.start()
     */

    // PROPERTIES

    /**
     * @name pc.Application#scene
     * @type {pc.Scene}
     * @description The scene managed by the application.
     * @example
     * // Set the tone mapping property of the application's scene
     * this.app.scene.toneMapping = pc.TONEMAP_FILMIC;
     */

    /**
     * @name pc.Application#timeScale
     * @type {Number}
     * @description Scales the global time delta. Defaults to 1.
     * @example
     * // Set the app to run at half speed
     * this.app.timeScale = 0.5;
     */

    /**
     * @name pc.Application#maxDeltaTime
     * @type {Number}
     * @description Clamps per-frame delta time to an upper bound. Useful since returning from a tab
     * deactivation can generate huge values for dt, which can adversely affect game state. Defaults
     * to 0.1 (seconds).
     * @example
     * // Don't clamp inter-frame times of 200ms or less
     * this.app.maxDeltaTime = 0.2;
     */

    /**
     * @name pc.Application#assets
     * @type {pc.AssetRegistry}
     * @description The asset registry managed by the application.
     * @example
     * // Search the asset registry for all assets with the tag 'vehicle'
     * var vehicleAssets = this.app.assets.findByTag('vehicle');
     */

    /**
     * @name pc.Application#graphicsDevice
     * @type {pc.GraphicsDevice}
     * @description The graphics device used by the application.
     */

    /**
     * @name pc.Application#systems
     * @type {pc.ComponentSystemRegistry}
     * @description The application's component system registry. The pc.Application
     * constructor adds the following component systems to its component system registry:
     * <ul>
     *     <li>animation ({@link pc.AnimationComponentSystem})</li>
     *     <li>audiolistener ({@link pc.AudioListenerComponentSystem})</li>
     *     <li>button ({@link pc.ButtonComponentSystem})</li>
     *     <li>camera ({@link pc.CameraComponentSystem})</li>
     *     <li>collision ({@link pc.CollisionComponentSystem})</li>
     *     <li>element ({@link pc.ElementComponentSystem})</li>
     *     <li>layoutchild ({@link pc.LayoutChildComponentSystem})</li>
     *     <li>layoutgroup ({@link pc.LayoutGroupComponentSystem})</li>
     *     <li>light ({@link pc.LightComponentSystem})</li>
     *     <li>model ({@link pc.ModelComponentSystem})</li>
     *     <li>particlesystem ({@link pc.ParticleSystemComponentSystem})</li>
     *     <li>rigidbody ({@link pc.RigidBodyComponentSystem})</li>
     *     <li>screen ({@link pc.ScreenComponentSystem})</li>
     *     <li>script ({@link pc.ScriptComponentSystem})</li>
     *     <li>scrollbar ({@link pc.ScrollbarComponentSystem})</li>
     *     <li>scrollview ({@link pc.ScrollViewComponentSystem})</li>
     *     <li>sound ({@link pc.SoundComponentSystem})</li>
     *     <li>sprite ({@link pc.SpriteComponentSystem})</li>
     * </ul>
     * @example
     * // Set global gravity to zero
     * this.app.systems.rigidbody.gravity.set(0, 0, 0);
     * @example
     * // Set the global sound volume to 50%
     * this.app.systems.sound.volume = 0.5;
     */

    /**
     * @name pc.Application#loader
     * @type {pc.ResourceLoader}
     * @description The resource loader.
     */

    /**
     * @name pc.Application#root
     * @type {pc.Entity}
     * @description The root entity of the application.
     * @example
     * // Return the first entity called 'Camera' in a depth-first search of the scene hierarchy
     * var camera = this.app.root.findByName('Camera');
     */

    /**
     * @name pc.Application#keyboard
     * @type {pc.Keyboard}
     * @description The keyboard device.
     */

    /**
     * @name pc.Application#mouse
     * @type {pc.Mouse}
     * @description The mouse device.
     */

    /**
     * @name pc.Application#touch
     * @type {pc.TouchDevice}
     * @description Used to get touch events input.
     */

    /**
     * @name pc.Application#gamepads
     * @type {pc.GamePads}
     * @description Used to access GamePad input.
     */

    /**
     * @name pc.Application#elementInput
     * @type {pc.ElementInput}
     * @description Used to handle input for {@link pc.ElementComponent}s.
     */

    /**
     * @name pc.Application#scripts
     * @type pc.ScriptRegistry
     * @description The application's script registry.
     */

    /**
     * @name pc.Application#batcher
     * @type pc.BatchManager
     * @description The application's batch manager. The batch manager is used to
     * merge mesh instances in the scene, which reduces the overall number of draw
     * calls, thereby boosting performance.
     */

    /**
     * @name pc.Application#autoRender
     * @type Boolean
     * @description When true, the application's render function is called every frame.
     * Setting autoRender to false is useful to applications where the rendered image
     * may often be unchanged over time. This can heavily reduce the application's
     * load on the CPU and GPU. Defaults to true.
     * @example
     * // Disable rendering every frame and only render on a keydown event
     * this.app.autoRender = false;
     * this.app.keyboard.on('keydown', function (event) {
     *     this.app.renderNextFrame = true;
     * }, this);
     */

    /**
     * @name pc.Application#renderNextFrame
     * @type Boolean
     * @description Set to true to render the scene on the next iteration of the main loop.
     * This only has an effect if {@link pc.Application#autoRender} is set to false. The
     * value of renderNextFrame is set back to false again as soon as the scene has been
     * rendered.
     * @example
     * // Render the scene only while space key is pressed
     * if (this.app.keyboard.isPressed(pc.KEY_SPACE)) {
     *    this.app.renderNextFrame = true;
     * }
     */

     /**
     * @private
     * @name pc.Application#i18n
     * @type {pc.I18n}
     * @description Handles localization
     */

    var Application = function (canvas, options) {
        pc.EventHandler.call(this);

        options = options || {};

        // Open the log
        pc.log.open();

        // Store application instance
        Application._applications[canvas.id] = this;
        Application._currentApplication = this;

        /**
         * @private
         * @static
         * @type {pc.Application|Undefined}
         * @name pc.app
         * @description Gets the current application, if any.
         */
        pc.app = this;

        this._time = 0;
        this.timeScale = 1;
        this.maxDeltaTime = 0.1; // Maximum delta is 0.1s or 10 fps.

        this.frame = 0; // the total number of frames the application has updated since start() was called

        this.autoRender = true;
        this.renderNextFrame = false;

        // enable if you want entity type script attributes
        // to not be re-mapped when an entity is cloned
        this.useLegacyScriptAttributeCloning = pc.script.legacy;

        this._librariesLoaded = false;
        this._fillMode = pc.FILLMODE_KEEP_ASPECT;
        this._resolutionMode = pc.RESOLUTION_FIXED;
        this._allowResize = true;

        // for compatibility
        this.context = this;

        this.graphicsDevice = new pc.GraphicsDevice(canvas, options.graphicsDeviceOptions);
        this.stats = new pc.ApplicationStats(this.graphicsDevice);
        this._audioManager = new pc.SoundManager(options);
        this.loader = new pc.ResourceLoader(this);

        // stores all entities that have been created
        // for this app by guid
        this._entityIndex = {};

        this.scene = new pc.Scene();
        this.root = new pc.Entity(this);
        this.root._enabledInHierarchy = true;
        this._enableList = [];
        this._enableList.size = 0;
        this.assets = new pc.AssetRegistry(this.loader);
        if (options.assetPrefix) this.assets.prefix = options.assetPrefix;
        this.bundles = new pc.BundleRegistry(this.assets);
        // set this to false if you want to run without using bundles
        // We set it to true only if TextDecoder is available because we currently
        // rely on it for untarring.
        this.enableBundles = (typeof TextDecoder !== 'undefined');
        this.scriptsOrder = options.scriptsOrder || [];
        this.scripts = new pc.ScriptRegistry(this);

        this.i18n = new pc.I18n(this);

        this._sceneRegistry = new pc.SceneRegistry(this);

        var self = this;
        this.defaultLayerWorld = new pc.Layer({
            name: "World",
            id: pc.LAYERID_WORLD
        });

        if (this.graphicsDevice.webgl2) {
            // WebGL 2 depth layer just copies existing depth
            this.defaultLayerDepth = new pc.Layer({
                enabled: false,
                name: "Depth",
                id: pc.LAYERID_DEPTH,

                onEnable: function () {
                    if (this.renderTarget) return;
                    var depthBuffer = new pc.Texture(self.graphicsDevice, {
                        format: pc.PIXELFORMAT_DEPTHSTENCIL,
                        width: self.graphicsDevice.width,
                        height: self.graphicsDevice.height
                    });
                    depthBuffer.name = 'rt-depth2';
                    depthBuffer.minFilter = pc.FILTER_NEAREST;
                    depthBuffer.magFilter = pc.FILTER_NEAREST;
                    depthBuffer.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                    depthBuffer.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                    this.renderTarget = new pc.RenderTarget({
                        colorBuffer: null,
                        depthBuffer: depthBuffer,
                        autoResolve: false
                    });
                    self.graphicsDevice.scope.resolve("uDepthMap").setValue(depthBuffer);
                },

                onDisable: function () {
                    if (!this.renderTarget) return;
                    this.renderTarget._depthBuffer.destroy();
                    this.renderTarget.destroy();
                    this.renderTarget = null;
                },

                onPreRenderOpaque: function (cameraPass) { // resize depth map if needed
                    var gl = self.graphicsDevice.gl;
                    this.srcFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);

                    if (!this.renderTarget || (this.renderTarget.width !== self.graphicsDevice.width || this.renderTarget.height !== self.graphicsDevice.height)) {
                        this.onDisable();
                        this.onEnable();
                    }

                    // disable clearing
                    this.oldClear = this.cameras[cameraPass].camera._clearOptions;
                    this.cameras[cameraPass].camera._clearOptions = this.depthClearOptions;
                },

                onPostRenderOpaque: function (cameraPass) { // copy depth
                    if (!this.renderTarget) return;

                    this.cameras[cameraPass].camera._clearOptions = this.oldClear;

                    var gl = self.graphicsDevice.gl;

                    self.graphicsDevice.setRenderTarget(this.renderTarget);
                    self.graphicsDevice.updateBegin();

                    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.srcFbo);
                    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.renderTarget._glFrameBuffer);
                    gl.blitFramebuffer( 0, 0, this.renderTarget.width, this.renderTarget.height,
                                        0, 0, this.renderTarget.width, this.renderTarget.height,
                                        gl.DEPTH_BUFFER_BIT,
                                        gl.NEAREST);
                }

            });
            this.defaultLayerDepth.depthClearOptions = {
                flags: 0
            };
        } else {
            // WebGL 1 depth layer just renders same objects as in World, but with RGBA-encoded depth shader
            this.defaultLayerDepth = new pc.Layer({
                enabled: false,
                name: "Depth",
                id: pc.LAYERID_DEPTH,
                shaderPass: pc.SHADER_DEPTH,

                onEnable: function () {
                    if (this.renderTarget) return;
                    var colorBuffer = new pc.Texture(self.graphicsDevice, {
                        format: pc.PIXELFORMAT_R8_G8_B8_A8,
                        width: self.graphicsDevice.width,
                        height: self.graphicsDevice.height
                    });
                    colorBuffer.name = 'rt-depth1';
                    colorBuffer.minFilter = pc.FILTER_NEAREST;
                    colorBuffer.magFilter = pc.FILTER_NEAREST;
                    colorBuffer.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                    colorBuffer.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                    this.renderTarget = new pc.RenderTarget(self.graphicsDevice, colorBuffer, {
                        depth: true,
                        stencil: self.graphicsDevice.supportsStencil
                    });
                    self.graphicsDevice.scope.resolve("uDepthMap").setValue(colorBuffer);
                },

                onDisable: function () {
                    if (!this.renderTarget) return;
                    this.renderTarget._colorBuffer.destroy();
                    this.renderTarget.destroy();
                    this.renderTarget = null;
                },

                onPostCull: function (cameraPass) {
                    // Collect all rendered mesh instances with the same render target as World has, depthWrite == true and prior to this layer to replicate blitFramebuffer on WebGL2
                    var visibleObjects = this.instances.visibleOpaque[cameraPass];
                    var visibleList = visibleObjects.list;
                    var visibleLength = 0;
                    var layers = self.scene.layers.layerList;
                    var subLayerEnabled = self.scene.layers.subLayerEnabled;
                    var isTransparent = self.scene.layers.subLayerList;
                    var rt = self.defaultLayerWorld.renderTarget;
                    var cam = this.cameras[cameraPass];
                    var layer;
                    var j;
                    var layerVisibleList, layerCamId, layerVisibleListLength, drawCall, transparent;
                    for (var i = 0; i < layers.length; i++) {
                        layer = layers[i];
                        if (layer === this) break;
                        if (layer.renderTarget !== rt || !layer.enabled || !subLayerEnabled[i]) continue;
                        layerCamId = layer.cameras.indexOf(cam);
                        if (layerCamId < 0) continue;
                        transparent = isTransparent[i];
                        layerVisibleList = transparent ? layer.instances.visibleTransparent[layerCamId] : layer.instances.visibleOpaque[layerCamId];
                        layerVisibleListLength = layerVisibleList.length;
                        layerVisibleList = layerVisibleList.list;
                        for (j = 0; j < layerVisibleListLength; j++) {
                            drawCall = layerVisibleList[j];
                            if (drawCall.material && drawCall.material.depthWrite && !drawCall._noDepthDrawGl1) {
                                visibleList[visibleLength] = drawCall;
                                visibleLength++;
                            }
                        }
                    }
                    visibleObjects.length = visibleLength;
                },

                onPreRenderOpaque: function (cameraPass) { // resize depth map if needed
                    if (!this.renderTarget || (this.renderTarget.width !== self.graphicsDevice.width || this.renderTarget.height !== self.graphicsDevice.height)) {
                        this.onDisable();
                        this.onEnable();
                    }
                    this.oldClear = this.cameras[cameraPass].camera._clearOptions;
                    this.cameras[cameraPass].camera._clearOptions = this.rgbaDepthClearOptions;
                },

                onDrawCall: function () {
                    self.graphicsDevice.setColorWrite(true, true, true, true);
                },

                onPostRenderOpaque: function (cameraPass) {
                    if (!this.renderTarget) return;
                    this.cameras[cameraPass].camera._clearOptions = this.oldClear;
                }

            });
            this.defaultLayerDepth.rgbaDepthClearOptions = {
                color: [254.0 / 255, 254.0 / 255, 254.0 / 255, 254.0 / 255],
                depth: 1.0,
                flags: pc.CLEARFLAG_COLOR | pc.CLEARFLAG_DEPTH
            };
        }

        this.defaultLayerSkybox = new pc.Layer({
            enabled: false,
            name: "Skybox",
            id: pc.LAYERID_SKYBOX,
            opaqueSortMode: pc.SORTMODE_NONE
        });
        this.defaultLayerUi = new pc.Layer({
            enabled: true,
            name: "UI",
            id: pc.LAYERID_UI,
            transparentSortMode: pc.SORTMODE_MANUAL,
            passThrough: false
        });
        this.defaultLayerImmediate = new pc.Layer({
            enabled: true,
            name: "Immediate",
            id: pc.LAYERID_IMMEDIATE,
            opaqueSortMode: pc.SORTMODE_NONE,
            passThrough: true
        });
        this.defaultLayerComposition = new pc.LayerComposition();

        this.defaultLayerComposition.pushOpaque(this.defaultLayerWorld);
        this.defaultLayerComposition.pushOpaque(this.defaultLayerDepth);
        this.defaultLayerComposition.pushOpaque(this.defaultLayerSkybox);
        this.defaultLayerComposition.pushTransparent(this.defaultLayerWorld);
        this.defaultLayerComposition.pushOpaque(this.defaultLayerImmediate);
        this.defaultLayerComposition.pushTransparent(this.defaultLayerImmediate);
        this.defaultLayerComposition.pushTransparent(this.defaultLayerUi);

        this.scene.layers = this.defaultLayerComposition;

        this._immediateLayer = this.defaultLayerImmediate;

        // Default layers patch
        this.scene.on('set:layers', function (oldComp, newComp) {
            var list = newComp.layerList;
            var layer;
            for (var i = 0; i < list.length; i++) {
                layer = list[i];
                switch (layer.id) {
                    case pc.LAYERID_DEPTH:
                        layer.onEnable = self.defaultLayerDepth.onEnable;
                        layer.onDisable = self.defaultLayerDepth.onDisable;
                        layer.onPreRenderOpaque = self.defaultLayerDepth.onPreRenderOpaque;
                        layer.onPostRenderOpaque = self.defaultLayerDepth.onPostRenderOpaque;
                        layer.depthClearOptions = self.defaultLayerDepth.depthClearOptions;
                        layer.rgbaDepthClearOptions = self.defaultLayerDepth.rgbaDepthClearOptions;
                        layer.shaderPass = self.defaultLayerDepth.shaderPass;
                        layer.onPostCull = self.defaultLayerDepth.onPostCull;
                        layer.onDrawCall = self.defaultLayerDepth.onDrawCall;
                        break;
                    case pc.LAYERID_UI:
                        layer.passThrough = self.defaultLayerUi.passThrough;
                        break;
                    case pc.LAYERID_IMMEDIATE:
                        layer.passThrough = self.defaultLayerImmediate.passThrough;
                        break;
                }
            }
        });

        this.renderer = new pc.ForwardRenderer(this.graphicsDevice);
        this.renderer.scene = this.scene;
        this.lightmapper = new pc.Lightmapper(this.graphicsDevice, this.root, this.scene, this.renderer, this.assets);
        this.once('prerender', this._firstBake, this);
        this.batcher = new pc.BatchManager(this.graphicsDevice, this.root, this.scene);
        this.once('prerender', this._firstBatch, this);

        this.keyboard = options.keyboard || null;
        this.mouse = options.mouse || null;
        this.touch = options.touch || null;
        this.gamepads = options.gamepads || null;
        this.elementInput = options.elementInput || null;
        if (this.elementInput)
            this.elementInput.app = this;

        this.vr = null;

        this._inTools = false;

        this._skyboxLast = 0;

        this._scriptPrefix = options.scriptPrefix || '';

        if (this.enableBundles) {
            this.loader.addHandler("bundle", new pc.BundleHandler(this.assets));
        }

        this.loader.addHandler("animation", new pc.AnimationHandler());
        this.loader.addHandler("model", new pc.ModelHandler(this.graphicsDevice, this.scene.defaultMaterial));
        this.loader.addHandler("material", new pc.MaterialHandler(this));
        this.loader.addHandler("texture", new pc.TextureHandler(this.graphicsDevice, this.assets, this.loader));
        this.loader.addHandler("text", new pc.TextHandler());
        this.loader.addHandler("json", new pc.JsonHandler());
        this.loader.addHandler("audio", new pc.AudioHandler(this._audioManager));
        this.loader.addHandler("script", new pc.ScriptHandler(this));
        this.loader.addHandler("scene", new pc.SceneHandler(this));
        this.loader.addHandler("cubemap", new pc.CubemapHandler(this.graphicsDevice, this.assets, this.loader));
        this.loader.addHandler("html", new pc.HtmlHandler());
        this.loader.addHandler("css", new pc.CssHandler());
        this.loader.addHandler("shader", new pc.ShaderHandler());
        this.loader.addHandler("hierarchy", new pc.HierarchyHandler(this));
        this.loader.addHandler("scenesettings", new pc.SceneSettingsHandler(this));
        this.loader.addHandler("folder", new pc.FolderHandler());
        this.loader.addHandler("font", new pc.FontHandler(this.loader));
        this.loader.addHandler("binary", new pc.BinaryHandler());
        this.loader.addHandler("textureatlas", new pc.TextureAtlasHandler(this.loader));
        this.loader.addHandler("sprite", new pc.SpriteHandler(this.assets, this.graphicsDevice));
        this.loader.addHandler("template", new pc.TemplateHandler(this));

        this.systems = new pc.ComponentSystemRegistry();
        this.systems.add(new pc.RigidBodyComponentSystem(this));
        this.systems.add(new pc.CollisionComponentSystem(this));
        this.systems.add(new pc.AnimationComponentSystem(this));
        this.systems.add(new pc.ModelComponentSystem(this));
        this.systems.add(new pc.CameraComponentSystem(this));
        this.systems.add(new pc.LightComponentSystem(this));
        if (pc.script.legacy) {
            this.systems.add(new pc.ScriptLegacyComponentSystem(this));
        } else {
            this.systems.add(new pc.ScriptComponentSystem(this));
        }
        this.systems.add(new pc.AudioSourceComponentSystem(this, this._audioManager));
        this.systems.add(new pc.SoundComponentSystem(this, this._audioManager));
        this.systems.add(new pc.AudioListenerComponentSystem(this, this._audioManager));
        this.systems.add(new pc.ParticleSystemComponentSystem(this));
        this.systems.add(new pc.ScreenComponentSystem(this));
        this.systems.add(new pc.ElementComponentSystem(this));
        this.systems.add(new pc.ButtonComponentSystem(this));
        this.systems.add(new pc.ScrollViewComponentSystem(this));
        this.systems.add(new pc.ScrollbarComponentSystem(this));
        this.systems.add(new pc.SpriteComponentSystem(this));
        this.systems.add(new pc.LayoutGroupComponentSystem(this));
        this.systems.add(new pc.LayoutChildComponentSystem(this));
        this.systems.add(new pc.ZoneComponentSystem(this));

        this._visibilityChangeHandler = this.onVisibilityChange.bind(this);

        // Depending on browser add the correct visibiltychange event and store the name of the hidden attribute
        // in this._hiddenAttr.
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
    };
    Application.prototype = Object.create(pc.EventHandler.prototype);
    Application.prototype.constructor = Application;

    Application._currentApplication = null;
    Application._applications = {};

    /**
     * @static
     * @function
     * @name pc.Application.getApplication
     * @description Get the current application. In the case where there are multiple running
     * applications, the function can get an application based on a supplied canvas id. This
     * function is particularly useful when the current pc.Application is not readily available.
     * For example, in the JavaScript console of the browser's developer tools.
     * @param {String} [id] If defined, the returned application should use the canvas which has this id. Otherwise current application will be returned.
     * @returns {pc.Application|Undefined} The running application, if any.
     * @example
     * var app = pc.Application.getApplication();
     */
    Application.getApplication = function (id) {
        return id ? Application._applications[id] : Application._currentApplication;
    };

    // Mini-object used to measure progress of loading sets
    var Progress = function (length) {
        this.length = length;
        this.count = 0;

        this.inc = function () {
            this.count++;
        };

        this.done = function () {
            return (this.count === this.length);
        };
    };

    Object.assign(Application.prototype, {
        /**
         * @function
         * @name pc.Application#configure
         * @description Load the application configuration file and apply application properties and fill the asset registry
         * @param {String} url The URL of the configuration file to load
         * @param {pc.callbacks.ConfigureApp} callback The Function called when the configuration file is loaded and parsed (or an error occurs).
         */
        configure: function (url, callback) {
            var self = this;
            pc.http.get(url, function (err, response) {
                if (err) {
                    callback(err);
                    return;
                }

                var props = response.application_properties;
                var scenes = response.scenes;
                var assets = response.assets;

                self._parseApplicationProperties(props, function (err) {
                    self._parseScenes(scenes);
                    self._parseAssets(assets);
                    if (!err) {
                        callback(null);
                    } else {
                        callback(err);
                    }
                });
            });
        },

        /**
         * @function
         * @name pc.Application#preload
         * @description Load all assets in the asset registry that are marked as 'preload'
         * @param {pc.callbacks.PreloadApp} callback Function called when all assets are loaded
         */
        preload: function (callback) {
            var self = this;
            var i, total;

            self.fire("preload:start");

            // get list of assets to preload
            var assets = this.assets.list({
                preload: true
            });

            var _assets = new Progress(assets.length);

            var _done = false;

            // check if all loading is done
            var done = function () {
                // do not proceed if application destroyed
                if (!self.graphicsDevice) {
                    return;
                }

                if (!_done && _assets.done()) {
                    _done = true;
                    self.fire("preload:end");
                    callback();
                }
            };

            // totals loading progress of assets
            total = assets.length;
            var count = function () {
                return _assets.count;
            };

            if (_assets.length) {
                var onAssetLoad = function (asset) {
                    _assets.inc();
                    self.fire('preload:progress', count() / total);

                    if (_assets.done())
                        done();
                };

                var onAssetError = function (err, asset) {
                    _assets.inc();
                    self.fire('preload:progress', count() / total);

                    if (_assets.done())
                        done();
                };

                // for each asset
                for (i = 0; i < assets.length; i++) {
                    if (!assets[i].loaded) {
                        assets[i].once('load', onAssetLoad);
                        assets[i].once('error', onAssetError);

                        this.assets.load(assets[i]);
                    } else {
                        _assets.inc();
                        self.fire("preload:progress", count() / total);

                        if (_assets.done())
                            done();
                    }
                }
            } else {
                done();
            }
        },

        /**
         * @function
         * @name pc.Application#getSceneUrl
         * @description Look up the URL of the scene hierarchy file via the name given to the scene in the editor. Use this to in {@link pc.Application#loadSceneHierarchy}.
         * @param {String} name The name of the scene file given in the Editor
         * @returns {String} The URL of the scene file
         */
        getSceneUrl: function (name) {
            var entry = this._sceneRegistry.find(name);
            if (entry) {
                return entry.url;
            }
            return null;

        },

        /**
         * @function
         * @name pc.Application#loadSceneHierarchy
         * @description Load a scene file, create and initialize the Entity hierarchy
         * and add the hierarchy to the application root Entity.
         * @param {String} url The URL of the scene file. Usually this will be "scene_id.json"
         * @param {pc.callbacks.LoadHierarchy} callback The function to call after loading, passed (err, entity) where err is null if no errors occurred.
         * @example
         *
         * app.loadSceneHierarchy("1000.json", function (err, entity) {
         *     if (!err) {
         *       var e = app.root.find("My New Entity");
         *     } else {
         *       // error
         *     }
         *   }
         * });
         */
        loadSceneHierarchy: function (url, callback) {
            this._sceneRegistry.loadSceneHierarchy(url, callback);
        },

        /**
         * @function
         * @name pc.Application#loadSceneSettings
         * @description Load a scene file and automatically apply the scene settings to the current scene.
         * @param {String} url The URL of the scene file. Usually this will be "scene_id.json"
         * @param {pc.callbacks.LoadSettings} callback The function called after the settings are applied. Passed (err) where err is null if no error occurred.
         * @example
         * app.loadSceneSettings("1000.json", function (err) {
         *     if (!err) {
         *       // success
         *     } else {
         *       // error
         *     }
         *   }
         * });
         */
        loadSceneSettings: function (url, callback) {
            this._sceneRegistry.loadSceneSettings(url, callback);
        },

        /**
         * @private
         * @function
         * @name pc.Application#loadScene
         * @description Load a scene file.
         * @param {String} url The URL of the scene file. Usually this will be "scene_id.json"
         * @param {pc.callbacks.LoadScene} callback The function to call after loading, passed (err, entity) where err is null if no errors occurred.
         * @example
         *
         * app.loadScene("1000.json", function (err, entity) {
         *     if (!err) {""
         *       var e = app.root.find("My New Entity");
         *     } else {
         *       // error
         *     }
         *   }
         * });
         */
        loadScene: function (url, callback) {
            this._sceneRegistry.loadScene(url, callback);
        },

        _preloadScripts: function (sceneData, callback) {
            if (!pc.script.legacy) {
                callback();
                return;
            }

            var self = this;

            self.systems.script.preloading = true;

            var scripts = this._getScriptReferences(sceneData);

            var i = 0, l = scripts.length;
            var progress = new Progress(l);
            var scriptUrl;
            var regex = /^http(s)?:\/\//;

            if (l) {
                var onLoad = function (err, ScriptType) {
                    if (err)
                        console.error(err);

                    progress.inc();
                    if (progress.done()) {
                        self.systems.script.preloading = false;
                        callback();
                    }
                };

                for (i = 0; i < l; i++) {
                    scriptUrl = scripts[i];
                    // support absolute URLs (for now)
                    if (!regex.test(scriptUrl.toLowerCase()) && self._scriptPrefix)
                        scriptUrl = pc.path.join(self._scriptPrefix, scripts[i]);

                    this.loader.load(scriptUrl, 'script', onLoad);
                }
            } else {
                self.systems.script.preloading = false;
                callback();
            }
        },

        // set application properties from data file
        _parseApplicationProperties: function (props, callback) {
            var i;
            var len;

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
                var composition = new pc.LayerComposition();

                var layers = {};
                for (var key in props.layers) {
                    var data = props.layers[key];
                    data.id = parseInt(key, 10);
                    // depth layer should only be enabled when needed
                    // by incrementing its ref counter
                    data.enabled = data.id !== pc.LAYERID_DEPTH;
                    layers[key] = new pc.Layer(data);
                }

                for (i = 0, len = props.layerOrder.length; i < len; i++) {
                    var sublayer = props.layerOrder[i];
                    var layer = layers[sublayer.layer];
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
                for (i = 0, len = props.batchGroups.length; i < len; i++) {
                    var grp = props.batchGroups[i];
                    this.batcher.addGroup(grp.name, grp.dynamic, grp.maxAabbSize, grp.id, grp.layers);
                }

            }

            // set localization assets
            if (props.i18nAssets) {
                this.i18n.assets = props.i18nAssets;
            }

            this._loadLibraries(props.libraries, callback);
        },

        _loadLibraries: function (urls, callback) {
            var len = urls.length;
            var count = len;
            var self = this;

            var regex = /^http(s)?:\/\//;

            if (len) {
                var onLoad = function (err, script) {
                    count--;
                    if (err) {
                        callback(err);
                    } else if (count === 0) {
                        self.onLibrariesLoaded();
                        callback(null);
                    }
                };

                for (var i = 0; i < len; ++i) {
                    var url = urls[i];

                    if (!regex.test(url.toLowerCase()) && self._scriptPrefix)
                        url = pc.path.join(self._scriptPrefix, url);

                    this.loader.load(url, 'script', onLoad);
                }
            } else {
                self.onLibrariesLoaded();
                callback(null);
            }
        },

        // insert scene name/urls into the registry
        _parseScenes: function (scenes) {
            if (!scenes) return;

            for (var i = 0; i < scenes.length; i++) {
                this._sceneRegistry.add(scenes[i].name, scenes[i].url);
            }
        },

        // insert assets into registry
        _parseAssets: function (assets) {
            var i, id;
            var list = [];

            var scriptsIndex = {};
            var bundlesIndex = {};

            if (!pc.script.legacy) {
                // add scripts in order of loading first
                for (i = 0; i < this.scriptsOrder.length; i++) {
                    id = this.scriptsOrder[i];
                    if (!assets[id])
                        continue;

                    scriptsIndex[id] = true;
                    list.push(assets[id]);
                }

                // then add bundles
                if (this.enableBundles) {
                    for (id in assets) {
                        if (assets[id].type === 'bundle') {
                            bundlesIndex[id] = true;
                            list.push(assets[id]);
                        }
                    }
                }

                // then add rest of assets
                for (id in assets) {
                    if (scriptsIndex[id] || bundlesIndex[id])
                        continue;

                    list.push(assets[id]);
                }
            } else {
                if (this.enableBundles) {
                    // add bundles
                    for (id in assets) {
                        if (assets[id].type === 'bundle') {
                            bundlesIndex[id] = true;
                            list.push(assets[id]);
                        }
                    }
                }


                // then add rest of assets
                for (id in assets) {
                    if (bundlesIndex[id])
                        continue;

                    list.push(assets[id]);
                }
            }

            for (i = 0; i < list.length; i++) {
                var data = list[i];
                var asset = new pc.Asset(data.name, data.type, data.file, data.data);
                asset.id = parseInt(data.id, 10);
                asset.preload = data.preload ? data.preload : false;
                // if this is a script asset and has already been embedded in the page then
                // mark it as loaded
                asset.loaded = data.type === 'script' && data.data && data.data.loadingType > 0;
                // tags
                asset.tags.add(data.tags);
                // i18n
                if (data.i18n) {
                    for (var locale in data.i18n) {
                        asset.addLocalizedAssetId(locale, data.i18n[locale]);
                    }
                }
                // registry
                this.assets.add(asset);
            }
        },

        _getScriptReferences: function (scene) {
            var i, key;

            var priorityScripts = [];
            if (scene.settings.priority_scripts) {
                priorityScripts = scene.settings.priority_scripts;
            }

            var _scripts = [];
            var _index = {};

            // first add priority scripts
            for (i = 0; i < priorityScripts.length; i++) {
                _scripts.push(priorityScripts[i]);
                _index[priorityScripts[i]] = true;
            }

            // then iterate hierarchy to get referenced scripts
            var entities = scene.entities;
            for (key in entities) {
                if (!entities[key].components.script) {
                    continue;
                }

                var scripts = entities[key].components.script.scripts;
                for (i = 0; i < scripts.length; i++) {
                    if (_index[scripts[i].url])
                        continue;
                    _scripts.push(scripts[i].url);
                    _index[scripts[i].url] = true;
                }
            }

            return _scripts;
        },

        /**
         * @function
         * @name pc.Application#start
         * @description Start the application. This function does the following:
         * <ol>
         *     <li>Fires an event on the application named 'start'</li>
         *     <li>Calls initialize for all components on entities in the hierachy</li>
         *     <li>Fires an event on the application named 'initialize'</li>
         *     <li>Calls postInitialize for all components on entities in the hierachy</li>
         *     <li>Fires an event on the application named 'postinitialize'</li>
         *     <li>Starts executing the main loop of the application</li>
         * </ol>
         * This function is called internally by PlayCanvas applications made in the Editor
         * but you will need to call start yourself if you are using the engine stand-alone.
         * @example
         * app.start();
         */
        start: function () {
            this.frame = 0;

            this.fire("start", {
                timestamp: pc.now(),
                target: this
            });

            if (!this._librariesLoaded) {
                this.onLibrariesLoaded();
            }

            pc.ComponentSystem.initialize(this.root);
            this.fire("initialize");

            pc.ComponentSystem.postInitialize(this.root);
            this.fire("postinitialize");

            this.tick();
        },

        /**
         * @function
         * @name pc.Application#update
         * @description Update the application. This function will call the update
         * functions and then the postUpdate functions of all enabled components. It
         * will then update the current state of all connected input devices.
         * This function is called internally in the application's main loop and
         * does not need to be called explicitly.
         * @param {Number} dt The time delta since the last frame.
         */
        update: function (dt) {
            this.frame++;

            this.graphicsDevice.updateClientRect();

            if (this.vr) this.vr.poll();

            // #ifdef PROFILER
            this.stats.frame.updateStart = pc.now();
            // #endif

            // Perform ComponentSystem update
            if (pc.script.legacy)
                pc.ComponentSystem.fixedUpdate(1.0 / 60.0, this._inTools);

            pc.ComponentSystem.update(dt, this._inTools);
            pc.ComponentSystem.postUpdate(dt, this._inTools);

            // fire update event
            this.fire("update", dt);

            if (this.controller) {
                this.controller.update(dt);
            }
            if (this.mouse) {
                this.mouse.update(dt);
            }
            if (this.keyboard) {
                this.keyboard.update(dt);
            }
            if (this.gamepads) {
                this.gamepads.update(dt);
            }

            // #ifdef PROFILER
            this.stats.frame.updateTime = pc.now() - this.stats.frame.updateStart;
            // #endif
        },

        /**
         * @function
         * @name pc.Application#render
         * @description Render the application's scene. More specifically, the scene's
         * {@link pc.LayerComposition} is rendered by the application's {@link pc.ForwardRenderer}.
         * This function is called internally in the application's main loop and
         * does not need to be called explicitly.
         */
        render: function () {
            // #ifdef PROFILER
            this.stats.frame.renderStart = pc.now();
            // #endif

            this.fire("prerender");
            this.root.syncHierarchy();
            this.batcher.updateAll();
            pc._skipRenderCounter = 0;
            this.renderer.renderComposition(this.scene.layers);
            this.fire("postrender");

            // #ifdef PROFILER
            this.stats.frame.renderTime = pc.now() - this.stats.frame.renderStart;
            // #endif
        },

        _fillFrameStats: function (now, dt, ms) {
            // Timing stats
            var stats = this.stats.frame;
            stats.dt = dt;
            stats.ms = ms;
            if (now > stats._timeToCountFrames) {
                stats.fps = stats._fpsAccum;
                stats._fpsAccum = 0;
                stats._timeToCountFrames = now + 1000;
            } else {
                stats._fpsAccum++;
            }

            // Render stats
            stats.cameras = this.renderer._camerasRendered;
            stats.materials = this.renderer._materialSwitches;
            stats.shaders = this.graphicsDevice._shaderSwitchesPerFrame;
            stats.shadowMapUpdates = this.renderer._shadowMapUpdates;
            stats.shadowMapTime = this.renderer._shadowMapTime;
            stats.depthMapTime = this.renderer._depthMapTime;
            stats.forwardTime = this.renderer._forwardTime;
            var prims = this.graphicsDevice._primsPerFrame;
            stats.triangles = prims[pc.PRIMITIVE_TRIANGLES] / 3 +
                Math.max(prims[pc.PRIMITIVE_TRISTRIP] - 2, 0) +
                Math.max(prims[pc.PRIMITIVE_TRIFAN] - 2, 0);
            stats.cullTime = this.renderer._cullTime;
            stats.sortTime = this.renderer._sortTime;
            stats.skinTime = this.renderer._skinTime;
            stats.morphTime = this.renderer._morphTime;
            stats.instancingTime = this.renderer._instancingTime;
            stats.otherPrimitives = 0;
            for (var i = 0; i < prims.length; i++) {
                if (i < pc.PRIMITIVE_TRIANGLES) {
                    stats.otherPrimitives += prims[i];
                }
                prims[i] = 0;
            }
            this.renderer._camerasRendered = 0;
            this.renderer._materialSwitches = 0;
            this.renderer._shadowMapUpdates = 0;
            this.graphicsDevice._shaderSwitchesPerFrame = 0;
            this.renderer._cullTime = 0;
            this.renderer._sortTime = 0;
            this.renderer._skinTime = 0;
            this.renderer._morphTime = 0;
            this.renderer._instancingTime = 0;
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
            stats.total = this.graphicsDevice._drawCallsPerFrame;
            stats.misc = stats.total - (stats.forward + stats.shadow);
            this.renderer._depthDrawCalls = 0;
            this.renderer._shadowDrawCalls = 0;
            this.renderer._forwardDrawCalls = 0;
            this.renderer._numDrawCallsCulled = 0;
            this.renderer._skinDrawCalls = 0;
            this.renderer._immediateRendered = 0;
            this.renderer._instancedDrawCalls = 0;
            this.renderer._removedByInstancing = 0;
            this.graphicsDevice._drawCallsPerFrame = 0;

            this.stats.misc.renderTargetCreationTime = this.graphicsDevice.renderTargetCreationTime;

            stats = this.stats.particles;
            stats.updatesPerFrame = stats._updatesPerFrame;
            stats.frameTime = stats._frameTime;
            stats._updatesPerFrame = 0;
            stats._frameTime = 0;
        },

        /**
         * @function
         * @name pc.Application#setCanvasFillMode
         * @description Controls how the canvas fills the window and resizes when the window changes.
         * @param {String} mode The mode to use when setting the size of the canvas. Can be:
         * <ul>
         *     <li>pc.FILLMODE_NONE: the canvas will always match the size provided.</li>
         *     <li>pc.FILLMODE_FILL_WINDOW: the canvas will simply fill the window, changing aspect ratio.</li>
         *     <li>pc.FILLMODE_KEEP_ASPECT: the canvas will grow to fill the window as best it can while maintaining the aspect ratio.</li>
         * </ul>
         * @param {Number} [width] The width of the canvas (only used when mode is pc.FILLMODE_NONE).
         * @param {Number} [height] The height of the canvas (only used when mode is pc.FILLMODE_NONE).
         */
        setCanvasFillMode: function (mode, width, height) {
            this._fillMode = mode;
            this.resizeCanvas(width, height);
        },

        /**
         * @function
         * @name pc.Application#setCanvasResolution
         * @description Change the resolution of the canvas, and set the way it behaves when the window is resized
         * @param {String} mode The mode to use when setting the resolution. Can be:
         * <ul>
         *     <li>pc.RESOLUTION_AUTO: if width and height are not provided, canvas will be resized to match canvas client size.</li>
         *     <li>pc.RESOLUTION_FIXED: resolution of canvas will be fixed.</li>
         * </ul>
         * @param {Number} [width] The horizontal resolution, optional in AUTO mode, if not provided canvas clientWidth is used
         * @param {Number} [height] The vertical resolution, optional in AUTO mode, if not provided canvas clientHeight is used
         */
        setCanvasResolution: function (mode, width, height) {
            this._resolutionMode = mode;

            // In AUTO mode the resolution is the same as the canvas size, unless specified
            if (mode === pc.RESOLUTION_AUTO && (width === undefined)) {
                width = this.graphicsDevice.canvas.clientWidth;
                height = this.graphicsDevice.canvas.clientHeight;
            }

            this.graphicsDevice.resizeCanvas(width, height);
        },

        /**
         * @function
         * @name pc.Application#isHidden
         * @description Queries the visibility of the window or tab in which the application is running.
         * @returns {Boolean} True if the application is not visible and false otherwise.
         */
        isHidden: function () {
            return document[this._hiddenAttr];
        },

        /**
         * @private
         * @function
         * @name pc.Application#onVisibilityChange
         * @description Called when the visibility state of the current tab/window changes
         */
        onVisibilityChange: function () {
            if (this.isHidden()) {
                this._audioManager.suspend();
            } else {
                this._audioManager.resume();
            }
        },

        /**
         * @function
         * @name pc.Application#resizeCanvas
         * @description Resize the application's canvas element in line with the current fill mode.
         * In {@link pc.FILLMODE_KEEP_ASPECT} mode, the canvas will grow to fill the window as best it can while maintaining the aspect ratio.
         * In {@link pc.FILLMODE_FILL_WINDOW} mode, the canvas will simply fill the window, changing aspect ratio.
         * In {@link pc.FILLMODE_NONE} mode, the canvas will always match the size provided.
         * @param {Number} [width] The width of the canvas. Only used if current fill mode is {@link pc.FILLMODE_NONE}.
         * @param {Number} [height] The height of the canvas. Only used if current fill mode is {@link pc.FILLMODE_NONE}.
         * @returns {Object} A object containing the values calculated to use as width and height.
         */
        resizeCanvas: function (width, height) {
            if (!this._allowResize) return; // prevent resizing (e.g. if presenting in VR HMD)

            var windowWidth = window.innerWidth;
            var windowHeight = window.innerHeight;

            if (this._fillMode === pc.FILLMODE_KEEP_ASPECT) {
                var r = this.graphicsDevice.canvas.width / this.graphicsDevice.canvas.height;
                var winR = windowWidth / windowHeight;

                if (r > winR) {
                    width = windowWidth;
                    height = width / r;
                } else {
                    height = windowHeight;
                    width = height * r;
                }
            } else if (this._fillMode === pc.FILLMODE_FILL_WINDOW) {
                width = windowWidth;
                height = windowHeight;
            } else {
                // FILLMODE_NONE use width and height that are provided
            }

            this.graphicsDevice.canvas.style.width = width + 'px';
            this.graphicsDevice.canvas.style.height = height + 'px';

            // In AUTO mode the resolution is changed to match the canvas size
            if (this._resolutionMode === pc.RESOLUTION_AUTO) {
                this.setCanvasResolution(pc.RESOLUTION_AUTO);
            }

            // return the final values calculated for width and height
            return {
                width: width,
                height: height
            };
        },

        /**
         * @private
         * @name pc.Application#onLibrariesLoaded
         * @description Event handler called when all code libraries have been loaded
         * Code libraries are passed into the constructor of the Application and the application won't start running or load packs until all libraries have
         * been loaded
         */
        onLibrariesLoaded: function () {
            this._librariesLoaded = true;
            this.systems.rigidbody.onLibraryLoaded();
            this.systems.collision.onLibraryLoaded();
        },

        /**
         * @function
         * @name pc.Application#applySceneSettings
         * @description Apply scene settings to the current scene. Useful when your scene settings are parsed or generated from a non-URL source.
         * @param {Object} settings Scene settings object to be applied.
         * @example
         *
         * var settings = {
         *   physics: {
         *     gravity: [ 0, -9.8, 0 ]
         *   },
         *   render: {
         *     fog_end: 1000,
         *     tonemapping: 0,
         *     skybox: null,
         *     fog_density: 0.01,
         *     gamma_correction: 1,
         *     exposure: 1,
         *     fog_start: 1,
         *     global_ambient: [ 0, 0, 0 ],
         *     skyboxIntensity: 1,
         *     fog_color: [ 0, 0, 0 ],
         *     lightmapMode: 1,
         *     fog: 'none',
         *     lightmapMaxResolution: 2048,
         *     skyboxMip: 2,
         *     lightmapSizeMultiplier: 16
         *   }
         * };
         * app.applySceneSettings(settings);
         */
        applySceneSettings: function (settings) {
            var asset;

            if (this.systems.rigidbody && typeof Ammo !== 'undefined') {
                var gravity = settings.physics.gravity;
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
        },

        /**
         * @function
         * @name pc.Application#setSkybox
         * @description Sets the skybox asset to current scene, and subscribes to asset load/change events
         * @param {pc.Asset} asset Asset of type `skybox` to be set to, or null to remove skybox
         */
        setSkybox: function (asset) {
            if (asset) {
                if (this._skyboxLast === asset.id) {
                    if (this.scene.skyboxMip === 0 && !asset.loadFaces) {
                        this._skyboxLoad(asset);
                    } else {
                        this._onSkyboxChange(asset);
                    }
                    return;
                }

                if (this._skyboxLast) {
                    this.assets.off('add:' + this._skyboxLast, this.setSkybox, this);
                    this.assets.off('load:' + this._skyboxLast, this._onSkyboxChange, this);
                    this.assets.off('remove:' + this._skyboxLast, this._skyboxRemove, this);
                }

                this._skyboxLast = asset.id;

                this.assets.on('load:' + asset.id, this._onSkyboxChange, this);
                this.assets.once('remove:' + asset.id, this._skyboxRemove, this);

                if (asset.resource)
                    this.scene.setSkybox(asset.resources);

                this._skyboxLoad(asset);
            } else {
                if (!this._skyboxLast)
                    return;

                this._skyboxRemove({
                    id: this._skyboxLast
                });
            }
        },

        /**
         * @function
         * @name pc.Application#enableVr
         * @description Create and assign a {@link pc.VrManager} object to allow this application render in VR.
         */
        enableVr: function () {
            if (!this.vr) {
                this.vr = new pc.VrManager(this);
            }
        },

        /**
         * @function
         * @name pc.Application#disableVr
         * @description Destroy the {@link pc.VrManager}
         */
        disableVr: function () {
            if (this.vr) {
                this.vr.destroy();
                this.vr = null;
            }
        },

        _onSkyboxChange: function (asset) {
            this.scene.setSkybox(asset.resources);
        },

        _skyboxLoad: function (asset) {
            if (this.scene.skyboxMip === 0)
                asset.loadFaces = true;

            this.assets.load(asset);

            this._onSkyboxChange(asset);
        },

        _skyboxRemove: function (asset) {
            if (!this._skyboxLast)
                return;

            this.assets.off('add:' + asset.id, this.setSkybox, this);
            this.assets.off('load:' + asset.id, this._onSkyboxChange, this);
            this.assets.off('remove:' + asset.id, this._skyboxRemove, this);
            this.scene.setSkybox(null);
            this._skyboxLast = null;
        },

        _firstBake: function () {
            this.lightmapper.bake(null, this.scene.lightmapMode);
        },

        _firstBatch: function () {
            if (this.scene._needsStaticPrepare) {
                this.renderer.prepareStaticMeshes(this.graphicsDevice, this.scene);
                this.scene._needsStaticPrepare = false;
            }
            this.batcher.generate();
        },

        _processTimestamp: function (timestamp) {
            return timestamp;
        },

        /**
         * @function
         * @name pc.Application#destroy
         * @description Destroys application and removes all event listeners.
         * @example
         * this.app.destroy();
         */
        destroy: function () {
            var i, l;
            var canvasId = this.graphicsDevice.canvas.id;

            this.off('librariesloaded');
            document.removeEventListener('visibilitychange', this._visibilityChangeHandler, false);
            document.removeEventListener('mozvisibilitychange', this._visibilityChangeHandler, false);
            document.removeEventListener('msvisibilitychange', this._visibilityChangeHandler, false);
            document.removeEventListener('webkitvisibilitychange', this._visibilityChangeHandler, false);
            this._visibilityChangeHandler = null;
            this.onVisibilityChange = null;

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

            if (this.controller) {
                this.controller = null;
            }

            var systems = this.systems.list;
            for (i = 0, l = systems.length; i < l; i++) {
                systems[i].destroy();
            }

            pc.ComponentSystem.destroy();

            // destroy all texture resources
            var assets = this.assets.list();
            for (i = 0; i < assets.length; i++) {
                assets[i].unload();
                assets[i].off();
            }
            this.assets.off();


            // destroy bundle registry
            this.bundles.destroy();
            this.bundles = null;

            this.i18n.destroy();
            this.i18n = null;

            for (var key in this.loader.getHandler('script')._cache) {
                var element = this.loader.getHandler('script')._cache[key];
                var parent = element.parentNode;
                if (parent) parent.removeChild(element);
            }
            this.loader.getHandler('script')._cache = {};

            this.loader.destroy();
            this.loader = null;

            this.scene.destroy();
            this.scene = null;

            this.systems = [];
            this.context = null;

            // script registry
            this.scripts.destroy();
            this.scripts = null;

            this._sceneRegistry.destroy();
            this._sceneRegistry = null;

            this.lightmapper.destroy();
            this.lightmapper = null;

            this.batcher.destroyManager();
            this.batcher = null;

            this._entityIndex = {};

            this.defaultLayerDepth.onPreRenderOpaque = null;
            this.defaultLayerDepth.onPostRenderOpaque = null;
            this.defaultLayerDepth.onDisable = null;
            this.defaultLayerDepth.onEnable = null;
            this.defaultLayerDepth = null;
            this.defaultLayerWorld = null;

            pc.destroyPostEffectQuad();

            if (this.vr) {
                this.vr.destroy();
                this.vr = null;
            }

            this.graphicsDevice.destroy();
            this.graphicsDevice = null;

            this.renderer = null;
            this.tick = null;

            this.off(); // remove all events

            if (this._audioManager) {
                this._audioManager.destroy();
                this._audioManager = null;
            }

            pc.http = new pc.Http();
            pc.script.app = null;
            // remove default particle texture
            pc.ParticleEmitter.DEFAULT_PARAM_TEXTURE = null;

            Application._applications[canvasId] = null;

            if (Application._currentApplication === this) {
                Application._currentApplication = null;
            }
        },

        /**
         * @private
         * @function
         * @name pc.Application#getEntityFromIndex
         * @description Get entity from the index by guid
         * @param {String} guid The GUID to search for
         * @returns {pc.Entity} The Entity with the GUID or null
         */
        getEntityFromIndex: function (guid) {
            return this._entityIndex[guid];
        }
    });

    // static data
    var _frameEndData = {};

    // create tick function to be wrapped in closure
    var makeTick = function (_app) {
        var app = _app;
        return function (timestamp) {
            if (!app.graphicsDevice) {
                return;
            }

            Application._currentApplication = app;

            // have current application pointer in pc
            pc.app = app;

            var now = app._processTimestamp(timestamp) || pc.now();
            var ms = now - (app._time || now);
            var dt = ms / 1000.0;
            dt = pc.math.clamp(dt, 0, app.maxDeltaTime);
            dt *= app.timeScale;

            app._time = now;

            // Submit a request to queue up a new animation frame immediately
            if (app.vr && app.vr.display) {
                app.vr.display.requestAnimationFrame(app.tick);
            } else {
                requestAnimationFrame(app.tick);
            }

            if (app.graphicsDevice.contextLost) {
                return;
            }

            // #ifdef PROFILER
            app._fillFrameStats(now, dt, ms);
            // #endif

            app.update(dt);

            if (app.autoRender || app.renderNextFrame) {
                app.render();
                app.renderNextFrame = false;
            }

            // set event data
            _frameEndData.timestamp = pc.now();
            _frameEndData.target = app;

            app.fire("frameend", _frameEndData);
            app.fire("frameEnd", _frameEndData);// deprecated old event, remove when editor updated

            if (app.vr && app.vr.display && app.vr.display.presenting) {
                app.vr.display.submitFrame();
            }
        };
    };

    return {
        /**
         * @constant
         * @type {String}
         * @name pc.FILLMODE_NONE
         * @description When resizing the window the size of the canvas will not change.
         */
        FILLMODE_NONE: 'NONE',
        /**
         * @constant
         * @type {String}
         * @name pc.FILLMODE_FILL_WINDOW
         * @description When resizing the window the size of the canvas will change to fill the window exactly.
         */
        FILLMODE_FILL_WINDOW: 'FILL_WINDOW',
        /**
         * @constant
         * @type {String}
         * @name pc.FILLMODE_KEEP_ASPECT
         * @description When resizing the window the size of the canvas will change to fill the window as best it can, while maintaining the same aspect ratio.
         */
        FILLMODE_KEEP_ASPECT: 'KEEP_ASPECT',
        /**
         * @constant
         * @type {String}
         * @name pc.RESOLUTION_AUTO
         * @description When the canvas is resized the resolution of the canvas will change to match the size of the canvas.
         */
        RESOLUTION_AUTO: 'AUTO',
        /**
         * @constant
         * @type {String}
         * @name pc.RESOLUTION_FIXED
         * @description When the canvas is resized the resolution of the canvas will remain at the same value and the output will just be scaled to fit the canvas.
         */
        RESOLUTION_FIXED: 'FIXED',

        Application: Application
    };
}());
