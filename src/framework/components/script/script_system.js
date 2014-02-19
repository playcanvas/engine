pc.extend(pc.fw, function () {

    var INITIALIZE = "initialize";
    var POST_INITIALIZE = "postInitialize";
    var UPDATE = "update";
    var POST_UPDATE = "postUpdate";
    var FIXED_UPDATE = "fixedUpdate";
    var TOOLS_UPDATE = "toolsUpdate";

    /**
     * @name pc.fw.ScriptComponentSystem
     * @constructor Create a new ScriptComponentSystem
     * @class Allows scripts to be attached to an Entity and executed
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var ScriptComponentSystem = function ScriptComponentSystem(context) {
        this.id = 'script';
        this.description = "Allows the Entity to run JavaScript fragments to implement custom behavior.";
        context.systems.add(this.id, this);
        
        this.ComponentType = pc.fw.ScriptComponent;
        this.DataType = pc.fw.ScriptComponentData;

        this.schema = [{
           name: 'enabled',
           displayName: 'Enabled',
           description: 'Disabled components are not updated',
           type: 'boolean',
           defaultValue: true
        },{
            name: "scripts",
            displayName: "URLs",
            description: "Attach scripts to this Entity",
            type: "script",
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

        this.on('beforeremove', this.onBeforeRemove, this);
        this.on('remove', this.onRemove, this);
        pc.fw.ComponentSystem.on(INITIALIZE, this.onInitialize, this);
        pc.fw.ComponentSystem.on(POST_INITIALIZE, this.onPostInitialize, this);
        pc.fw.ComponentSystem.on(UPDATE, this.onUpdate, this);
        pc.fw.ComponentSystem.on(FIXED_UPDATE, this.onFixedUpdate, this);
        pc.fw.ComponentSystem.on(POST_UPDATE, this.onPostUpdate, this);
        pc.fw.ComponentSystem.on(TOOLS_UPDATE, this.onToolsUpdate, this);
    };
    ScriptComponentSystem = pc.inherits(ScriptComponentSystem, pc.fw.ComponentSystem);

    pc.extend(ScriptComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            properties = ['runInTools', 'enabled', 'scripts'];

            ScriptComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        cloneComponent: function (entity, clone) {
            // overridden to make sure urls list is duplicated
            var src = this.dataStore[entity.getGuid()];
            var data = {
                runInTools: src.data.runInTools,
                scripts: pc.extend([], src.data.scripts),
                enabled: src.data.enabled
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
                    
                    if(data.instances[name].instance.destroy) {
                        data.instances[name].instance.destroy();
                    }

                    delete data.instances[name];
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
                
            if (root.script && root.script.enabled) {
                this._initializeScriptComponent(root.script);
            }
            
            var children = root.getChildren();
            var i, len = children.length;
            for (i = 0; i < len; i++) {
                if (children[i] instanceof pc.fw.Entity) {
                    this.onInitialize(children[i]);    
                }
            } 
        },

        _initializeScriptComponent: function (script) {
            for (var name in script.data.instances) {
                if (script.data.instances.hasOwnProperty(name)) {
                    if (script.data.instances[name].instance.initialize) {
                        script.data.instances[name].instance.initialize();
                    }                        
                }
            }                

            script.data.initialized = true;
        },

        /**
         * @function
         * @private
         * @name pc.fw.ScriptComponentSystem#onPostInitialize
         * @description Handler for the 'postInitialize' event which is fired immediately after the 'initialize' event and before the first update loop
         * @param {pc.fw.Entity} root The root of the hierarchy to initialize.
         */
        onPostInitialize: function (root) {
            if (root.script && root.script.enabled) {
                this._postInitializeScriptComponent(root.script);
            }
            
            var children = root.getChildren();
            var i, len = children.length;
            for (i = 0; i < len; i++) {
                if (children[i] instanceof pc.fw.Entity) {
                    this.onPostInitialize(children[i]);    
                }
            } ;
        },

        _postInitializeScriptComponent: function (script) {
            for (var name in script.data.instances) {
                if (script.data.instances.hasOwnProperty(name)) {
                    if (script.data.instances[name].instance.postInitialize) {
                        script.data.instances[name].instance.postInitialize();
                    }                        
                }
            }   

            script.data.postInitialized = true;
        },

        _updateInstances: function (updateMethod, dt) {            
            var components = this.store;

            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var componentData = components[id].data;
                    if (componentData.enabled) {
                        var instances = componentData.instances;
                        for (var key in instances) {
                            if (instances.hasOwnProperty(key)) {
                                var instance = instances[key].instance;
                                if (instance[updateMethod]) {
                                    instance[updateMethod](dt);
                                }
                            }
                        }
                    }
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
            this._updateInstances(UPDATE, dt);
        },

        /**
        * @private
        * @function
        * @name pc.fw.ScriptComponentSystem#onFixedUpdate
        * @description Handler for the 'fixedUpdate' event which is fired every frame just before the 'update' event but with a fixed timestep
        * @param {Number} dt A fixed timestep of 1/60 seconds
        */
        onFixedUpdate: function (dt) {
            this._updateInstances(FIXED_UPDATE, dt);
        },

        /**
        * @private
        * @function
        * @name pc.fw.ScriptComponentSystem#onPostUpdate
        * @description Handler for the 'postUpdate' event which is fired every frame just after the 'update' event
        * @param {Number} dt The time delta since the last update in seconds
        */
        onPostUpdate: function (dt) {
           this._updateInstances(POST_UPDATE, dt);
        },

        onToolsUpdate: function (dt) {
            this._updateInstances(TOOLS_UPDATE, dt);
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
            if (entity.script) {
                entity.script.data._instances = entity.script.data._instances || {};
                if (entity.script.data._instances[name]) {
                    throw Error(pc.string.format("Script name collision '{0}'. Scripts from '{1}' and '{2}' {{3}}", name, url, entity.script.data._instances[name].url, entity.getGuid()));
                }
                entity.script.data._instances[name] = {
                    url: url,
                    name: name,
                    instance: instance
                };
            }
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

                        pc.extend(instance.instance, pc.events);

                        if (entity.script.scripts) {
                            this._createAccessors(entity, instance);
                        }

                        // Make instance accessible from the script component of the Entity
                        if (entity.script[instanceName]) {
                            throw Error(pc.string.format("Script with name '{0}' is already attached to Script Component", instanceName));
                        } else {
                            entity.script[instanceName] = instance.instance;
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
        },

        _createAccessors: function (entity, instance) {
            var self = this;
            var i;
            var len = entity.script.scripts.length;
            var url = instance.url;

            for (i=0; i<len; i++) {
                var script = entity.script.scripts[i];
                if (script.url === url) {
                    var attributes = script.attributes;
                    if (script.name && attributes) {
                        entity.script.data.attributes[script.name] = pc.extend([], attributes);

                        attributes.forEach(function (attribute, index) {
                            self._createAccessor(attribute, instance);
                        });
                    }
                    break;
                }
            }
        },

        _createAccessor: function (attribute, instance) {
            var self = this;

            self._convertAttributeValue(attribute);

            Object.defineProperty(instance.instance, attribute.name, {
                get: function () {
                    return attribute.value;
                },
                set: function (value) {
                    var oldValue = attribute.value;
                    attribute.value = value;
                    self._convertAttributeValue(attribute);
                    instance.instance.fire("set", attribute.name, oldValue, attribute.value);
                },
                configurable: true
            });
        },

        _updateAccessors: function (entity, instance) {
            var self = this;
            var i, k, h;
            var len = entity.script.scripts.length;
            var url = instance.url;
            var scriptComponent, script, name, attributes;
            var removedAttributes;
            var previousAttributes;
            var oldAttribute, newAttribute;

            for (i=0; i<len; i++) {
                scriptComponent = entity.script;
                script = scriptComponent.scripts[i];
                if (script.url === url) {
                    name = script.name;
                    attributes = script.attributes;
                    if (name) {
                        if (attributes) {
                            // create / update attribute accessors
                            attributes.forEach(function (attribute, index) {
                                self._createAccessor(attribute, instance);
                            });
                        } 

                        // delete accessors for attributes that no longer exist
                        // and fire onAttributeChange when an attribute value changed
                        previousAttributes = scriptComponent.data.attributes[name];
                        if (previousAttributes) {
                            k = previousAttributes.length;
                            while(k--) {
                                oldAttribute = previousAttributes[k];
                                newAttribute = null;

                                h = attributes.length;

                                while (h--) {
                                    if (oldAttribute.name === attributes[h].name) {
                                        newAttribute = attributes[h];
                                        break;
                                    }
                                }

                                if (!newAttribute) {
                                    delete instance.instance[oldAttribute.name];
                                } else {
                                    if (oldAttribute.value !== newAttribute.value) {
                                        if (instance.instance.onAttributeChanged) {
                                            instance.instance.onAttributeChanged(oldAttribute.name, oldAttribute.value, newAttribute.value);
                                        }
                                    }
                                }
                            }
                        }

                        if (attributes) {
                            scriptComponent.data.attributes[name] = pc.extend([], attributes);
                        } else {
                            delete scriptComponent.data.attributes[name];
                        }
                    }

                    break;
                }
            }
        },

        _convertAttributeValue: function (attribute) {
            if (attribute.type === 'rgb' || attribute.type === 'rgba') {
                if (pc.type(attribute.value) === 'array') {
                    attribute.value = attribute.value.length === 3 ? 
                                      new pc.Color(attribute.value[0], attribute.value[1], attribute.value[2]) : 
                                      new pc.Color(attribute.value[0], attribute.value[1], attribute.value[2], attribute.value[3]);
                }
            }
        }

    });

    return {
        ScriptComponentSystem: ScriptComponentSystem
    };
}());