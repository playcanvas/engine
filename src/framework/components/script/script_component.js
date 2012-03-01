pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.ScriptComponentSystem
     * @constructor Create a new ScriptComponentSystem
     * @class Allows scripts to be attached to an Entity and executed
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var ScriptComponentSystem = function ScriptComponentSystem(context) {
        this._name = "script";
        context.systems.add(this._name, this);
        pc.extend(this, pc.events);
        
        this.bind("set_urls", this.onSetUrls.bind(this));
    }
    ScriptComponentSystem = ScriptComponentSystem.extendsFrom(pc.fw.ComponentSystem);

    ScriptComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.ScriptComponentData();

        this.initialiseComponent(entity, componentData, data, ['runInTools', 'urls']);

        return componentData;
    };

    ScriptComponentSystem.prototype.deleteComponent = function (entity) {
        var componentData = this.getComponentData(entity);

        for (name in componentData.instances) {
            if (componentData.instances.hasOwnProperty(name)) {
                if(componentData.instances[name].instance.destroy) {
                    componentData.instances[name].instance.destroy();
                }
            }
        }
    
        this.removeComponent(entity);
    };
    
    /**
     * @function
     * @name pc.fw.ScriptComponentSystem#initialize
     * @description Initialize scripts on a portion of an Entity hierarchy. Calls the initialise() method on any instances of script objects that are on the hierarchy that starts at root.
     * @param {pc.fw.Entity} root The root of the hierarchy to initialize.
     */
    ScriptComponentSystem.prototype.initialize = function (root) {
        this.registerInstances(root);
        
        var componentData = this.getComponentData(root);
        if (componentData) {
            for (name in componentData.instances) {
                if (componentData.instances.hasOwnProperty(name)) {
                    if (componentData.instances[name].instance.initialize) {
                        componentData.instances[name].instance.initialize();
                    }                        
                }
            }
        }
        
        var children = root.getChildren();
        var i, len = children.length;
        for (i = 0; i < len; i++) {
            if (children[i] instanceof pc.fw.Entity) {
                this.initialize(children[i]);    
            }
        } 
    };

    ScriptComponentSystem.prototype.update = function (dt) {
        var components = this.getComponents();

        for (var id in components) {
            if (components.hasOwnProperty(id)) {
                var entity = components[id].entity;
                var componentData = this.getComponentData(entity);

                for (name in componentData.instances) {
                    if (componentData.instances.hasOwnProperty(name)) {
                        if (componentData.instances[name].instance.update) {
                            componentData.instances[name].instance.update(dt);
                        }                        
                    }
                }
            }
        }
    };

    ScriptComponentSystem.prototype.updateFixed = function (dt) {
        var components = this.getComponents();

        for (var id in components) {
            if (components.hasOwnProperty(id)) {
                var entity = components[id].entity;
                var componentData = this.getComponentData(entity);

                for (name in componentData.instances) {
                    if (componentData.instances.hasOwnProperty(name)) {
                        if (componentData.instances[name].instance.updateFixed) {
                            componentData.instances[name].instance.updateFixed(dt);
                        }                        
                    }
                }
            }
        }
    };

    ScriptComponentSystem.prototype.render = function () {
        var components = this.getComponents();

        for (var id in components) {
            if (components.hasOwnProperty(id)) {
                var entity = components[id].entity;
                var componentData = this.getComponentData(entity);

                for (name in componentData.instances) {
                    if (componentData.instances.hasOwnProperty(name)) {
                        if (componentData.instances[name].instance.render) {
                            componentData.instances[name].instance.render();
                        }                        
                    }
                }
            }
        }
    };
    
    ScriptComponentSystem.prototype.onSetUrls = function(entity, name, oldValue, newValue) {
        var componentData = this.getComponentData(entity);
        var urls = newValue;
        var prefix = pc.content.source || "";
        if(pc.type(urls) == "string") {
            urls = urls.split(",");
        }
        var options = {
            batch: entity.getRequestBatch()
        };
        
        if (!this._inTools || (this._inTools && componentData.runInTools)) {
            // Load and register new scripts and instances
            urls.forEach(function (url, index, arr) {
                var url = new pc.URI(pc.path.join(prefix, urls[index].trim())).toString();
                this.context.loader.request(new pc.resources.ScriptRequest(url), function (resources) {
                    var ScriptType = resources[url];

                    // ScriptType may be null if the script component is loading an ordinary javascript lib rather than a PlayCanvas script
                    if (ScriptType) {
                        var instance = new ScriptType(entity);
                        this.preRegisterInstance(entity, url, ScriptType._pcScriptName, instance);
                        
                        // If there is no request batch, then this is not part of a load request and so we need 
                        // to register the instances immediately to call the initialize function
                        if (!options.batch) {
                            this.registerInstances(entity);
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
    };
    
    /**
     * @function
     * @private
     * @name pc.fw.ScriptComponentSystem#preRegisterInstance
     * @description Store a copy of a new script object instance on the component but do not register them to receive updates.
     */
    ScriptComponentSystem.prototype.preRegisterInstance = function (entity, url, name, instance) {
        var data = this.getComponentData(entity);
        data._instances = data._instances || {};
        if (data._instances[name]) {
            throw Error(pc.string.format("Script name collision '{0}'. Scripts from '{1}' and '{2}' {{3}}", name, url, instances[name].url, entity.getGuid()));
        }
        data._instances[name] = {
            url: url,
            name: name,
            instance: instance
        };
    };
    
    ScriptComponentSystem.prototype.registerInstances = function (entity) {
        var data = this.getComponentData(entity);
        if (data) {
            if (data._instances) {
                this.set(entity, 'instances', data._instances);                                
                // Remove temp storage
                delete data._instances;            
            }
            
        }

        var children = entity.getChildren()
        var i, len = children.length;
        for (i = 0; i < len; i++) {
            if (children[i] instanceof pc.fw.Entity) {
                this.registerInstances(children[i]);    
            }
        }    
    };
    
    /**
     * @function
     * @name pc.fw.ScriptComponentSystem#send
     * @description Send a message to a script attached to a specific entity.
     * Sending a message to a script is similar to calling a method on a Script Object, except that the message will not fail if the method isn't present.
     * @param {pc.fw.Entity} entity The entity to send the message to
     * @param {String} name The name of the script to send the message to
     * @param {String} functionName The name of the function to call on the script
     * @returns The result of the function call
     * @example
     * // Call doDamage(10) on the script object called 'enemy' attached to enemy_entity.
     * context.systems.script.send(enemy_entity, 'enemy', 'doDamage', 10);
     */
    ScriptComponentSystem.prototype.send = function (entity, name, functionName) {
        var args = pc.makeArray(arguments).slice(3);
        var instances = this.get(entity, "instances");
        var fn;        
        
        if(instances && instances[name]) {
            fn = instances[name].instance[functionName];
            if (fn) {
                return fn.apply(instances[name].instance, args);    
            }
            
        }
    };
    
    // Compatibility
    ScriptComponentSystem.prototype.message = ScriptComponentSystem.prototype.send;
    
    /**
     * @function
     * @name pc.fw.ScriptComponentSystem#broadcast
     * @description Send a message to all Script Objects with a specific name.
     * Sending a message is similar to calling a method on a Script Object, except that the message will not fail if the method isn't present
     * @param {String} name The name of the script to send the message to
     * @param {String} functionName The name of the functio nto call on the Script Object
     * @example
     * // Call doDamage(10) on all 'enemy' scripts
     * context.systems.script.broadcast('enemy', 'doDamage', 10);
     */
    ScriptComponentSystem.prototype.broadcast = function (name, functionName) {
        var args = pc.makeArray(arguments).slice(2);
        
        var id, entity, componentData, fn;
        var components = this.getComponents();
        var results = [];
        
        for (id in components) {
            if (components.hasOwnProperty(id)) {
                entity = components[id].entity;
                componentData = components[id].component;
                if (componentData.instances[name]) {
                    fn = componentData.instances[name].instance[functionName];
                    if(fn) {
                        fn.apply(componentData.instances[name].instance, args);
                    }
                }
            }
        }
    };
      
    return {
        ScriptComponentSystem: ScriptComponentSystem
    };
}());

