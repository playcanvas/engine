pc.extend(pc.fw, function () {

    var time;

    /**
     * @name pc.fw.Application
     * @class Default application which performs general setup code and initiates the main game loop
     * @constructor Create a new Application
     * @param {DOMElement} canvas The canvas element
     * @param {Object} options
     * @param {pc.input.Controller} [options.controller] Generic input controller, available from the ApplicationContext as controller.
     * @param {pc.input.Keyboard} [options.keyboard] Keyboard handler for input, available from the ApplicationContext as keyboard.
     * @param {pc.input.Mouse} [options.mouse] Mouse handler for input, available from the ApplicationContext as mouse.
     * @param {Object} [options.libraries] List of URLs to javascript libraries which should be loaded before the application starts or any packs are loaded
     * @param {Boolean} [options.displayLoader] Display resource loader information during the loading progress. Debug only
     * @param {pc.common.DepotApi} [options.depot] API interface to the current depot
     * @param {String} [options.scriptPrefix] Prefix to apply to script urls before loading 
     *
     * @example
     * // Create application
     * var app = new pc.fw.Application(canvas, options);
     * // Start game loop
     * app.start()
     */
    var Application = function (canvas, options) {
        this._inTools = false;

        // Add event support
        pc.extend(this, pc.events);

        this.content = options.content;
        this.canvas = canvas;
        this.fillMode = pc.fw.FillMode.KEEP_ASPECT;
        this.resolutionMode = pc.fw.ResolutionMode.FIXED;
        this.librariesLoaded = false;

        this._link = new pc.fw.LiveLink("application");
        this._link.addDestinationWindow(window);
        this._link.listen(this._handleMessage.bind(this));

        // Open the log
        pc.log.open();

        // Create the graphics device
        this.graphicsDevice = new pc.gfx.Device(canvas);

        // Activate the graphics device
        pc.gfx.Device.setCurrent(this.graphicsDevice);        

        pc.gfx.post.initialize();

        // Enable validation of each WebGL command
        this.graphicsDevice.enableValidation(false);            

        var registry = new pc.fw.ComponentSystemRegistry();
    
        this.audioManager = new pc.audio.AudioManager();
        
		// Create resource loader
		var loader = new pc.resources.ResourceLoader();
        
        // Enable new texture bank feature to cache textures
        var textureCache = new pc.resources.TextureCache(loader);
        
        loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());
        loader.registerHandler(pc.resources.ModelRequest, new pc.resources.ModelResourceHandler(textureCache));
        loader.registerHandler(pc.resources.AnimationRequest, new pc.resources.AnimationResourceHandler());
        loader.registerHandler(pc.resources.PackRequest, new pc.resources.PackResourceHandler(registry, options.depot));
        loader.registerHandler(pc.resources.AudioRequest, new pc.resources.AudioResourceHandler(this.audioManager));

        // Display shows debug loading information. Only really fit for debug display at the moment.
        if (options.displayLoader) {
            var loaderdisplay = new pc.resources.ResourceLoaderDisplay(document.body, loader);
        }

		// The ApplicationContext is passed to new Components and user scripts
        this.context = new pc.fw.ApplicationContext(loader, new pc.scene.Scene(), registry, options);
    
        // Register the ScriptResourceHandler late as we need the context        
        loader.registerHandler(pc.resources.ScriptRequest, new pc.resources.ScriptResourceHandler(this.context, options.scriptPrefix));

        var animationsys = new pc.fw.AnimationComponentSystem(this.context);
        var bloomsys = new pc.fw.BloomComponentSystem(this.context);
        var modelsys = new pc.fw.ModelComponentSystem(this.context);
        var camerasys = new pc.fw.CameraComponentSystem(this.context);
        var cubemapsys = new pc.fw.CubeMapComponentSystem(this.context);
        var staticcubemapsys = new pc.fw.StaticCubeMapComponentSystem(this.context);
        var dlightsys = new pc.fw.DirectionalLightComponentSystem(this.context);
        var plightsys = new pc.fw.PointLightComponentSystem(this.context);
        var slightsys = new pc.fw.SpotLightComponentSystem(this.context);
        var primitivesys = new pc.fw.PrimitiveComponentSystem(this.context);
        var packsys = new pc.fw.PackComponentSystem(this.context);
        var skyboxsys = new pc.fw.SkyboxComponentSystem(this.context);
        var scriptsys = new pc.fw.ScriptComponentSystem(this.context);        
        var picksys = new pc.fw.PickComponentSystem(this.context);
        var audiosourcesys = new pc.fw.AudioSourceComponentSystem(this.context, this.audioManager);
        var audiolistenersys = new pc.fw.AudioListenerComponentSystem(this.context, this.audioManager);
        var designersys = new pc.fw.DesignerComponentSystem(this.context);

        // Load libraries
        this.on('librariesloaded', this.onLibrariesLoaded, this);
        if (options.libraries && options.libraries.length) {
            var requests = options.libraries.map(function (url) {
                return new pc.resources.ScriptRequest(url);
            });
            loader.request(requests).then( function (resources) {
                this.fire('librariesloaded', this);
                this.librariesLoaded = true;
            }.bind(this));
        } else {
            this.fire('librariesloaded', this);
            this.librariesLoaded = true;
        }

        // Depending on browser add the correct visibiltychange event and store the name of the hidden attribute
        // in this._hiddenAttr.
        if (typeof document.hidden !== 'undefined') {
            this._hiddenAttr = 'hidden';
            document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this), false);
        } else if (typeof document.mozHidden !== 'undefined') {  
            this._hiddenAttr = 'mozHidden';
            document.addEventListener('mozvisibilitychange', this.onVisibilityChange.bind(this), false);
        } else if (typeof document.msHidden !== 'undefined') {  
            this._hiddenAttr = 'msHidden';
            document.addEventListener('msvisibilitychange', this.onVisibilityChange.bind(this), false);
        } else if (typeof document.webkitHidden !== 'undefined') {  
            this._hiddenAttr = 'webkitHidden';
            document.addEventListener('webkitvisibilitychange', this.onVisibilityChange.bind(this), false);
        }

        // Store application instance
        Application._applications[this.canvas.id] = this;
    };

    Application._applications = {};
    Application.getApplication = function (id) {
        return Application._applications[id];
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

            // Populate the AssetCache and register hashes
            this.context.assets.update(toc, this.context.loader);

            for (var guid in toc.assets) {
                var asset = this.context.assets.getAsset(guid);
                // Create a request for all files
                requests.push(this.context.loader.createFileRequest(asset.getFileUrl(), asset.file.type));
                asset.subfiles.forEach(function (file, index) {
                    requests.push(this.context.loader.createFileRequest(asset.getSubAssetFileUrl(index), file.type));
                }.bind(this));
            }

            var onLoaded = function (resources) {
                // load pack 
                guid = toc.packs[0];
                
                this.context.loader.request(new pc.resources.PackRequest(guid)).then(function (resources) {
                    var pack = resources[0];
                    this.context.root.addChild(pack.hierarchy);
                    pc.fw.ComponentSystem.initialize(pack.hierarchy);
                    success(pack);
                    this.context.loader.off('progress', progress);
                }.bind(this), function (msg) {
                    error(msg);
                });
            }.bind(this);

            var load = function () {
                if (requests.length) {
                    // Start recording progress events now
                    this.context.loader.on('progress', progress);
                    // Request all asset files
                    this.context.loader.request(requests).then(function (resources) {
                        onLoaded(resources);
                    }, function (msg) {
                        error(msg);
                    });
                } else {
                    // No assets to load
                    setTimeout(function () {
                        onLoaded([]);
                    }, 0);
                }                
            }.bind(this);

            if (!this.librariesLoaded) {
                this.on('librariesloaded', function () {
                    load();
                });
            } else {
                load();
            }
        },

        // loadPack: function (guid, success, error, progress) {
        //     var load = function() {
        //         var request = new pc.resources.PackRequest(guid);
        //         this.context.loader.request(request, function (resources) {
        //             var pack = resources[guid];

        //             // add to hierarchy
        //             this.context.root.addChild(pack.hierarchy);
                    
        //             // Initialise any systems with an initialize() method after pack is loaded
        //             pc.fw.ComponentSystem.initialize(pack.hierarchy);
                    
        //             // callback
        //             if (success) {
        //                 success(pack);
        //             }
        //         }.bind(this), function (errors) {
        //             // error
        //             if (error) {
        //                 error(errors);
        //             }
        //         }.bind(this), function (value) {
        //             // progress
        //             if (progress) {
        //                 progress(value);
        //             }
        //         }.bind(this));
        //     }.bind(this);

        //     if (!this.librariesLoaded) {
        //         this.on('librariesloaded', function () {
        //             load();
        //         });
        //     } else {
        //         load();
        //     }
        // },

        /**
         * @function
         * @name pc.fw.Application#start
         * @description Start the Application updating
         */
        start: function () {
            if (!this.librariesLoaded) {
                this.on('librariesloaded', function () {
                    this.tick();
                }, this);
            } else {
                this.tick();    
            }
        },
        
        /**
         * @function
         * @name pc.fw.Application#update
         * @description Application specific update method. Override this if you have a custom Application
         * @param {Number} dt The time delta since the last frame.
         */
        update: function (dt) {
            var context = this.context;

            // Perform ComponentSystem update
            pc.fw.ComponentSystem.fixedUpdate(1.0 / 60.0, context, this._inTools);
            pc.fw.ComponentSystem.update(dt, context, this._inTools);
            pc.fw.ComponentSystem.postUpdate(dt, context, this._inTools);

            // fire update event
            this.fire("update", dt);

            if (context.controller) {
                context.controller.update(dt);
            }
            if (context.mouse) {
                context.mouse.update(dt);
            }
            if (context.keyboard) {
                context.keyboard.update(dt);
            }
            if (context.gamepads) {
                context.gamepads.update(dt);
            }
        },

        /** 
         * @function
         * @name pc.fw.Application#render
         * @description Application specific render method. Override this if you have a custom Application
         */
        render: function () {
            var context = this.context;

            context.root.syncHierarchy();

            pc.gfx.Device.setCurrent(this.graphicsDevice);

            var cameraEntity = context.systems.camera.current;
            if (cameraEntity) {
                context.systems.camera.frameBegin();

                context.scene.render(cameraEntity.camera.camera);

                context.systems.camera.frameEnd();            
            }
        },

        /** 
         * @function
         * @name pc.fw.Application#tick
         * @description Application specific tick method that calls update and render and queues
         * the next tick. Override this if you have a custom Application.
         */
        tick: function () {
            // Submit a request to queue up a new animation frame immediately
            requestAnimationFrame(this.tick.bind(this), this.canvas);

            var now = new Date().getTime();
            var dt = (now - (time || now)) / 1000.0;
 
            time = now;

            dt = pc.math.clamp(dt, 0, 0.1); // Maximum delta is 0.1s or 10 fps.
            
            this.update(dt);
            this.render();
        },

        /**
        * @function
        * @name pc.fw.Application#setCanvasFillMode()
        * @description Change the way the canvas fills the window and resizes when the window changes
        * In KEEP_ASPECT mode, the canvas will grow to fill the window as best it can while maintaining the aspect ratio
        * In FILL_WINDOW mode, the canvas will simply fill the window, changing aspect ratio
        * In NONE mode, the canvas will always match the size provided
        * @param {pc.fw.FillMode} mode The mode to use when setting the size of the canvas
        * @param {Number} [width] The width of the canvas, only used in NONE mode
        * @param {Number} [height] The height of the canvase, only used in NONE mode
        */
        setCanvasFillMode: function (mode, width, height) {
            this.fillMode = mode;
            this.resizeCanvas(width, height);
        },

        /**
        * @function
        * @name pc.fw.Application#setCanvasResolution()
        * @description Change the resolution of the canvas, and set the way it behaves when the window is resized
        * In AUTO mode, the resolution is change to match the size of the canvas when the canvas resizes
        * In FIXED mode, the resolution remains until another call to setCanvasResolution()
        * @param {pc.fw.ResolutionMode} mode The mode to use when setting the resolution
        * @param {Number} [width] The horizontal resolution, only used in FIXED mode
        * @param {Number} [height] The vertical resolution, only used in FIXED mode
        */ 
        setCanvasResolution: function (mode, width, height) {
            this.resolutionMode = mode;

            // In AUTO mode the resolution is the same as the canvas size
            if (mode === pc.fw.ResolutionMode.AUTO) {
                width = this.canvas.clientWidth;
                height = this.canvas.clientHeight;
            }

            this.canvas.width = width;
            this.canvas.height = height;
        },

        /**
        * @function
        * @name pc.fw.Application#isFullscreen
        * @description Returns true if the application is currently running fullscreen
        * @returns {Boolean} True if the application is running fullscreen
        */
        isFullscreen: function () {
            return !!document.fullscreenElement;
        },

        /**
        * @function
        * @name pc.fw.Application#enableFullscreen
        * @description Request that the browser enters fullscreen mode. This is not available on all browsers.
        * Note: Switching to fullscreen can only be initiated by a user action, e.g. in the event hander for a mouse or keyboard input
        * @param {DOMElement} [element] The element to display in fullscreen, if element is not provided the application canvas is used
        * @param {Function} [success] Function called if the request for fullscreen was successful
        * @param {Function} [error] Function called if the request for fullscreen was unsuccessful
        * @example
        * var canvas = document.getElementById('application-canvas');
        * var application = pc.fw.Application.getApplication(canvas.id);
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
            element = element || this.canvas;
                
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
            element.requestFullscreen();
        },

        /**
        * @function
        * @name pc.fw.Application#disableFullscreen
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
        * @name pc.fw.Application#isHidden
        * @description Returns true if the window or tab in which the application is running in is not visible to the user.
        */ 
        isHidden: function () {
            return document[this._hiddenAttr];
        },

        /**
        * @private
        * @function
        * @name pc.fw.Application#onVisibilityChange
        * @description Called when the visibility state of the current tab/window changes
        */
        onVisibilityChange: function (e) {
            if (this.isHidden()) {
                this.audioManager.suspend();
            } else {
                this.audioManager.resume();
            }
        },

        /**
        * @function
        * @name pc.fw.Application#resizeCanvas
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

            if (this.fillMode === pc.fw.FillMode.KEEP_ASPECT) {
                var r = this.canvas.width/this.canvas.height;
                var winR = windowWidth / windowHeight;

                if (r > winR) {
                    width = windowWidth;
                    height = width / r ;

                    //var marginTop = (windowHeight - height) / 2;
                    //this.container.style.margin = marginTop + "px auto";
                } else {
                    height = windowHeight;
                    width = height * r;

                    //this.container.style.margin = "auto auto";
                }
            } else if (this.fillMode === pc.fw.FillMode.FILL_WINDOW) {
                width = windowWidth;
                height = windowHeight;
            } else {
                // FillMode.NONE use width and height that are provided
            }

            this.canvas.style.width = width + 'px';
            this.canvas.style.height = height + 'px';

            // In AUTO mode the resolution is changed to match the canvas size
            if (this.resolutionMode === pc.fw.ResolutionMode.AUTO) {
                this.setCanvasResolution(pc.fw.ResolutionMode.AUTO);
            }

            // return the final values calculated for width and height
            return {
                width: width,
                height: height
            };
        },

        /**
        * @private
        * @name pc.fw.Application#onLibrariesLoaded
        * @description Event handler called when all code libraries have been loaded
        * Code libraries are passed into the constructor of the Application and the application won't start running or load packs until all libraries have
        * been loaded
        */
        onLibrariesLoaded: function () {
            // Create systems that may require external libraries
            var body2dsys = new pc.fw.Body2dComponentSystem(this.context);    
            var collisionrectsys = new pc.fw.CollisionRectComponentSystem(this.context);
            var collisioncirclesys = new pc.fw.CollisionCircleComponentSystem(this.context);

            var rigidbodysys = new pc.fw.RigidBodyComponentSystem(this.context);    
            var collisionboxsys = new pc.fw.CollisionBoxComponentSystem(this.context);
            var collisioncapsulesys = new pc.fw.CollisionCapsuleComponentSystem(this.context);
            var collisionmeshsys = new pc.fw.CollisionMeshComponentSystem(this.context);
            var collisionspheresys = new pc.fw.CollisionSphereComponentSystem(this.context);
        },

        /**
         * @function
         * @name pc.fw.Application#_handleMessage
         * @description Called when the LiveLink object receives a new message
         * @param {pc.fw.LiveLiveMessage} msg The received message
         */
        _handleMessage: function (msg) {
            var entity;

            switch(msg.type) {
                case pc.fw.LiveLinkMessageType.UPDATE_COMPONENT:
                    this._linkUpdateComponent(msg.content.id, msg.content.component, msg.content.attribute, msg.content.value);
                    break;
                case pc.fw.LiveLinkMessageType.UPDATE_ENTITY:
                    this._linkUpdateEntity(msg.content.id, msg.content.components);
                    break;
                case pc.fw.LiveLinkMessageType.UPDATE_ENTITY_TRANSFORM:
                    this._linkUpdateEntityTransform(msg.content.id, msg.content.position, msg.content.rotation, msg.content.scale);
                    break;
                case pc.fw.LiveLinkMessageType.UPDATE_ENTITY_NAME:
                    entity = this.context.root.findOne("getGuid", msg.content.id);
                    entity.setName(msg.content.name);
                    break;
                case pc.fw.LiveLinkMessageType.REPARENT_ENTITY:
                    this._linkReparentEntity(msg.content.id, msg.content.newParentId, msg.content.index);
                    break;
                case pc.fw.LiveLinkMessageType.CLOSE_ENTITY:
                    entity = this.context.root.findOne("getGuid", msg.content.id);
                    if(entity) {
                        logDEBUG(pc.string.format("RT: Removed '{0}' from parent {1}", msg.content.id, entity.getParent().getGuid())); 
                        entity.destroy();
                    }
                    break;
                case pc.fw.LiveLinkMessageType.OPEN_ENTITY:
                    var parent;
                    var entities = {};
                    var guid = null;
                    if (msg.content.entity) {
                        // Create a fake little pack to open the entity hierarchy
                        var pack = {
                            application_data: {},
                            hierarchy: msg.content.entity
                        };
                        pack = this.context.loader.open(pc.resources.PackRequest, pack);

                        // Get the root entity back from the fake pack
                        entity = pack.hierarchy;
                        if (entity.__parent) {
                            parent = this.context.root.findByGuid(entity.__parent);
                            parent.addChild(entity);
                        } else {
                            this.context.root.addChild(entity);
                        }
                    }
                    // if (msg.content.models) { // use old method that expects a flattened list and loads using EntityRequest
                    //     var i, len = msg.content.models.length;

                    //     for (i = 0; i < len; i++) {
                    //         var model = msg.content.models[i];
                    //         entity = this.context.loader.open(pc.resources.EntityRequest, model);
                    //         entities[entity.getGuid()] = entity;
                    //     }
                        
                    //     for (guid in entities) {
                    //         if (entities.hasOwnProperty(guid)) {
                    //             pc.resources.EntityResourceHandler.patchChildren(entities[guid], entities);
                    //             if (!entities[guid].__parent) {
                    //                 // If entity has no parent add to the root
                    //                 this.context.root.addChild(entities[guid]);
                    //             } else if (!entities[entities[guid].__parent]) {
                    //                 // If entity has a parent in the existing tree add it (if entities[__parent] exists then this step will be performed in patchChildren for the parent)
                    //                 parent = this.context.root.findByGuid(entities[guid].__parent);
                    //                 parent.addChild(entities[guid]);
                    //             }
                    //         }
                    //     }
                    // }
                break;
            }
        },

        /**
         * @function
         * @name pc.fw.Application#_linkUpdateComponent
         * @description Update a value on a component, 
         * @param {String} guid GUID for the entity
         * @param {String} componentName name of the component to update
         * @param {String} attributeName name of the attribute on the component
         * @param {Object} value - value to set attribute to
         */
        _linkUpdateComponent: function(guid, componentName, attributeName, value) {
            var entity = this.context.root.findOne("getGuid", guid);
            //var system;
                
            if (entity) {
                if(componentName) {
                    //system = this.context.systems[componentName];
                    if(entity[componentName]) {
                        entity[componentName][attributeName] = value;
                        //system.set(entity, attributeName, value);
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
            var entity = this.context.root.findByGuid(guid);
            if(entity) {
                entity.setLocalPosition(position);
                entity.setLocalEulerAngles(rotation);
                entity.setLocalScale(scale);

                // Fire event to notify listeners that the transform has been changed by an external tool
                entity.fire('livelink:updatetransform', position, rotation, scale);
            }
        },
        
        _linkReparentEntity: function (guid, parentId, index) {
            var entity = this.context.root.findByGuid(guid);
            var parent = this.context.root.findByGuid(parentId);
            // TODO: use index to insert child into child list
            entity.reparent(parent);    
        },
        
        /**
         * @function
         * @name pc.fw.Application#_updateEntity
         * @description Update an Entity from a set of components, deletes components that are no longer there, adds components that are new.
         * Note this does not update the data inside the components, just whether or not a component is present.
         * @param {Object} guid GUID of the entity
         * @param {Object} components Component object keyed by component name.
         */
        _linkUpdateEntity: function (guid, components) {
            var type;
            var entity = this.context.root.findOne("getGuid", guid);
            
            if(entity) {
                var order = this.context.systems.getComponentSystemOrder(); 

                var i, len = order.length;
                for(i = 0; i < len; i++) {
                    type = order[i];
                    if(components.hasOwnProperty(type) && this.context.systems.hasOwnProperty(type)) {
                        if (!entity[type]) {
                            this.context.systems[type].addComponent(entity, {});
                        }
                    }
                }
                
                for(type in this.context.systems) {
                    if(type === "gizmo" || type === "pick") {
                        continue;
                    }

                    if(this.context.systems.hasOwnProperty(type)) {
                        if(!components.hasOwnProperty(type) && entity[type]) {
                            this.context.systems[type].removeComponent(entity);
                        }
                    }
                }
            }
        }
    };

    // Shim the Fullscreen API
    (function () {
        if (typeof document === 'undefined') {
            // Not running in a browser
            return;
        }

        // Events
        var fullscreenchange = function () {
            var e = document.createEvent('CustomEvent');
            e.initCustomEvent('fullscreenchange', true, false, null);
            document.dispatchEvent(e);
        };

        var fullscreenerror = function () {
            var e = document.createEvent('CustomEvent');
            e.initCustomEvent('fullscreenerror', true, false, null);
            document.dispatchEvent(e);
        };

        document.addEventListener('webkitfullscreenchange', fullscreenchange, false);
        document.addEventListener('mozfullscreenchange', fullscreenchange, false);
        document.addEventListener('webkitfullscreenerror', fullscreenerror, false);
        document.addEventListener('mozfullscreenerror', fullscreenerror, false);

        if (Element.prototype.mozRequestFullScreen) {
            // FF requires a new function for some reason
            Element.prototype.requestFullscreen = function () {
                this.mozRequestFullScreen();
            };
        } else {
            Element.prototype.requestFullscreen = Element.prototype.requestFullscreen || Element.prototype.webkitRequestFullscreen || function () {};    
        }
        document.exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
        if (!document.fullscreenElement) {
            Object.defineProperty(document, 'fullscreenElement', {
                enumerable: true, 
                configurable: false, 
                get: function () {
                    return document.webkitCurrentFullScreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
                }
            });
        }
        
        if (!document.fullscreenEnabled) {
            Object.defineProperty(document, 'fullscreenEnabled', {
                enumerable: true,
                configurable: false,
                get: function () {
                    return document.webkitFullscreenEnabled || document.mozFullScreenEnabled;
                }
            });
        }

    }());

    return {
        FillMode: {
            NONE: 'NONE',
            FILL_WINDOW: 'FILL_WINDOW',
            KEEP_ASPECT: 'KEEP_ASPECT'
        },
        ResolutionMode: {
            AUTO: 'AUTO',
            FIXED: 'FIXED'
        },
        Application: Application
    };
    
} ());




