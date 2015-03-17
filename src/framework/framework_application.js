pc.extend(pc, function () {

    /**
     * @name pc.Application
     * @class Default application which performs general setup code and initiates the main game loop
     * @constructor Create a new Application
     * @param {DOMElement} canvas The canvas element
     * @param {Object} options
     * @param {pc.Controller} [options.controller] Generic input controller
     * @param {pc.Keyboard} [options.keyboard] Keyboard handler for input
     * @param {pc.Mouse} [options.mouse] Mouse handler for input
     * @param {Object} [options.libraries] List of URLs to javascript libraries which should be loaded before the application starts or any packs are loaded
     * @param {Boolean} [options.displayLoader] Display resource loader information during the loading progress. Debug only
     * @param {pc.common.DepotApi} [options.depot] API interface to the current depot
     * @param {String} [options.scriptPrefix] Prefix to apply to script urls before loading
     *
     * @example
     * // Create application
     * var app = new pc.Application(canvas, options);
     * // Start game loop
     * app.start()
     * @property {Number} timeScale Scales the global time delta.
     */
    var Application = function (canvas, options) {
        options = options || {};

        // Open the log
        pc.log.open();
        // Add event support
        pc.events.attach(this);

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
        this.loader = new pc.resources.ResourceLoader();

        this.scene = new pc.Scene();
        this.root = new pc.fw.Entity(this);
        this.assets = new pc.asset.AssetRegistry(this.loader);
        this.renderer = new pc.ForwardRenderer(this.graphicsDevice);

        this.keyboard = options.keyboard || null;
        this.mouse = options.mouse || null;
        this.touch = options.touch || null;
        this.gamepads = options.gamepads || null;

        this.content = null;

        this._inTools = false;
        this._link = new pc.LiveLink("application");
        this._link.addDestinationWindow(window);
        this._link.listen(this._handleMessage.bind(this));


        if( options.cache === false ) {
            this.loader.cache = false;
        }

        // Display shows debug loading information. Only really fit for debug display at the moment.
        if (options.displayLoader) {
            var loaderdisplay = new pc.resources.ResourceLoaderDisplay(document.body, this.loader);
        }


        if (options.content) {
            this.content = options.content;
            // Add the assets from all TOCs to the
            Object.keys(this.content.toc).forEach(function (key) {
                this.assets.addGroup(key, this.content.toc[key]);
            }.bind(this));
        }

        // Enable new texture bank feature to cache textures
        var textureCache = new pc.resources.TextureCache(this.loader);

        this.loader.registerHandler(pc.resources.JsonRequest, new pc.resources.JsonResourceHandler());
        this.loader.registerHandler(pc.resources.TextRequest, new pc.resources.TextResourceHandler());
        this.loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());
        this.loader.registerHandler(pc.resources.MaterialRequest, new pc.resources.MaterialResourceHandler(this.graphicsDevice, this.assets));
        this.loader.registerHandler(pc.resources.TextureRequest, new pc.resources.TextureResourceHandler(this.graphicsDevice, this.assets));
        this.loader.registerHandler(pc.resources.CubemapRequest, new pc.resources.CubemapResourceHandler(this.graphicsDevice, this.assets));
        this.loader.registerHandler(pc.resources.ModelRequest, new pc.resources.ModelResourceHandler(this.graphicsDevice, this.assets));
        this.loader.registerHandler(pc.resources.AnimationRequest, new pc.resources.AnimationResourceHandler());
        this.loader.registerHandler(pc.resources.PackRequest, new pc.resources.PackResourceHandler(this, options.depot));
        this.loader.registerHandler(pc.resources.AudioRequest, new pc.resources.AudioResourceHandler(this._audioManager));
        this.loader.registerHandler(pc.resources.ScriptRequest, new pc.resources.ScriptResourceHandler(this, options.scriptPrefix));

        var rigidbodysys = new pc.RigidBodyComponentSystem(this);
        var collisionsys = new pc.CollisionComponentSystem(this);
        var ballsocketjointsys = new pc.BallSocketJointComponentSystem(this);
        var animationsys = new pc.AnimationComponentSystem(this);
        var modelsys = new pc.ModelComponentSystem(this);
        var camerasys = new pc.CameraComponentSystem(this);
        var lightsys = new pc.LightComponentSystem(this);
        var packsys = new pc.PackComponentSystem(this);
        var skyboxsys = new pc.SkyboxComponentSystem(this);
        var scriptsys = new pc.ScriptComponentSystem(this);
        var picksys = new pc.PickComponentSystem(this);
        var audiosourcesys = new pc.AudioSourceComponentSystem(this, this._audioManager);
        var audiolistenersys = new pc.AudioListenerComponentSystem(this, this._audioManager);
        var particlesystemsys = new pc.ParticleSystemComponentSystem(this);
        var designersys = new pc.DesignerComponentSystem(this);

        // Load libraries
        this.on('librariesloaded', this.onLibrariesLoaded, this);
        if (options.libraries && options.libraries.length) {
            var requests = options.libraries.map(function (url) {
                return new pc.resources.ScriptRequest(url);
            });
            this.loader.request(requests).then( function (resources) {
                this.fire('librariesloaded', this);
                this._librariesLoaded = true;
            }.bind(this));
        } else {
            this.fire('librariesloaded', this);
            this._librariesLoaded = true;
        }

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

        // Store application instance
        Application._applications[this.graphicsDevice.canvas.id] = this;
        Application._currentApplication = this;
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

    Application.prototype = {
        /**
        * Load a pack and asset set from a table of contents config
        * @param {String} name The name of the Table of Contents block to load
        */
        loadFromToc: function (name, success, error, progress) {
            if (!this.content) {
                error('No content');
            }

            var toc = this.content.toc[name];

            success = success || function () {};
            error = error || function () {};
            progress = progress || function () {};

            var requests = [];

            var guid = toc.packs[0];

            var onLoaded = function (resources) {
                // load pack
                this.loader.request(new pc.resources.PackRequest(guid)).then(function (resources) {
                    var pack = resources[0];
                    this.root.addChild(pack.hierarchy);
                    pc.ComponentSystem.initialize(pack.hierarchy);
                    pc.ComponentSystem.postInitialize(pack.hierarchy);

                    // Initialise pack settings
                    if (this.systems.rigidbody && typeof Ammo !== 'undefined') {
                        var gravity = pack.settings.physics.gravity;
                        this.systems.rigidbody.setGravity(gravity[0], gravity[1], gravity[2]);
                    }

                    var ambientLight = pack.settings.render.global_ambient;
                    this.scene.ambientLight = new pc.Color(ambientLight[0], ambientLight[1], ambientLight[2]);

                    this.scene.fog = pack.settings.render.fog;
                    var fogColor = pack.settings.render.fog_color;
                    this.scene.fogColor = new pc.Color(fogColor[0], fogColor[1], fogColor[2]);
                    this.scene.fogStart = pack.settings.render.fog_start;
                    this.scene.fogEnd = pack.settings.render.fog_end;
                    this.scene.fogDensity = pack.settings.render.fog_density;
                    this.scene.gammaCorrection = pack.settings.render.gamma_correction;
                    this.scene.toneMapping = pack.settings.render.tonemapping;
                    this.scene.exposure = pack.settings.render.exposure;

                    if (pack.settings.render.skybox) {
                        var skybox = this.assets.getAssetById(pack.settings.render.skybox);
                        this.scene.skybox = skybox ? skybox.resource : null;
                    }

                    success(pack);
                    this.loader.off('progress', progress);
                }.bind(this), function (msg) {
                    error(msg);
                }).then(null, function (error) {
                    // Re-throw any exceptions from the script's initialize method to stop them being swallowed by the Promises lib
                    setTimeout(function () {
                        throw error;
                    }, 0);
                });
            }.bind(this);

            var load = function () {
                // Get a list of asset for the first Pack
                var assets = this.assets.list(guid);

                // start recording loading progress from here
                this.loader.on('progress', progress);

                if (assets.length) {
                    this.assets.load(assets).then(function (resources) {
                        onLoaded(resources);
                    });
                } else {
                    // No assets to load
                    setTimeout(function () {
                        onLoaded([]);
                    }, 0);
                }
            }.bind(this);

            if (!this._librariesLoaded) {
                this.on('librariesloaded', function () {
                    load();
                });
            } else {
                load();
            }
        },


        /**
         * @function
         * @name pc.Application#start
         * @description Start the Application updating
         */
        start: function () {
            if (!this._librariesLoaded) {
                this.on('librariesloaded', function () {
                    this.tick();
                }, this);
            } else {
                this.tick();
            }
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

                var ratio = window.devicePixelRatio;
                this.graphicsDevice.resizeCanvas(width * ratio, height * ratio);
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
            this.systems.rigidbody.onLibraryLoaded();
            this.systems.collision.onLibraryLoaded();
        },

        /**
         * @function
         * @name pc.Application#_handleMessage
         * @description Called when the LiveLink object receives a new message
         * @param {pc.LiveLiveMessage} msg The received message
         */
        _handleMessage: function (msg) {
            var entity;

            switch(msg.type) {
                case pc.LiveLinkMessageType.UPDATE_COMPONENT:
                    this._linkUpdateComponent(msg.content.id, msg.content.component, msg.content.attribute, msg.content.value);
                    break;
                case pc.LiveLinkMessageType.UPDATE_ENTITY:
                    this._linkUpdateEntity(msg.content.id, msg.content.components);
                    break;
                case pc.LiveLinkMessageType.UPDATE_ENTITY_TRANSFORM:
                    this._linkUpdateEntityTransform(msg.content.id, msg.content.position, msg.content.rotation, msg.content.scale);
                    break;
                case pc.LiveLinkMessageType.UPDATE_ENTITY_NAME:
                    entity = this.root.findOne("getGuid", msg.content.id);
                    entity.setName(msg.content.name);
                    break;
                case pc.LiveLinkMessageType.UPDATE_ENTITY_ENABLED:
                    entity = this.root.findOne("getGuid", msg.content.id);
                    entity.enabled = msg.content.enabled;
                    break;
                case pc.LiveLinkMessageType.REPARENT_ENTITY:
                    this._linkReparentEntity(msg.content.id, msg.content.newParentId, msg.content.index);
                    break;
                case pc.LiveLinkMessageType.CLOSE_ENTITY:
                    entity = this.root.findOne("getGuid", msg.content.id);
                    if(entity) {
                        logDEBUG(pc.string.format("RT: Removed '{0}' from parent {1}", msg.content.id, entity.getParent().getGuid()));
                        entity.destroy();
                    }
                    break;
                case pc.LiveLinkMessageType.OPEN_PACK:
                    var pack = this.loader.open(pc.resources.PackRequest, msg.content.pack);

                    // Get the root entity back from the fake pack
                    var entity = pack.hierarchy;
                    if (entity.__parent) {
                        parent = this.root.findByGuid(entity.__parent);
                        parent.addChild(entity);
                    } else {
                        this.root.addChild(entity);
                    }
                    break;
                case pc.LiveLinkMessageType.OPEN_ENTITY:
                    var parent;
                    var entities = {};
                    var guid = null;
                    if (msg.content.entity) {
                        // Create a fake little pack to open the entity hierarchy
                        var pack = {
                            application_data: {},
                            hierarchy: msg.content.entity
                        };
                        pack = this.loader.open(pc.resources.PackRequest, pack);

                        // Get the root entity back from the fake pack
                        entity = pack.hierarchy;
                        if (entity.__parent) {
                            parent = this.root.findByGuid(entity.__parent);
                            parent.addChild(entity);
                        } else {
                            this.root.addChild(entity);
                        }
                    }
                    break;
                case pc.LiveLinkMessageType.UPDATE_ASSET:
                    this._linkUpdateAsset(msg.content.id, msg.content.attribute, msg.content.value);
                    break;

                case pc.LiveLinkMessageType.UPDATE_ASSETCACHE:
                    var id;
                    var asset;

                    // Add new and Update existing assets
                    for (id in msg.content.assets) {
                        asset = this.assets.getAssetById(id);
                        if (!asset) {
                            this.assets.createAndAddAsset(id, msg.content.assets[id]);
                        } else {
                            var data = msg.content.assets[id];
                            for (var key in data) {
                                if (data.hasOwnProperty(key)) {
                                    asset[key] = data[key];
                                }
                            }
                        }
                    }

                    // Delete removed assets
                    for (id in msg.content.deleted) {
                        asset = this.assets.getAssetById(id);
                        if (asset) {
                            this.assets.removeAsset(asset);
                        }
                    }

                    break;

                case pc.LiveLinkMessageType.UPDATE_PACK_SETTINGS:
                    this._linkUpdatePackSettings(msg.content.settings);
                    break;
            }
        },

        /**
         * @function
         * @name pc.Application#_linkUpdateComponent
         * @description Update a value on a component,
         * @param {String} guid GUID for the entity
         * @param {String} componentName name of the component to update
         * @param {String} attributeName name of the attribute on the component
         * @param {Object} value - value to set attribute to
         */
        _linkUpdateComponent: function(guid, componentName, attributeName, value) {
            var entity = this.root.findOne("getGuid", guid);
            var attribute;

            if (entity) {
                if(componentName) {
                    if(entity[componentName]) {
                        attribute = designer.link.exposed[componentName][attributeName];
                        if (designer && attribute) {
                            // Override Type provided
                            if (attribute.RuntimeType) {
                                    if (attribute.RuntimeType === pc.Vec3) {
                                        entity[componentName][attributeName] = new attribute.RuntimeType(value[0], value[1], value[2]);
                                    } else if (attribute.RuntimeType === pc.Vec4) {
                                        entity[componentName][attributeName] = new attribute.RuntimeType(value[0], value[1], value[2], value[3]);
                                    } else if (attribute.RuntimeType === pc.Vec2) {
                                        entity[componentName][attributeName] = new attribute.RuntimeType(value[0], value[1]);
                                    } else if (attribute.RuntimeType === pc.Color) {
                                        if (value.length === 3) {
                                            entity[componentName][attributeName] = new attribute.RuntimeType(value[0], value[1], value[2]);
                                        } else {
                                            entity[componentName][attributeName] = new attribute.RuntimeType(value[0], value[1], value[2], value[3]);
                                        }
                                    } else if (attribute.RuntimeType === pc.Curve || attribute.RuntimeType === pc.CurveSet) {
                                        entity[componentName][attributeName] = new attribute.RuntimeType(value.keys);
                                        entity[componentName][attributeName].type = value.type;
                                    } else {
                                        entity[componentName][attributeName] = new attribute.RuntimeType(value);
                                    }
                            } else {
                                entity[componentName][attributeName] = value;
                            }
                        } else {
                            entity[componentName][attributeName] = value;
                        }


                    } else {
                        logWARNING(pc.string.format("No component system called '{0}' exists", componentName));
                    }
                } else {
                    // set value on node
                    entity[attributeName] = value;
                }
            }
        },

        _linkUpdateEntityTransform: function (guid, position, rotation, scale) {
            var entity = this.root.findByGuid(guid);
            if(entity) {
                entity.setLocalPosition(position[0], position[1], position[2]);
                entity.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
                entity.setLocalScale(scale[0], scale[1], scale[2]);

                // Fire event to notify listeners that the transform has been changed by an external tool
                entity.fire('livelink:updatetransform', position, rotation, scale);
            }
        },

        _linkReparentEntity: function (guid, parentId, index) {
            var entity = this.root.findByGuid(guid);
            var parent = this.root.findByGuid(parentId);
            entity.reparent(parent, index);
        },

        /**
         * @function
         * @name pc.Application#_updateEntity
         * @description Update an Entity from a set of components, deletes components that are no longer there, adds components that are new.
         * Note this does not update the data inside the components, just whether or not a component is present.
         * @param {Object} guid GUID of the entity
         * @param {Object} components Component object keyed by component name.
         */
        _linkUpdateEntity: function (guid, components) {
            var type;
            var entity = this.root.findOne("getGuid", guid);

            if(entity) {
                var order = this.systems.getComponentSystemOrder();

                var i, len = order.length;
                for(i = 0; i < len; i++) {
                    type = order[i];
                    if(components.hasOwnProperty(type) && this.systems.hasOwnProperty(type)) {
                        if (!entity[type]) {
                            this.systems[type].addComponent(entity, {});
                        }
                    }
                }

                for(type in this.systems) {
                    if(type === "gizmo" || type === "pick") {
                        continue;
                    }

                    if(this.systems.hasOwnProperty(type)) {
                        if(!components.hasOwnProperty(type) && entity[type]) {
                            this.systems[type].removeComponent(entity);
                        }
                    }
                }
            }
        },

        _linkUpdateAsset: function (id, attribute, value) {
            var asset = this.assets.getAssetById(id);
            if (asset) {
                asset[attribute] = value;
            }
        },

        _linkUpdatePackSettings: function (settings) {
            var ambient = settings.render.global_ambient;
            this.scene.ambientLight.set(ambient[0], ambient[1], ambient[2]);

            if (this.systems.rigidbody && typeof Ammo !== 'undefined') {
                var gravity = settings.physics.gravity;
                this.systems.rigidbody.setGravity(gravity[0], gravity[1], gravity[2]);
            }

            this.scene.fog = settings.render.fog;
            this.scene.fogStart = settings.render.fog_start;
            this.scene.fogEnd = settings.render.fog_end;

            var fog = settings.render.fog_color;
            this.scene.fogColor = new pc.Color(fog[0], fog[1], fog[2]);
            this.scene.fogDensity = settings.render.fog_density;

            this.scene.gammaCorrection = settings.render.gamma_correction;
            this.scene.toneMapping = settings.render.tonemapping;
            this.scene.exposure = settings.render.exposure;

            if (settings.render.skybox) {
                var skybox = this.assets.getAssetById(settings.render.skybox);
                if (!skybox) {
                    pc.log.error('Could not initialize scene skybox. Missing cubemap asset ' + settings.render.skybox);
                } else {
                    if (!skybox.resource) {
                        this.assets.load([skybox]).then(function (resources){
                            this.scene.skybox = resources[0];
                        }.bind(this), function (error) {
                            pc.log.error('Could not initialize scene skybox. Missing cubemap asset ' + settings.render.skybox);
                        });
                    } else {
                        this.scene.skybox = skybox.resource;
                    }
                }
            } else {
                this.scene.skybox = null;
            }
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




