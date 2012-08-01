pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.Application
     * @class Default application which performs general setup code and initiates the main game loop
     * <pre class="code" lang="javascript">
     * // Create application
     * var app = new pc.fw.Application(canvas, options);
     * // Start game loop
     * app.start()
     * </pre>
     * 
     * To create custom applications derive a new Application class and override the update and render methods
     * 
     * <pre class="code" lang="javascript">
     * var MyApplication = function () {
     * };
     * MyApplication = pc.inherits(MyApplication, pc.fw.Application);
     * 
     * MyApplication.prototype.update = function () {
     *   // custom update code
     * }
     * 
     * MyApplication.prototype.render = function () {
     *   // custom render code
     * }
     * 
     * var app = new MyApplication(canvas, options);
     * app.start();
     * </pre>
     * @constructor Create a new Application
     * @param {DOMElement} canvas The canvas element
     * @param {Object} options
     * @param {String} options.dataDir Path to the directory where data is.
     * @param {Object} [options.config] Configuration options for the application
     * @param {pc.common.DepotApi} [options.depot] API interface to the current depot
     * @param {pc.input.Controller} [options.controller] Generic input controller, available from the ApplicationContext as controller.
     * @param {pc.input.Keyboard} [options.keyboard] Keyboard handler for input, available from the ApplicationContext as keyboard.
     * @param {pc.input.Mouse} [options.mouse] Mouse handler for input, available from the ApplicationContext as mouse.
     * @param {Boolean} [options.displayLoader] Display resource loader information during the loading progress. Debug only
     */
    var Application = function (canvas, options) {
        this._inTools = false;

        this.canvas = canvas;
        this.fillMode = pc.fw.FillMode.KEEP_ASPECT;
        this.resolutionMode = pc.fw.ResolutionMode.FIXED;

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
        
        var scriptPrefix = (options.config && options.config['script_prefix']) ? options.config['script_prefix'] : "";

		// Create resource loader
		var loader = new pc.resources.ResourceLoader();
        
        // Enable new texture bank feature to cache textures
        var textureCache = new pc.resources.TextureCache(loader);
        
        loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());
        //loader.registerHandler(pc.resources.TextureRequest, new pc.resources.TextureResourceHandler());
        loader.registerHandler(pc.resources.ModelRequest, new pc.resources.ModelResourceHandler(textureCache));
        loader.registerHandler(pc.resources.AnimationRequest, new pc.resources.AnimationResourceHandler());
        loader.registerHandler(pc.resources.EntityRequest, new pc.resources.EntityResourceHandler(registry, options.depot));
        loader.registerHandler(pc.resources.PackRequest, new pc.resources.PackResourceHandler(registry, options.depot));
        loader.registerHandler(pc.resources.AssetRequest, new pc.resources.AssetResourceHandler(options.depot));
        loader.registerHandler(pc.resources.AudioRequest, new pc.resources.AudioResourceHandler(this.audioManager));

        // Display shows debug loading information. Only really fit for debug display at the moment.
        if (options['displayLoader']) {
            var loaderdisplay = new pc.resources.ResourceLoaderDisplay(document.body, loader);
        }

		// The ApplicationContext is passed to new Components and user scripts
        this.context = new pc.fw.ApplicationContext(loader, new pc.scene.Scene(), registry, options);
    
        // Register the ScriptResourceHandler late as we need the context        
        loader.registerHandler(pc.resources.ScriptRequest, new pc.resources.ScriptResourceHandler(this.context, scriptPrefix));

        // Create systems
        var animationsys = new pc.fw.AnimationComponentSystem(this.context);
        var bloomsys = new pc.fw.BloomComponentSystem(this.context);
        var headersys = new pc.fw.HeaderComponentSystem(this.context);
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
        //var simplebodysys = new pc.fw.SimpleBodyComponentSystem(this.context);
        var picksys = new pc.fw.PickComponentSystem(this.context);
        var audiosourcesys = new pc.fw.AudioSourceComponentSystem(this.context, this.audioManager);
        var audiolistenersys = new pc.fw.AudioListenerComponentSystem(this.context, this.audioManager);
        var designersys = new pc.fw.DesignerComponentSystem(this.context);
        if (typeof(Box2D) !== "undefined") {
            // Only include the Body2d component system if box2d library is loaded
            var body2dsys = new pc.fw.Body2dComponentSystem(this.context);    
            var collisionrectsys = new pc.fw.CollisionRectComponentSystem(this.context);
            var collisioncirclesys = new pc.fw.CollisionCircleComponentSystem(this.context);
        }

        // Add event support
        pc.extend(this, pc.events);

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
   };
    
    Application.prototype = {
        /**
         * @function
         * @name pc.fw.Application#start
         * @description Start the Application updating
         */
        start: function () {
            this.tick();
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
            pc.fw.ComponentSystem.update(dt, context, this._inTools);
            pc.fw.ComponentSystem.updateFixed(1.0 / 60.0, context, this._inTools);

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

            var currentCamera = context.systems.camera.getCurrent();
            if (currentCamera) {
                context.systems.camera.frameBegin();

                pc.fw.ComponentSystem.render(context, this._inTools);
                var camera = context.systems.camera.get(currentCamera, 'camera');
                context.scene.dispatch(camera);
                context.scene.flush();

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
            this.lastTime = this.currTime || Date.now();
            this.currTime = Date.now();

            var dt = (this.currTime - this.lastTime) * 0.001;
            dt = pc.math.clamp(dt, 0, 0.1); // Maximum delta is 0.1s or 10 fps.
            
            this.update(dt);
            this.render();

            // Submit a request to queue up a new animation frame immediately
            requestAnimFrame(this.tick.bind(this), this.canvas);
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
                width = this.canvas.style.width;
                height = this.canvas.style.height;
            }

            this.canvas.width = width;
            this.canvas.height = height;
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
         * @function
         * @name pc.fw.Application#_handleMessage
         * @description Called when the LiveLink object receives a new message
         * @param {pc.fw.LiveLiveMessage} msg The received message
         */
        _handleMessage: function (msg) {
            switch(msg.type) {
                case pc.fw.LiveLinkMessageType.UPDATE_COMPONENT:
                    this._updateComponent(msg.content.id, msg.content.component, msg.content.attribute, msg.content.value);
                    break;
                case pc.fw.LiveLinkMessageType.UPDATE_ENTITY:
                    this._updateEntity(msg.content.id, msg.content.components);
                    break;
                case pc.fw.LiveLinkMessageType.UPDATE_ENTITY_TRANSFORM:
                    var transform = pc.math.mat4.compose(msg.content.translate, msg.content.rotate, msg.content.scale);
                    this._updateEntityTransform(msg.content.id, transform);
                    break;
                case pc.fw.LiveLinkMessageType.UPDATE_ENTITY_NAME:
                    var entity = this.context.root.findOne("getGuid", msg.content.id);
                    entity.setName(msg.content.name);
                    break;
                case pc.fw.LiveLinkMessageType.REPARENT_ENTITY:
                    this._reparentEntity(msg.content.id, msg.content.newParentId, msg.content.index);
                    break;
                case pc.fw.LiveLinkMessageType.CLOSE_ENTITY:
                    var entity = this.context.root.findOne("getGuid", msg.content.id);
                    if(entity) {
                        logDEBUG(pc.string.format("RT: Removed '{0}' from parent {1}", msg.content.id, entity.getParent().getGuid())); 
                        entity.close(this.context.systems);
                        //this.printHierarchy(this.context.root);
                    }
                    break;
                case pc.fw.LiveLinkMessageType.OPEN_ENTITY:
                    var entities = {};
                    var guid = null;
                    if (msg.content.entity) {
                        // Create a fake little pack to open the entity hierarchy
                        var pack = {
                            application_data: {},
                            hierarchy: msg.content.entity
                        };
                        var pack = this.context.loader.open(pc.resources.PackRequest, pack);

                        // Get the root entity back from the fake pack
                        var entity = pack['hierarchy'];
                        if (entity.__parent) {
                            var parent = this.context.root.findByGuid(entity.__parent);
                            parent.addChild(entity);
                        } else {
                            this.context.root.addChild(entity);
                        }
                    }
                    if (msg.content.models) { // use old method that expects a flattened list and loads using EntityRequest
                        var i, len = msg.content.models.length;

                        for (i = 0; i < len; i++) {
                            var model = msg.content.models[i];
                            var entity = this.context.loader.open(pc.resources.EntityRequest, model);
                            entities[entity.getGuid()] = entity;
                        }
                        
                        for (guid in entities) {
                            if (entities.hasOwnProperty(guid)) {
                                pc.resources.EntityResourceHandler.patchChildren(entities[guid], entities);
                                if (!entities[guid].__parent) {
                                    // If entity has no parent add to the root
                                    this.context.root.addChild(entities[guid]);
                                } else if (!entities[entities[guid].__parent]) {
                                    // If entity has a parent in the existing tree add it (if entities[__parent] exists then this step will be performed in patchChildren for the parent)
                                    var parent = this.context.root.findByGuid(entities[guid].__parent);
                                    parent.addChild(entities[guid]);
                                }
                            }
                        }
                    }
                    break;
            }
        },

        /**
         * @function
         * @name pc.fw.Application#_updateComponent
         * @description Update a value on a component, 
         * @param {String} guid GUID for the entity
         * @param {String} componentName name of the component to update
         * @param {String} attributeName name of the attribute on the component
         * @param {Object} value - value to set attribute to
         */
        _updateComponent: function(guid, componentName, attributeName, value) {
            var entity = this.context.root.findOne("getGuid", guid);
            var system;
                
            if (entity) {
                if(componentName) {
                    system = this.context.systems[componentName];
                    if(system) {
                        system.set(entity, attributeName, value);
                    } else {
                        logWARNING(pc.string.format("No component system called '{0}' exists", componentName))
                    }
                } else {
                    // set value on node
                    entity[attributeName] = value;
                }
            }
        },

        _updateEntityTransform: function (guid, transform) {
            var entity = this.context.root.findByGuid(guid);
            if(entity) {
                entity.setLocalTransform(transform);

                // TODO: I don't like referencing a specific system here, but the body2d system won't pick up changes to the ltm 
                // unless we tell it directly. (Because it is simulating from the physics world). Perhaps we could do this 
                // by firing an event which the body system subscribes to instead. But I do we really want entities (or nodes) firing
                // an event everytime the transform is updated, sounds slow. Perhaps we can fire an event from in here.
                if (this.context.systems.body2d) {
                    entity.syncHierarchy();
                    this.context.systems.body2d.setTransform(entity, entity.getWorldTransform());
                    this.context.systems.body2d.setLinearVelocity(entity, 0, 0);
                    this.context.systems.body2d.setAngularVelocity(entity, 0);
                }
                
            }
        },
        
        _updateEntityAttribute: function (guid, accessor, value) {
            var entity = this.context.root.findOne("getGuid", guid);
            
            if(entity) {
                if(pc.type(entity[accessor]) != "function") {
                    logWARNING(pc.string.format("{0} is not an accessor function", accessor));
                }
                
                if(pc.string.startsWith(accessor, "reparent")) {
                    entity[accessor](value, this.context);
                } else {
                    entity[accessor](value);                
                }
            }
        },
        
        _reparentEntity: function (guid, parentId, index) {
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
        _updateEntity: function (guid, components) {
            var type;
            var entity = this.context.root.findOne("getGuid", guid);
            
            if(entity) {
                var order = this.context.systems.getComponentSystemOrder(); 

                var i, len = order.length;
                for(i = 0; i < len; i++) {
                    type = order[i];
                    if(components.hasOwnProperty(type) && this.context.systems.hasOwnProperty(type)) {
                       if(!this.context.systems[type].hasComponent(entity)) {
                            this.context.systems[type].createComponent(entity);
                        }
                    }
                }
                
                for(type in this.context.systems) {
                    if(type === "gizmo" || type === "pick") {
                        continue;
                    }

                    if(this.context.systems.hasOwnProperty(type)) {
                        if(!components.hasOwnProperty(type) && 
                            this.context.systems[type].hasComponent(entity)) {
                            this.context.systems[type].deleteComponent(entity);
                        }
                    }
                }
            }
        }
    };

    return {
        FillMode: {
            NONE: 0,
            FILL_WINDOW: 1,
            KEEP_ASPECT: 2
        },
        ResolutionMode: {
            AUTO: 0,
            FIXED: 1
        },
        Application: Application
    };
    
} ());




