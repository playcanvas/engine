pc.extend(pc, function () {
    /**
    * @name pc.Application
    * @class Default application which performs general setup code and initiates the main game loop.
    * @description Create a new Application.
    * @param {Element} canvas The canvas element
    * @param {Object} options
    * @param {pc.Keyboard} [options.keyboard] Keyboard handler for input
    * @param {pc.Mouse} [options.mouse] Mouse handler for input
    * @param {pc.TouchDevice} [options.touch] TouchDevice handler for input
    * @param {pc.GamePads} [options.gamepads] Gamepad handler for input
    * @param {String} [options.scriptPrefix] Prefix to apply to script urls before loading
    * @param {String} [options.assetPrefix] Prefix to apply to asset urls before loading
    * @param {Object} [options.graphicsDeviceOptions] Options object that is passed into the {@link pc.GraphicsDevice} constructor
    *
    * @example
    * // Create application
    * var app = new pc.Application(canvas, options);
    * // Start game loop
    * app.start()
    */

    // PROPERTIES

    /**
    * @name pc.Application#scene
    * @type {pc.Scene}
    * @description The current {@link pc.Scene}
    */

    /**
    * @name pc.Application#timeScale
    * @type {Number}
    * @description Scales the global time delta.
    */

    /**
    * @name pc.Application#assets
    * @type {pc.AssetRegistry}
    * @description The assets available to the application.
    */

    /**
    * @name pc.Application#graphicsDevice
    * @type {pc.GraphicsDevice}
    * @description The graphics device used by the application.
    */

    /**
    * @name pc.Application#systems
    * @type {pc.ComponentSystem[]}
    * @description The component systems.
    */

    /**
    * @name pc.Application#loader
    * @type {pc.ResourceLoader}
    * @description The resource loader.
    */

    /**
    * @name pc.Application#root
    * @type {pc.Entity}
    * @description The root {@link pc.Entity} of the application.
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
    * @name pc.Application#scripts
    * @type pc.ScriptRegistry
    * @description The Script Registry of the Application
    */

    /**
    * @name pc.Application#autoRender
    * @type Boolean
    * @description When true (the default) the application's render function is called every frame.
    */

    /**
    * @name pc.Application#renderNextFrame
    * @type Boolean
    * @description If {@link pc.Application#autoRender} is false, set `app.renderNextFrame` true to force application to render the scene once next frame.
    * @example
    * // render the scene only while space key is pressed
    * if (this.app.keyboard.isPressed(pc.KEY_SPACE)) {
    *    this.app.renderNextFrame = true;
    * }
    */

    var Application = function (canvas, options) {
        options = options || {};

        // Open the log
        pc.log.open();
        // Add event support
        pc.events.attach(this);

        // Store application instance
        Application._applications[canvas.id] = this;
        Application._currentApplication = this;

        this._time = 0;
        this.timeScale = 1;


        this.autoRender = true;
        this.renderNextFrame = false;

        this._librariesLoaded = false;
        this._fillMode = pc.FILLMODE_KEEP_ASPECT;
        this._resolutionMode = pc.RESOLUTION_FIXED;
        this._allowResize = true;

        // for compatibility
        this.context = this;

        this.graphicsDevice = new pc.GraphicsDevice(canvas, options.graphicsDeviceOptions);
        this.stats = new pc.ApplicationStats(this.graphicsDevice);
        this.systems = new pc.ComponentSystemRegistry();
        this._audioManager = new pc.SoundManager(options);
        this.loader = new pc.ResourceLoader();

        this.scene = new pc.Scene();
        this.root = new pc.Entity(this);
        this.root._enabledInHierarchy = true;
        this._enableList = [ ];
        this._enableList.size = 0;
        this.assets = new pc.AssetRegistry(this.loader);
        if (options.assetPrefix) this.assets.prefix = options.assetPrefix;
        this.scriptsOrder = options.scriptsOrder || [ ];
        this.scripts = new pc.ScriptRegistry(this);
        this.renderer = new pc.ForwardRenderer(this.graphicsDevice);
        this.lightmapper = new pc.Lightmapper(this.graphicsDevice, this.root, this.scene, this.renderer, this.assets);
        this.once('prerender', this._firstBake, this);

        this.keyboard = options.keyboard || null;
        this.mouse = options.mouse || null;
        this.touch = options.touch || null;
        this.gamepads = options.gamepads || null;
        this.vr = null;
        // you can enable vr here, or in application properties
        if (options.vr) {
            this._onVrChange(options.vr);
        }

        this._inTools = false;

        this._skyboxLast = 0;

        this._scriptPrefix = options.scriptPrefix || '';

        this.loader.addHandler("animation", new pc.AnimationHandler());
        this.loader.addHandler("model", new pc.ModelHandler(this.graphicsDevice));
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

        var rigidbodysys = new pc.RigidBodyComponentSystem(this);
        var collisionsys = new pc.CollisionComponentSystem(this);
        var animationsys = new pc.AnimationComponentSystem(this);
        var modelsys = new pc.ModelComponentSystem(this);
        var camerasys = new pc.CameraComponentSystem(this);
        var lightsys = new pc.LightComponentSystem(this);
        if (pc.script.legacy) {
            new pc.ScriptLegacyComponentSystem(this);
        } else {
            new pc.ScriptComponentSystem(this);
        }
        var audiosourcesys = new pc.AudioSourceComponentSystem(this, this._audioManager);
        var soundsys = new pc.SoundComponentSystem(this, this._audioManager);
        var audiolistenersys = new pc.AudioListenerComponentSystem(this, this._audioManager);
        var particlesystemsys = new pc.ParticleSystemComponentSystem(this);
        var screensys = new pc.ScreenComponentSystem(this);
        var elementsys = new pc.ElementComponentSystem(this);
        // var textsys = new pc.TextComponentSystem(this);
        // var imagesys = new pc.ImageComponentSystem(this);
        var zonesys = new pc.ZoneComponentSystem(this);

        this._visibilityChangeHandler = this.onVisibilityChange.bind(this);

        // Depending on browser add the correct visibiltychange event and store the name of the hidden attribute
        // in this._hiddenAttr.
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

        // bind tick function to current scope
        this.tick = makeTick(this);
    };


    Application._currentApplication = null;
    Application._applications = {};
    Application.getApplication = function (id) {
        if (id) {
            return Application._applications[id];
        } else {
            return Application._currentApplication;
        }
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

    Application.prototype = {
        /**
        * @function
        * @name pc.Application#configure
        * @description Load the application configuration file and apply application properties and fill the asset registry
        * @param {String} url The URL of the configuration file to load
        * @param {Function} callback The Function called when the configuration file is loaded and parsed
        */
        configure: function (url, callback) {
            var self = this;
            pc.http.get(url, function (err, response) {
                if (err) {
                    callback(err);
                    return;
                }

                var props = response['application_properties'];
                var assets = response['assets'];
                var scripts = response['scripts'];
                var priorityScripts = response['priority_scripts'];

                self._parseApplicationProperties(props, function (err) {
                    self._onVrChange(props.vr);
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
        * @param {Function} callback Function called when all assets are loaded
        */
        preload: function (callback) {
            var self = this;

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
            var total = assets.length;
            var count = function () {
                return _assets.count;
            };

            var i;
            if (_assets.length) {
                var onAssetLoad = function(asset) {
                    _assets.inc();
                    self.fire('preload:progress', count() / total);

                    if (_assets.done())
                        done();
                };

                var onAssetError = function(err, asset) {
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
        * @name pc.Application#loadSceneHierarchy
        * @description Load a scene file, create and initialize the Entity hierarchy
        * and add the hierarchy to the application root Entity.
        * @param {String} url The URL of the scene file. Usually this will be "scene_id.json"
        * @param {Function} callback The function to call after loading, passed (err, entity) where err is null if no errors occurred.
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
            var self = this;

            // Because we need to load scripts before we instance the hierarchy (i.e. before we create script components)
            // Split loading into load and open
            var handler = this.loader.getHandler("hierarchy");

            // include asset prefix if present
            if (this.assets && this.assets.prefix && !pc.ABSOLUTE_URL.test(url)) {
                url = pc.path.join(this.assets.prefix, url);
            }

            handler.load(url, function (err, data) {
                if (err) {
                    if (callback) callback(err);
                    return;
                }

                // called after scripts are preloaded
                var _loaded = function () {
                    var entity = handler.open(url, data);

                    // clear from cache because this data is modified by entity operations (e.g. destroy)
                    self.loader.clearCache(url, "hierarchy");

                    // add to hierarchy
                    self.root.addChild(entity);

                    // initialize components
                    pc.ComponentSystem.initialize(entity);
                    pc.ComponentSystem.postInitialize(entity);

                    if (callback) callback(err, entity);
                };

                // load priority and referenced scripts before opening scene
                self._preloadScripts(data, _loaded);
            });
        },

        /**
        * @function
        * @name pc.Application#loadSceneSettings
        * @description Load a scene file and apply the scene settings to the current scene
        * @param {String} url The URL of the scene file. Usually this will be "scene_id.json"
        * @param {Function} callback The function called after the settings are applied. Passed (err) where err is null if no error occurred.
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
            // include asset prefix if present
            if (this.assets && this.assets.prefix && !pc.ABSOLUTE_URL.test(url)) {
                url = pc.path.join(this.assets.prefix, url);
            }

            this.loader.load(url, "scenesettings", function (err, settings) {
                if (!err) {
                    this.applySceneSettings(settings);
                    if (callback) {
                        callback(null);
                    }

                } else {
                    if (callback) {
                        callback(err);
                    }
                }
            }.bind(this));
        },

        loadScene: function (url, callback) {
            var self = this;

            var handler = this.loader.getHandler("scene");

            // include asset prefix if present
            if (this.assets && this.assets.prefix && !pc.ABSOLUTE_URL.test(url)) {
                url = pc.path.join(this.assets.prefix, url);
            }

            handler.load(url, function (err, data) {
                if (!err) {
                    var _loaded = function () {
                        // parse and create scene
                        var scene = handler.open(url, data);

                        // clear scene from cache because we'll destroy it when we load another one
                        // so data will be invalid
                        self.loader.clearCache(url, "scene");

                        self.loader.patch({
                            resource: scene,
                            type: "scene"
                        }, self.assets);

                        self.root.addChild(scene.root);

                        // Initialise pack settings
                        if (self.systems.rigidbody && typeof Ammo !== 'undefined') {
                            self.systems.rigidbody.setGravity(scene._gravity.x, scene._gravity.y, scene._gravity.z);
                        }

                        if (callback) {
                            callback(null, scene);
                        }
                    };

                    // preload scripts before opening scene
                    this._preloadScripts(data, _loaded);
                } else {
                    if (callback) {
                        callback(err);
                    }
                }
            }.bind(this));
        },

        _preloadScripts: function (sceneData, callback) {
            if (! pc.script.legacy) {
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
            this._width = props.width;
            this._height = props.height;
            if (props.use_device_pixel_ratio) {
                this.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
            }

            this.setCanvasResolution(props.resolution_mode, this._width, this._height);
            this.setCanvasFillMode(props.fill_mode, this._width, this._height);

            // if VR is enabled in the project and there is no native VR support
            // load the polyfill
            if (props.vr && props.vr_polyfill_url) {
                if (!pc.VrManager.isSupported || pc.platform.android) {
                    props.libraries.push(props.vr_polyfill_url);
                }
            }

            this._loadLibraries(props.libraries, callback);
        },

        _loadLibraries: function (urls, callback) {
            var len = urls.length;
            var count = len;
            var self = this;

            var regex = /^http(s)?:\/\//;

            if (len) {
                var onLoad = function(err, script) {
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
                callback(null);
            }
        },

        // insert assets into registry
        _parseAssets: function (assets) {
            var scripts = [ ];
            var list = [ ];

            var scriptsIndex = { };

            if (! pc.script.legacy) {
                // add scripts in order of loading first
                for(var i = 0; i < this.scriptsOrder.length; i++) {
                    var id = this.scriptsOrder[i];
                    if (! assets[id])
                        continue;

                    scriptsIndex[id] = true;
                    list.push(assets[id]);
                }

                // then add rest of assets
                for(var id in assets) {
                    if (scriptsIndex[id])
                        continue;

                    list.push(assets[id]);
                }
            } else {
                for(var id in assets)
                    list.push(assets[id]);
            }

            for(var i = 0; i < list.length; i++) {
                var data = list[i];
                var asset = new pc.Asset(data.name, data.type, data.file, data.data);
                asset.id = parseInt(data.id);
                asset.preload = data.preload ? data.preload : false;
                // tags
                asset.tags.add(data.tags);
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

            // then interate hierarchy to get referenced scripts
            var entities = scene.entities;
            for (key in entities) {
                if (!entities[key].components.script) {
                    continue;
                }

                var scripts = entities[key].components.script.scripts;
                for(i = 0; i < scripts.length; i++) {
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
         * @description Start the Application updating
         */
        start: function () {
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
         * @description Application specific update method. Override this if you have a custom Application
         * @param {Number} dt The time delta since the last frame.
         */
        update: function (dt) {
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
         * @description Application specific render method. Override this if you have a custom Application
         */
        render: function () {
            // #ifdef PROFILER
            this.stats.frame.renderStart = pc.now();
            // #endif

            this.fire("prerender");

            var cameras = this.systems.camera.cameras;
            var camera = null;
            var renderer = this.renderer;

            this.root.syncHierarchy();

            // render the scene from each camera
            for (var i=0,len=cameras.length; i<len; i++) {
                camera = cameras[i];
                camera.frameBegin();
                renderer.render(this.scene, camera.camera);
                camera.frameEnd();
            }

            // #ifdef PROFILER
            this.stats.frame.renderTime = pc.now() - this.stats.frame.renderStart;
            // #endif
        },

        _fillFrameStats: function(now, dt, ms) {
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
            stats.triangles = prims[pc.PRIMITIVE_TRIANGLES]/3 +
                Math.max(prims[pc.PRIMITIVE_TRISTRIP]-2, 0) +
                Math.max(prims[pc.PRIMITIVE_TRIFAN]-2, 0);
            stats.cullTime = this.renderer._cullTime;
            stats.sortTime = this.renderer._sortTime;
            stats.skinTime = this.renderer._skinTime;
            stats.instancingTime = this.renderer._instancingTime;
            stats.otherPrimitives = 0;
            for(var i=0; i<prims.length; i++) {
                if (i<pc.PRIMITIVE_TRIANGLES) {
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
            this.renderer._instancingTime = 0;
            this.renderer._shadowMapTime = 0;
            this.renderer._depthMapTime = 0;
            this.renderer._forwardTime = 0;

            // Draw call stats
            stats = this.stats.drawCalls;
            stats.forward = this.renderer._forwardDrawCalls;
            stats.depth = this.renderer._depthDrawCalls;
            stats.shadow = this.renderer._shadowDrawCalls;
            stats.skinned = this.renderer._skinDrawCalls;
            stats.immediate = this.renderer._immediateRendered;
            stats.instanced = this.renderer._instancedDrawCalls;
            stats.removedByInstancing = this.renderer._removedByInstancing;
            stats.total = this.graphicsDevice._drawCallsPerFrame;
            stats.misc = stats.total - (stats.forward + stats.depth + stats.shadow);
            this.renderer._depthDrawCalls = 0;
            this.renderer._shadowDrawCalls = 0;
            this.renderer._forwardDrawCalls = 0;
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
        * @param {string} mode The mode to use when setting the resolution. Can be:
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
        * @name pc.Application#isFullscreen
        * @description Returns true if the application is currently running fullscreen
        * @returns {Boolean} True if the application is running fullscreen
        */
        isFullscreen: function () {
            return !!document.fullscreenElement;
        },

        /**
        * @function
        * @name pc.Application#enableFullscreen
        * @description Request that the browser enters fullscreen mode. This is not available on all browsers.
        * Note: Switching to fullscreen can only be initiated by a user action, e.g. in the event hander for a mouse or keyboard input
        * @param {Element} [element] The element to display in fullscreen, if element is not provided the application canvas is used
        * @param {Function} [success] Function called if the request for fullscreen was successful
        * @param {Function} [error] Function called if the request for fullscreen was unsuccessful
        * @example
        * var button = document.getElementById('my-button');
        * button.addEventListener('click', function () {
        *     app.enableFullscreen(canvas, function () {
        *         console.log('Now fullscreen');
        *     }, function () {
        *         console.log('Something went wrong!');
        *     });
        * }, false);
        */
        enableFullscreen: function (element, success, error) {
            element = element || this.graphicsDevice.canvas;

            // success callback
            var s = function () {
                success();
                document.removeEventListener('fullscreenchange', s);
            };

            // error callback
            var e = function () {
                error();
                document.removeEventListener('fullscreenerror', e);
            };

            if (success) {
                document.addEventListener('fullscreenchange', s, false);
            }

            if (error) {
                document.addEventListener('fullscreenerror', e, false);
            }

            if (element.requestFullscreen) {
                element.requestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
            } else {
                error();
            }

        },

        /**
        * @function
        * @name pc.Application#disableFullscreen
        * @description If application is currently displaying an element as fullscreen, then stop and return to normal.
        * @param {Function} [success] Function called when transition to normal mode is finished
        */
        disableFullscreen: function (success) {
            // success callback
            var s = function () {
                success();
                document.removeEventListener('fullscreenchange', s);
            };

            if (success) {
                document.addEventListener('fullscreenchange', s, false);
            }

            document.exitFullscreen();
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
        onVisibilityChange: function (e) {
            if (this.isHidden()) {
                this._audioManager.suspend();
            } else {
                this._audioManager.resume();
            }
        },

        /**
        * @function
        * @name pc.Application#resizeCanvas
        * @description Resize the canvas in line with the current FillMode
        * In KEEP_ASPECT mode, the canvas will grow to fill the window as best it can while maintaining the aspect ratio
        * In FILL_WINDOW mode, the canvas will simply fill the window, changing aspect ratio
        * In NONE mode, the canvas will always match the size provided
        * @param {Number} [width] The width of the canvas, only used in NONE mode
        * @param {Number} [height] The height of the canvas, only used in NONE mode
        * @returns {Object} A object containing the values calculated to use as width and height
        */
        resizeCanvas: function (width, height) {
            if (!this._allowResize) return; // prevent resizing (e.g. if presenting in VR HMD)

            var windowWidth = window.innerWidth;
            var windowHeight = window.innerHeight;

            if (navigator.isCocoonJS) {
                width = windowWidth;
                height = windowHeight;

                this.graphicsDevice.resizeCanvas(width, height);
            } else {
                if (this._fillMode === pc.FILLMODE_KEEP_ASPECT) {
                    var r = this.graphicsDevice.canvas.width/this.graphicsDevice.canvas.height;
                    var winR = windowWidth / windowHeight;

                    if (r > winR) {
                        width = windowWidth;
                        height = width / r ;
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

        applySceneSettings: function (settings) {
            var asset;

            if (this.systems.rigidbody && typeof Ammo !== 'undefined') {
                var gravity = settings.physics.gravity;
                this.systems.rigidbody.setGravity(gravity[0], gravity[1], gravity[2]);
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
        setSkybox: function(asset) {
            if (asset) {
                if (this._skyboxLast === asset.id) {
                    if (this.scene.skyboxMip === 0 && ! asset.loadFaces) {
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
                if (! this._skyboxLast)
                    return;

                this._skyboxRemove({
                    id: this._skyboxLast
                });
            }
        },

        _onVrChange: function (enabled) {
            if (enabled) {
                if (!this.vr) {
                    this.vr = new pc.VrManager(this);
                }
            } else {
                if (this.vr) {
                    this.vr.destroy();
                    this.vr = null;
                }
            }
        },

        _onSkyboxChange: function(asset) {
            this.scene.setSkybox(asset.resources);
        },

        _skyboxLoad: function(asset) {
            if (this.scene.skyboxMip === 0)
                asset.loadFaces = true;

            this.assets.load(asset);

            this._onSkyboxChange(asset);
        },

        _skyboxRemove: function(asset) {
            if (! this._skyboxLast)
                return;

            this.assets.off('add:' + asset.id, this.setSkybox, this);
            this.assets.off('load:' + asset.id, this._onSkyboxChange, this);
            this.assets.off('remove:' + asset.id, this._skyboxRemove, this);
            this.scene.setSkybox(null);
            this._skyboxLast = null;
        },

        _firstBake: function() {
            this.lightmapper.bake(null, this.scene.lightmapMode);
        },

        /**
        * @function
        * @name pc.Application#destroy
        * @description Destroys application and removes all event listeners.
        */
        destroy: function () {
            Application._applications[this.graphicsDevice.canvas.id] = null;

            this.off('librariesloaded');
            document.removeEventListener('visibilitychange', this._visibilityChangeHandler);
            document.removeEventListener('mozvisibilitychange', this._visibilityChangeHandler);
            document.removeEventListener('msvisibilitychange', this._visibilityChangeHandler);
            document.removeEventListener('webkitvisibilitychange', this._visibilityChangeHandler);

            if (this.mouse) {
                this.mouse.off('mouseup');
                this.mouse.off('mousedown');
                this.mouse.off('mousewheel');
                this.mouse.off('mousemove');

                this.mouse = null;
            }

            if (this.keyboard) {
                this.keyboard.off("keydown");
                this.keyboard.off("keyup");
                this.keyboard.off("keypress");

                this.keyboard = null;
            }

            if (this.touch) {
                this.touch.off('touchstart');
                this.touch.off('touchend');
                this.touch.off('touchmove');
                this.touch.off('touchcancel');

                this.touch = null;
            }

            if (this.controller) {
                this.controller = null;
            }

            this.root.destroy();

            pc.ComponentSystem.destroy();

            this.loader.destroy();
            this.loader = null;

            // destroy all texture resources
            var assets = this.assets.list();
            for (var i = 0; i < assets.length; i++) {
                assets[i].unload();
            }

            this.scene = null;

            this.systems = [];
            this.context = null;

            this.graphicsDevice.clearShaderCache();
            this.graphicsDevice.destroy();
            this.graphicsDevice.destroyed = true;
            this.graphicsDevice = null;

            this.renderer = null;

            if (this._audioManager) {
                this._audioManager.destroy();
                this._audioManager = null;
            }

            pc.http = new pc.Http();

            // remove default particle texture
            pc.ParticleEmitter.DEFAULT_PARAM_TEXTURE = null;

            pc.destroyPostEffectQuad();
        }
    };

    // create tick function to be wrapped in closure
    var makeTick = function (_app) {
        var app = _app;
        return function () {
            if (!app.graphicsDevice) {
                return;
            }

            Application._currentApplication = app;

            // have current application pointer in pc
            pc.app = app;

            var now = pc.now();
            var ms = now - (app._time || now);
            var dt = ms / 1000.0;

            app._time = now;

            dt = pc.math.clamp(dt, 0, 0.1); // Maximum delta is 0.1s or 10 fps.
            dt *= app.timeScale;

            // Submit a request to queue up a new animation frame immediately
            if (app.vr && app.vr.display && app.vr.display.presenting) {
                app.vr.display.requestAnimationFrame(app.tick);
            } else {
                window.requestAnimationFrame(app.tick);
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

        }
    };
    // static data
    var _frameEndData = {};

    return {
        /**
         * @enum pc.FILLMODE
         * @name pc.FILLMODE_NONE
         * @description When resizing the window the size of the canvas will not change.
         */
        FILLMODE_NONE: 'NONE',
        /**
         * @enum pc.FILLMODE
         * @name pc.FILLMODE_FILL_WINDOW
         * @description When resizing the window the size of the canvas will change to fill the window exactly.
         */
        FILLMODE_FILL_WINDOW: 'FILL_WINDOW',
        /**
         * @enum pc.FILLMODE
         * @name pc.FILLMODE_KEEP_ASPECT
         * @description When resizing the window the size of the canvas will change to fill the window as best it can, while maintaining the same aspect ratio.
         */
        FILLMODE_KEEP_ASPECT: 'KEEP_ASPECT',
        /**
        * @enum pc.RESOLUTION
        * @name pc.RESOLUTION_AUTO
        * @description When the canvas is resized the resolution of the canvas will change to match the size of the canvas.
        */
        RESOLUTION_AUTO: 'AUTO',
        /**
        * @enum pc.RESOLUTION
        * @name pc.RESOLUTION_FIXED
        * @description When the canvas is resized the resolution of the canvas will remain at the same value and the output will just be scaled to fit the canvas.
        */
        RESOLUTION_FIXED: 'FIXED',

        Application: Application
    };
}());
