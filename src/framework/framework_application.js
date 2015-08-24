pc.extend(pc, function () {

    /**
     * @name pc.Application
     * @class Default application which performs general setup code and initiates the main game loop
     * @constructor Create a new Application
     * @param {DOMElement} canvas The canvas element
     * @param {Object} options
     * @param {pc.Keyboard} [options.keyboard] Keyboard handler for input
     * @param {pc.Mouse} [options.mouse] Mouse handler for input
     * @param {pc.TouchDevice} [options.touch] TouchDevice handler for input
     * @param {pc.GamePads} [options.gamepads] Gamepad handler for input
     * @param {String} [options.scriptPrefix] Prefix to apply to script urls before loading
     * @property {pc.Scene} scene The current {@link pc.Scene}
     * @property {Number} timeScale Scales the global time delta.
     * @property {pc.AssetRegistry} assets The assets available to the application.
     * @property {pc.GraphicsDevice} graphicsDevice The graphics device used by the application.
     * @property {[pc.ComponentSystem]} systems The component systems.
     * @property {pc.ResourceLoader} loader The resource loader.
     * @property {pc.Entity} root The root {@link pc.Entity} of the application.
     * @property {pc.ForwardRenderer} renderer The graphics renderer.
     * @property {pc.Keyboard} keyboard The keyboard device.
     * @property {pc.Mouse} mouse The mouse device.
     * @property {pc.TouchDevice} touch Used to get touch events input.
     * @property {pc.GamePads} gamepads Used to access GamePad input.
     *
     * @example
     * // Create application
     * var app = new pc.Application(canvas, options);
     * // Start game loop
     * app.start()
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

        this._librariesLoaded = false;
        this._fillMode = pc.FILLMODE_KEEP_ASPECT;
        this._resolutionMode = pc.RESOLUTION_FIXED;

        // for compatibility
        this.context = this;

        this.graphicsDevice = new pc.GraphicsDevice(canvas);
        this.systems = new pc.ComponentSystemRegistry();
        this._audioManager = new pc.AudioManager();
        this.loader = new pc.ResourceLoader();

        this.scene = null;
        this.root = new pc.fw.Entity(this);
        this.assets = new pc.AssetRegistry(this.loader);
        this.renderer = new pc.ForwardRenderer(this.graphicsDevice);

        this.keyboard = options.keyboard || null;
        this.mouse = options.mouse || null;
        this.touch = options.touch || null;
        this.gamepads = options.gamepads || null;

        this._inTools = false;

        this._skyboxLast = 0;

        this._scriptPrefix = options.scriptPrefix || '';
        // this._scripts = [];

        this.loader.addHandler("animation", new pc.AnimationHandler());
        this.loader.addHandler("model", new pc.ModelHandler(this.graphicsDevice));
        this.loader.addHandler("material", new pc.MaterialHandler(this.assets));
        this.loader.addHandler("texture", new pc.TextureHandler(this.graphicsDevice, this.assets, this.loader));
        this.loader.addHandler("text", new pc.TextHandler());
        this.loader.addHandler("json", new pc.JsonHandler());
        this.loader.addHandler("audio", new pc.AudioHandler(this._audioManager));
        this.loader.addHandler("script", new pc.ScriptHandler(this));
        this.loader.addHandler("scene", new pc.SceneHandler(this));
        this.loader.addHandler("cubemap", new pc.CubemapHandler(this.graphicsDevice, this.assets, this.loader));
        this.loader.addHandler("html", new pc.HtmlHandler());
        this.loader.addHandler("css", new pc.CssHandler());
        this.loader.addHandler("hierarchy", new pc.HierarchyHandler(this));
        this.loader.addHandler("scenesettings", new pc.SceneSettingsHandler(this));

        var rigidbodysys = new pc.RigidBodyComponentSystem(this);
        var collisionsys = new pc.CollisionComponentSystem(this);
        var ballsocketjointsys = new pc.BallSocketJointComponentSystem(this);
        var animationsys = new pc.AnimationComponentSystem(this);
        var modelsys = new pc.ModelComponentSystem(this);
        var camerasys = new pc.CameraComponentSystem(this);
        var lightsys = new pc.LightComponentSystem(this);
        var scriptsys = new pc.ScriptComponentSystem(this, options.scriptPrefix);
        var picksys = new pc.PickComponentSystem(this);
        var audiosourcesys = new pc.AudioSourceComponentSystem(this, this._audioManager);
        var audiolistenersys = new pc.AudioListenerComponentSystem(this, this._audioManager);
        var particlesystemsys = new pc.ParticleSystemComponentSystem(this);

        // Depending on browser add the correct visibiltychange event and store the name of the hidden attribute
        // in this._hiddenAttr.
        if (document.hidden !== undefined) {
            this._hiddenAttr = 'hidden';
            document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this), false);
        } else if (document.mozHidden !== undefined) {
            this._hiddenAttr = 'mozHidden';
            document.addEventListener('mozvisibilitychange', this.onVisibilityChange.bind(this), false);
        } else if (document.msHidden !== undefined) {
            this._hiddenAttr = 'msHidden';
            document.addEventListener('msvisibilitychange', this.onVisibilityChange.bind(this), false);
        } else if (document.webkitHidden !== undefined) {
            this._hiddenAttr = 'webkitHidden';
            document.addEventListener('webkitvisibilitychange', this.onVisibilityChange.bind(this), false);
        }
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
        }

        this.done = function () {
            return (this.count === this.length);
        }
    };

    Application.prototype = {
        /**
        * @name pc.Application#configure
        * @description Load a configuration file from
        */
        configure: function (url, callback) {
            var self = this;
            pc.net.http.get(url, function (response) {
                var props = response['application_properties'];
                var assets = response['assets'];
                var scripts = response['scripts'];
                var priorityScripts = response['priority_scripts'];

                self._parseApplicationProperties(props, function (err) {
                    self._parseAssets(assets);
                    if (!err) {
                        callback(null);
                    } else {
                        callback(err);
                    }
                });
            }, {
                error: function (status, xhr, e) {
                    callback(status);
                }
            });
        },

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
                for(i = 0; i < _assets.length; i++) {
                    if (!assets[i].loaded) {
                        assets[i].once('load', function (asset) {
                            _assets.inc()
                            self.fire("preload:progress", count()/total);

                            if (_assets.done()) {
                                done();
                            }
                        });

                        assets[i].once('error', function (err, asset) {
                            _assets.inc()
                            self.fire("preload:progress", count()/total);

                            if (_assets.done()) {
                                done();
                            }
                        });

                        this.assets.load(assets[i]);
                    } else {
                        _assets.inc()
                        self.fire("preload:progress", count()/total);

                        if (_assets.done()) {
                            done();
                        }
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

            handler.load(url, function (err, data) {
                var settings = data.settings

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

                    if (callback) {
                        callback(err, entity);
                    }
                }

                // load priority and referenced scripts before opening scene
                this._preloadScripts(data, _loaded);
            }.bind(this));
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
            var first = true;

            // If there is an existing scene destroy it
            if (this.scene) {
                first = false;
                this.scene.root.destroy();
                this.scene.destroy();
                this.scene = null;
            }

            var handler = this.loader.getHandler("scene");

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

                        if (!first) {
                            // if this is not the initial scene
                            // we need to run component initialization
                            // first scene is initialized in app.start()
                            pc.ComponentSystem.initialize(scene.root);
                            pc.ComponentSystem.postInitialize(scene.root);
                        }

                        if (callback) {
                            callback(null, scene);
                        }
                    }

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
            var self = this;

            self.systems.script.preloading = true;

            var scripts = this._getScriptReferences(sceneData);

            var i = 0, l = scripts.length;
            var progress = new Progress(l);
            var scriptUrl;
            var regex = /^http(s)?:\/\//;

            if (l) {
                for (i = 0; i < l; i++) {
                    scriptUrl = scripts[i];
                    // support absolute URLs (for now)
                    if (!regex.test(scriptUrl.toLowerCase())) {
                        scriptUrl = pc.path.join(this._scriptPrefix, scripts[i]);
                    }

                    this.loader.load(scriptUrl, "script", function (err, ScriptType) {
                        if (err)
                            console.error(err);

                        progress.inc();
                        if (progress.done()) {
                            self.systems.script.preloading = false;
                            callback();
                        }
                    });
                }
            } else {
                self.systems.script.preloading = false;
                callback();
            }
        },

        // set application properties from data file
        _parseApplicationProperties: function (props, callback) {
            this._width = props['width'];
            this._height = props['height'];
            if (props['use_device_pixel_ratio']) {
                this.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
            }

            this.setCanvasResolution(props['resolution_mode'], this._width, this._height);
            this.setCanvasFillMode(props['fill_mode'], this._width, this._height);

            this._loadLibraries(props['libraries'], callback);
        },

        _loadLibraries: function (urls, callback) {
            var len = urls.length;
            var count = len
            if (len) {
                // load libraries
                for (var i = 0; i < len; ++i) {
                    var url = urls[i];
                    this.loader.load(url, "script", function (err, script) {
                        count--;
                        if (err) {
                            callback(err);
                        } else if (count === 0) {
                            this.onLibrariesLoaded();
                            callback(null);
                        }
                    }.bind(this));
                }
            } else {
                callback(null);
            }
        },

        // insert assets into registry
        _parseAssets: function (assets) {
            for (var id in assets) {
                var data = assets[id];
                var asset = new pc.Asset(data['name'], data['type'], data['file'], data['data']);
                asset.id = parseInt(id);
                asset.preload = data.preload ? data.preload : false;
                // tags
                asset.tags.add(data['tags']);
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
            this.fire("start");

            if (!this.scene) {
                this.scene = new pc.Scene();
                this.scene.root = new pc.Entity();
                this.root.addChild(this.scene.root);
            }

            if (!this._librariesLoaded) {
                this.onLibrariesLoaded();
            }

            pc.ComponentSystem.initialize(this.root);
            pc.ComponentSystem.postInitialize(this.root);

            this.tick();
        },

        /**
         * @function
         * @name pc.Application#update
         * @description Application specific update method. Override this if you have a custom Application
         * @param {Number} dt The time delta since the last frame.
         */
        update: function (dt) {
            // Perform ComponentSystem update
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
        },

        /**
         * @function
         * @name pc.Application#render
         * @description Application specific render method. Override this if you have a custom Application
         */
        render: function () {
            if (!this.scene) {
                return;
            }

            this.fire("preRender", null);

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
        },

        /**
         * @function
         * @name pc.Application#tick
         * @description Application specific tick method that calls update and render and queues
         * the next tick. Override this if you have a custom Application.
         */
        tick: function () {
            if (!this.graphicsDevice) {
                return;
            }

            Application._currentApplication = this;

            // Submit a request to queue up a new animation frame immediately
            window.requestAnimationFrame(this.tick.bind(this));

            var now = (window.performance && window.performance.now) ? performance.now() : Date.now();
            var dt = (now - (this._time || now)) / 1000.0;

            this._time = now;

            dt = pc.math.clamp(dt, 0, 0.1); // Maximum delta is 0.1s or 10 fps.
            dt *= this.timeScale;

            this.update(dt);
            this.render();
        },

        /**
        * @function
        * @name pc.Application#setCanvasFillMode
        * @description Change the way the canvas fills the window and resizes when the window changes
        * In KEEP_ASPECT mode, the canvas will grow to fill the window as best it can while maintaining the aspect ratio
        * In FILL_WINDOW mode, the canvas will simply fill the window, changing aspect ratio
        * In NONE mode, the canvas will always match the size provided
        * @param {pc.FillMode} mode The mode to use when setting the size of the canvas
        * @param {Number} [width] The width of the canvas, only used in NONE mode
        * @param {Number} [height] The height of the canvase, only used in NONE mode
        */
        setCanvasFillMode: function (mode, width, height) {
            this._fillMode = mode;
            this.resizeCanvas(width, height);
        },

        /**
        * @function
        * @name pc.Application#setCanvasResolution
        * @description Change the resolution of the canvas, and set the way it behaves when the window is resized
        * In AUTO mode, the resolution is change to match the size of the canvas when the canvas resizes
        * In FIXED mode, the resolution remains until another call to setCanvasResolution()
        * @param {pc.ResolutionMode} mode The mode to use when setting the resolution
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
        * @param {DOMElement} [element] The element to display in fullscreen, if element is not provided the application canvas is used
        * @param {Function} [success] Function called if the request for fullscreen was successful
        * @param {Function} [error] Function called if the request for fullscreen was unsuccessful
        * @example
        * var canvas = document.getElementById('application-canvas');
        * var application = pc.Application.getApplication(canvas.id);
        * var button = document.getElementById('my-button');
        * button.addEventListener('click', function () {
        *     application.enableFullscreen(canvas, function () {
        *         console.log('fullscreen');
        *     }, function () {
        *         console.log('not fullscreen');
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
            element.requestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
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
        * @description Returns true if the window or tab in which the application is running in is not visible to the user.
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
            if (this.systems.rigidbody && typeof Ammo !== 'undefined') {
                var gravity = settings.physics.gravity;
                this.systems.rigidbody.setGravity(gravity[0], gravity[1], gravity[2]);
            }

            if (! this.scene)
                return;

            this.scene.applySettings(settings);

            if (settings.render.skybox && this._skyboxLast !== settings.render.skybox) {
                // unsubscribe of old skybox
                if (this._skyboxLast) {
                    this.assets.off('add:' + this._skyboxLast, this._onSkyboxAdd, this);
                    this.assets.off('load:' + this._skyboxLast, this._onSkyBoxLoad, this);
                    this.assets.off('remove:' + this._skyboxLast, this._onSkyboxRemove, this);
                }
                this._skyboxLast = settings.render.skybox;

                var asset = this.assets.get(settings.render.skybox);

                this.assets.on('load:' + settings.render.skybox, this._onSkyBoxLoad, this);
                this.assets.once('remove:' + settings.render.skybox, this._onSkyboxRemove, this);

                if (! asset)
                    this.assets.once('add:' + settings.render.skybox, this._onSkyboxAdd, this);

                if (asset) {
                    if (asset.resource)
                        this.scene.setSkybox(asset.resources);

                    this._onSkyboxAdd(asset);
                }
            } else if (! settings.render.skybox) {
                this._onSkyboxRemove({ id: this._skyboxLast });
            } else if (this.scene.skyboxMip === 0 && settings.render.skybox) {
                var asset = this.assets.get(settings.render.skybox);
                if (asset)
                    this._onSkyboxAdd(asset);
            }
        },

        _onSkyboxAdd: function(asset) {
            if (this.scene.skyboxMip === 0)
                asset.loadFaces = true;

            this.assets.load(asset);
        },

        _onSkyBoxLoad: function(asset) {
            this.scene.setSkybox(asset.resources);
        },

        _onSkyboxRemove: function(asset) {
            this.assets.off('add:' + asset.id, this._onSkyboxAdd, this);
            this.assets.off('load:' + asset.id, this._onSkyBoxLoad, this);
            this.scene.setSkybox(null);
            this._skyboxLast = null;
        },

        /**
        * @function
        * @name pc.Application#destroy
        * @description Destroys application and removes all event listeners
        */
        destroy: function () {
            Application._applications[this.graphicsDevice.canvas.id] = null;

            this.off('librariesloaded');
            document.removeEventListener('visibilitychange');
            document.removeEventListener('mozvisibilitychange');
            document.removeEventListener('msvisibilitychange');
            document.removeEventListener('webkitvisibilitychange');

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

            this.scene = null;

            this.systems = [];
            this.context = null;

            this.graphicsDevice = null;

            this.renderer = null;

            if (this._audioManager) {
                this._audioManager.destroy();
                this._audioManager = null;
            }

            pc.net.http = new pc.net.Http();
        }
    };

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
} ());
