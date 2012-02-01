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
     * MyApplication = MyApplication.extendsFrom(pc.fw.Application);
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
     */
    var Application = function (canvas, options) {
        this._inTools = false;

        this.canvas = canvas;

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
    
        if (pc.audio.AudioContext) {
            var audioContext = new pc.audio.AudioContext();
        }        
        
        scriptPrefix = (options.config && options.config['script_prefix']) ? options.config['script_prefix'] : "";

		// Create resource loader
		var loader = new pc.resources.ResourceLoader();
        loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());
        loader.registerHandler(pc.resources.ModelRequest, new pc.resources.ModelResourceHandler());
        loader.registerHandler(pc.resources.AnimationRequest, new pc.resources.AnimationResourceHandler());
        loader.registerHandler(pc.resources.EntityRequest, new pc.resources.EntityResourceHandler(registry, options.depot));
        loader.registerHandler(pc.resources.AssetRequest, new pc.resources.AssetResourceHandler(options.depot));
        if (audioContext) {
            loader.registerHandler(pc.resources.AudioRequest, new pc.resources.AudioResourceHandler(audioContext));
        }

		// The ApplicationContext is passed to new Components and user scripts
        this.context = new pc.fw.ApplicationContext(loader, new pc.scene.Scene(), registry, options.controller, options.keyboard, options.mouse);
    
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
        var primitivesys = new pc.fw.PrimitiveComponentSystem(this.context);
        var packsys = new pc.fw.PackComponentSystem(this.context);
        var skyboxsys = new pc.fw.SkyboxComponentSystem(this.context);
        var scriptsys = new pc.fw.ScriptComponentSystem(this.context);        
        var simplebodysys = new pc.fw.SimpleBodyComponentSystem(this.context);
        var picksys = new pc.fw.PickComponentSystem(this.context);
        if (audioContext) {
            var audiosourcesys = new pc.fw.AudioSourceComponentSystem(this.context, audioContext);
            var audiolistenersys = new pc.fw.AudioListenerComponentSystem(this.context, audioContext);            
        }
        
        skyboxsys.setDataDir(options.dataDir);
        staticcubemapsys.setDataDir(options.dataDir);
        
        // Add event support
        pc.extend(this, pc.events);
               
    };
    
    /**
     * 
     */
    Application.prototype.loadPack = function (guid, success, error, progress) {
        this.context.loader.request(new pc.resources.EntityRequest(guid), function (resources) {
            // success
            success(resources);
        }.bind(this), function (errors) {
            // error
            error(errors);
        }.bind(this), function (value) {
            // progress
            progress(value)
        }.bind(this));
    };
    
    /**
     * @function
     * @name pc.fw.Application#start
     * @description Start the Application updating
     */
    Application.prototype.start = function (entity) {
        if(entity) {
            this.context.root.addChild(entity);
        }
        this.context.root.syncHierarchy();

        this.context.systems.script.initialize();

        this.tick();
    };
    
    
    /**
     * @function
     * @name pc.fw.Application#update
     * @description Application specific update method. Override this if you have a custom Application
     * @param {Number} dt The time delta since the last frame.
     */
    Application.prototype.update = function (dt) {
        var context = this.context;

        // Perform ComponentSystem update
        pc.fw.ComponentSystem.update(dt, context, this._inTools);
        pc.fw.ComponentSystem.updateFixed(1.0 / 60.0, context, this._inTools);

        // fire update event
        this.fire("update", dt);

        if (context.controller) {
            context.controller.update(dt);
        }
        if (context.keyboard) {
            context.keyboard.update(dt);
        }
    };

    /** 
     * @function
     * @name pc.fw.Application#render
     * @description Application specific render method. Override this if you have a custom Application
     */
    Application.prototype.render = function () {
        var context = this.context;
        var entity = context.systems.camera.getCurrent();
        var camera = context.systems.camera.get(entity, "camera");

        context.root.syncHierarchy();

        pc.gfx.Device.setCurrent(this.graphicsDevice);
        
        if(camera) {
            context.systems.camera.frameBegin();

            pc.fw.ComponentSystem.render(context, this._inTools);
            context.scene.dispatch(camera);
            context.scene.flush();

            context.systems.camera.frameEnd();            
        }
    };

    /** 
     * @function
     * @name pc.fw.Application#tick
     * @description Application specific tick method that calls update and render and queues
     * the next tick. Override this if you have a custom Application.
     */
    Application.prototype.tick = function () {
        this.lastTime = this.currTime || Date.now();
        this.currTime = Date.now();

        var dt = (this.currTime - this.lastTime) * 0.001;
        dt = pc.math.clamp(dt, 0, 0.1); // Maximum delta is 0.1s or 10 fps.
        
    	this.update(dt);
    	this.render();

        // Submit a request to queue up a new animation frame immediately
        requestAnimFrame(this.tick.bind(this), this.canvas);
    };

    /**
     * @function
     * @name pc.fw.Application#_handleMessage
     * @description Called when the LiveLink object receives a new message
     * @param {pc.fw.LiveLiveMessage} msg The received message
     */
    Application.prototype._handleMessage = function (msg) {
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
                    entity.close(this.context.systems);
                }
                break;
            case pc.fw.LiveLinkMessageType.OPEN_ENTITY:
                var entities = {};
                var guid = null;
                
                msg.content.models.forEach(function (model) {
                    var entity = this.context.loader.open(pc.resources.EntityRequest, model);
                    entities[entity.getGuid()] = entity;
                }, this);
                
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
                break;
        }
    };

    /**
     * @function
     * @name pc.fw.Application#_updateComponent
     * @description Update a value on a component, 
     * @param {String} guid GUID for the entity
     * @param {String} componentName name of the component to update
     * @param {String} attributeName name of the attribute on the component
     * @param {Object} value - value to set attribute to
     */
    Application.prototype._updateComponent = function(guid, componentName, attributeName, value) {
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
    };

    Application.prototype._updateEntityTransform = function (guid, transform) {
        var entity = this.context.root.findByGuid(guid);
        if(entity) {
            entity.setLocalTransform(transform);
        }
    };
    
    Application.prototype._updateEntityAttribute = function (guid, accessor, value) {
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
    };
    Application.prototype._reparentEntity = function (guid, parentId, index) {
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
    Application.prototype._updateEntity = function (guid, components) {
        var type;
        var entity = this.context.root.findOne("getGuid", guid);
        
        if(entity) {
            for(type in components) {
                if(this.context.systems.hasOwnProperty(type)) {
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
    };
        
    return {
            Application: Application
    };
    
} ());




