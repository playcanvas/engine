pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.ScriptComponentSystem
     * @constructor Create a new ScriptComponentSystem
     * @class Allows scripts to be attached to an Entity and executed
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var ScriptComponentSystem = function ScriptComponentSystem(context) {
        this.id = 'script';
        context.systems.add(this.id, this);
        
        this.ComponentType = pc.fw.ScriptComponent;
        this.DataType = pc.fw.ScriptComponentData;

        this.schema = [{
            name: "urls",
            displayName: "URLs",
            description: "Attach scripts to this Entity",
            type: "script_urls",
            defaultValue: []
        }, {
            name: 'instances',
            exposed: false
        }, {
            name: 'runInTools',
            description: 'Allows scripts to be loaded and executed while in the tools',
            defaultValue: false,
            exposed: false
        }];

        this.exposeProperties();

        this.on('remove', this.onRemove, this);
        pc.fw.ComponentSystem.on('initialize', this.onInitialize, this);
        pc.fw.ComponentSystem.on('update', this.onUpdate, this);
        pc.fw.ComponentSystem.on('fixedUpdate', this.onFixedUpdate, this);
        pc.fw.ComponentSystem.on('postUpdate', this.onPostUpdate, this);
        pc.fw.ComponentSystem.on('toolsUpdate', this.onToolsUpdate, this);
    };
    ScriptComponentSystem = pc.inherits(ScriptComponentSystem, pc.fw.ComponentSystem);

    pc.extend(ScriptComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            properties = ['runInTools', 'urls'];
            ScriptComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        cloneComponent: function (entity, clone) {
            // overridden to make sure urls list is duplicated
            var src = this.dataStore[entity.getGuid()];
            var data = {
                runInTools: src.data.runInTools,
                urls: pc.extend([], src.data.urls)
            };
            return this.addComponent(clone, data);
        },

        /**
        * @private
        * @name pc.fw.ScriptComponentSystem#onRemove
        * @description Handler for 'remove' event which is fired when a script component is removed from an entity;
        * @param {pc.fw.Entity} entity The entity that the component was removed from
        * @param {pc.fw.ComponentData} data The data object for the removed component
        */
        onRemove: function (entity, data) {
            for (var name in data.instances) {
                if (data.instances.hasOwnProperty(name)) {
                    
                    // Unbind any instance events that were bound when the script was created
                    var events = ['update', 'fixedUpdate', 'postUpdate', 'toolsUpdate'];
                    events.forEach(function (eventName) {
                        if (data.instances[name].instance[eventName]) {
                            this.unbind(eventName, data.instances[name].instance[eventName], data.instances[name].instance);
                        }
                    }, this);

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
                for (var name in root.script.data.instances) {
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

        onToolsUpdate: function (dt) {
            this.fire('toolsUpdate', dt);
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
            var args = pc.makeArray(arguments).slice(2);
            
            var id, data, fn;
            var dataStore = this.store;
            // var results = [];
            
            for (id in dataStore) {
                if (dataStore.hasOwnProperty(id)) {
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
                throw Error(pc.string.format("Script name collision '{0}'. Scripts from '{1}' and '{2}' {{3}}", name, url, entity.script.data._instances[name].url, entity.getGuid()));
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
        * and binding events for the update, fixedUpdate, postUpdate and toolsUpdate methods.
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
                            this.on('update', instance.instance.update, instance.instance);
                        }
                        if (instance.instance.fixedUpdate) {
                            this.on('fixedUpdate', instance.instance.fixedUpdate, instance.instance);
                        }
                        if (instance.instance.postUpdate) {
                            this.on('postUpdate', instance.instance.postUpdate, instance.instance);
                        }
                        if (instance.instance.toolsUpdate) {
                            this.on('toolsUpdate', instance.instance.toolsUpdate, instance.instance);
                        }
                    }

                    // Remove temp storage
                    delete entity.script.data._instances;
                }
                
            }

            var children = entity.getChildren();
            var i, len = children.length;
            for (i = 0; i < len; i++) {
                if (children[i] instanceof pc.fw.Entity) {
                    this._registerInstances(children[i]);    
                }
            }    
        }
    });

    return {
        ScriptComponentSystem: ScriptComponentSystem
    };
}());