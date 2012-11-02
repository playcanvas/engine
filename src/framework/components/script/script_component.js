pc.extend(pc.fw, function () {
    var ScriptComponent = function ScriptComponent(entity) {
        var schema = [{
            name: "urls",
            displayName: "URLs",
            description: "Attach scripts to this Entity",
            type: "script_urls",
            defaultValue: []
        }, {
            name: 'instances',
            exposed: false
        }];

        this.assignSchema(schema);

        this.bind("set_urls", this.onSetUrls.bind(this));
    };
    ScriptComponent = pc.inherits(ScriptComponent, pc.fw.Component);

    pc.extend(ScriptComponent.prototype, {
/**
         * @function
         * @name pc.fw.ScriptComponent#send
         * @description Send a message to a script attached to the entity.
         * Sending a message to a script is similar to calling a method on a Script Object, except that the message will not fail if the method isn't present.
         * @param {String} name The name of the script to send the message to
         * @param {String} functionName The name of the function to call on the script
         * @returns The result of the function call
         * @example
         * // Call doDamage(10) on the script object called 'enemy' attached to entityEntity.
         * entityEntity.script.send('enemy', 'doDamage', 10);
         */
        send: function (name, functionName) {
            var args = pc.makeArray(arguments).slice(2);
            var instances = this.entity.script.instances;
            var fn;
            
            if(instances && instances[name]) {
                fn = instances[name].instance[functionName];
                if (fn) {
                    return fn.apply(instances[name].instance, args);    
                }
                
            }
        },
                
        /**
         * @function
         * @name pc.fw.ScriptComponentSystem#broadcast
         * @description Send a message to all Script Objects with a specific name.
         * Sending a message is similar to calling a method on a Script Object, except that the message will not fail if the method isn't present
         * @param {String} name The name of the script to send the message to
         * @param {String} functionName The name of the functio nto call on the Script Object
         * @example
         * // Call doDamage(10) on all 'enemy' scripts
         * entityEntity.script.broadcast('enemy', 'doDamage', 10);
         */
        broadcast: function (name, functionName) {
            var args = pc.makeArray(arguments).slice(1);
            
            var id, entity, componentData, fn;
            var dataStore = this.system.store;
            var results = [];
            
            for (id in dataStore) {
                if (dataStore.hasOwnProperty(id)) {
                    entity = dataStore[id].entity;
                    data = dataStore[id].data;
                    if (data.instances[name]) {
                        fn = data.instances[name].instance[functionName];
                        if(fn) {
                            fn.apply(data.instances[name].instance, args);
                        }
                    }
                }
            }
        },

        onSetUrls: function(oldValue, newValue) {
            var urls = newValue;
            var prefix = pc.content.source || "";

            var options = {
                batch: this.entity.getRequestBatch()
            };
            
            if (!this._inTools) {
                // Load and register new scripts and instances
                urls.forEach(function (url, index, arr) {
                    var url = new pc.URI(pc.path.join(prefix, urls[index].trim())).toString();
                    this.system.context.loader.request(new pc.resources.ScriptRequest(url), function (resources) {
                        var ScriptType = resources[url];

                        // ScriptType may be null if the script component is loading an ordinary javascript lib rather than a PlayCanvas script
                        if (ScriptType) {
                            var instance = new ScriptType(this.entity);
                            this.system._preRegisterInstance(this.entity, url, ScriptType._pcScriptName, instance);
                            
                            // If there is no request batch, then this is not part of a load request and so we need 
                            // to register the instances immediately to call the initialize function
                            if (!options.batch) {
                                this.system._registerInstances(this.entity);
                            }                        
                        }
                    }.bind(this), function (errors) {
                        Object.keys(errors).forEach(function (key) {
                            logERROR(errors[key]);
                        });
                    }, function (progress) {
                        
                    }, options);
                }, this);            
            }
        }
    });

    /**
     * @name pc.fw.ScriptComponentSystem
     * @constructor Create a new ScriptComponentSystem
     * @class Allows scripts to be attached to an Entity and executed
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var ScriptComponentSystem = function ScriptComponentSystem(context) {
        this.id = "script";
        context.systems.add(this.id, this);
        
        this.ComponentType = pc.fw.ScriptComponent;
        this.DataType = pc.fw.ScriptComponentData;

        this.bind('remove', this.onRemove.bind(this));

        pc.fw.ComponentSystem.bind('initialize', this.onInitialize.bind(this));
        pc.fw.ComponentSystem.bind('update', this.onUpdate.bind(this));
        pc.fw.ComponentSystem.bind('fixedUpdate', this.onFixedUpdate.bind(this));
        pc.fw.ComponentSystem.bind('postUpdate', this.onPostUpdate.bind(this));
    }
    ScriptComponentSystem = pc.inherits(ScriptComponentSystem, pc.fw.ComponentSystem);

    pc.extend(ScriptComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            properties = ['runInTools', 'urls'];
            ScriptComponentSystem._super.initializeComponentData(component, data, properties);
        },

        /**
        * @private
        * @name pc.fw.ScriptComponentSystem#onRemove
        * @description Handler for 'remove' event which is fired when a script component is removed from an entity;
        * @param {pc.fw.Entity} entity The entity that the component was removed from
        * @param {pc.fw.ComponentData} data The data object for the removed component
        */
        onRemove: function (entity, data) {
            for (name in data.instances) {
                if (data.instances.hasOwnProperty(name)) {
                    if(data.instances[name].instance.destroy) {
                        data.instances[name].instance.destroy();
                    }
                }
            }
        },

        /**
         * @function
         * @private
         * @name pc.fw.ScriptComponentSystem#onInitialize
         * @description Handler for the 'initialize' event which is fired immediately after the Entity hierarchy is loaded, but before the first update loop
         * @param {pc.fw.Entity} root The root of the hierarchy to initialize.
         */
        onInitialize: function (root) {
            this._registerInstances(root);
                
            if (root.script) {
                for (name in root.script.data.instances) {
                    if (root.script.data.instances.hasOwnProperty(name)) {
                        if (root.script.data.instances[name].instance.initialize) {
                            root.script.data.instances[name].instance.initialize();
                        }                        
                    }
                }                
            }
            
            var children = root.getChildren();
            var i, len = children.length;
            for (i = 0; i < len; i++) {
                if (children[i] instanceof pc.fw.Entity) {
                    this.onInitialize(children[i]);    
                }
            } 
        },

        /**
        * @private
        * @function
        * @name pc.fw.ScriptComponentSystem#onUpdate
        * @description Handler for the 'update' event which is fired every frame
        * @param {Number} dt The time delta since the last update in seconds
        */
        onUpdate: function (dt) {
            this.fire('update', dt);
        },

        /**
        * @private
        * @function
        * @name pc.fw.ScriptComponentSystem#onFixedUpdate
        * @description Handler for the 'fixedUpdate' event which is fired every frame just before the 'update' event but with a fixed timestep
        * @param {Number} dt A fixed timestep of 1/60 seconds
        */
        onFixedUpdate: function (dt) {
            this.fire('fixedUpdate', dt);
        },

        /**
        * @private
        * @function
        * @name pc.fw.ScriptComponentSystem#onPostUpdate
        * @description Handler for the 'postUpdate' event which is fired every frame just after the 'update' event
        * @param {Number} dt The time delta since the last update in seconds
        */
        onPostUpdate: function (dt) {
            this.fire('postUpdate', dt);
        },

        /**
        * @private
        * @function
        * @name pc.fw.ScriptComponentSystem#_preRegisterInstance
        * @description Internal method used to store a instance of a script created while loading. Instances are preregistered while loadeding
        * and then all registered at the same time once loading is complete 
        * @param {pc.fw.Entity} entity The Entity the script instance is attached to
        * @param {String} url The url of the script
        * @param {String} name The name of the script
        * @param {Object} instance The instance of the Script Object
        */
        _preRegisterInstance: function (entity, url, name, instance) {
            entity.script.data._instances = entity.script.data._instances || {};
            if (entity.script.data._instances[name]) {
                throw Error(pc.string.format("Script name collision '{0}'. Scripts from '{1}' and '{2}' {{3}}", name, url, instances[name].url, entity.getGuid()));
            }
            entity.script.data._instances[name] = {
                url: url,
                name: name,
                instance: instance
            };
        },
    
        /**
        * @private
        * @function
        * @name pc.fw.ScriptComponentSystem#_registerInstance
        * @description Get all preregistered instances for an entity and 'register' then. This means storing the instance in the ComponentData
        * and binding events for the update, fixedUpdate and postUpdate methods.
        * This function is recursive and calls itself for the complete hierarchy down from the supplied Entity
        * @param {pc.fw.Entity} entity The Entity the instances are attached to
        */        
        _registerInstances: function (entity) {
            var instance, instanceName;

            if (entity.script) {
                if (entity.script.data._instances) {
                    entity.script.instances = entity.script.data._instances;

                    for (instanceName in entity.script.instances) {
                        instance = entity.script.instances[instanceName];

                        // Attach events for update, fixedUpdate and postUpdate methods in script instance
                        if (instance.instance.update) {
                            this.bind('update', instance.instance.update.bind(instance.instance));
                        }
                        if (instance.instance.fixedUpdate) {
                            this.bind('fixedUpdate', instance.instance.fixedUpdate.bind(instance.instance));
                        }
                        if (instance.instance.postUpdate) {
                            this.bind('postUpdate', instance.instance.postUpdate.bind(instance.instance));
                        }
                    }

                    // Remove temp storage
                    delete entity.script.data._instances;
                }
                
            }

            var children = entity.getChildren()
            var i, len = children.length;
            for (i = 0; i < len; i++) {
                if (children[i] instanceof pc.fw.Entity) {
                    this._registerInstances(children[i]);    
                }
            }    
        }
    });
      
    return {
        ScriptComponent: ScriptComponent,
        ScriptComponentSystem: ScriptComponentSystem
    };
}());

