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

        this.initialiseComponent(entity, componentData, data, ['urls']);

        return componentData;
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
        var urls = newValue;
        var prefix = pc.content.source || "";
        if(pc.type(urls) == "string") {
            urls = urls.split(",");
        }
        
        if(!this._inTools) {
            // Load and register new scripts and instances
            urls.forEach(function (url, index, arr) {
                var url = new pc.URI(pc.path.join(prefix, urls[index].trim())).toString();
                this.context.loader.request(new pc.resources.ScriptRequest(url), function (resources) {
                    var ScriptType = resources[url];
                    instance = new ScriptType(entity);
                    this._registerInstance(entity, url, ScriptType._pcScriptName, instance);                        
                }.bind(this));
            }, this);            
        }
    };
    
    /**
     * @name pc.fw.ScriptComponentSystem#_registerInstance
     * @function
     * @private
     * @description Register an instance of a Script Object to an entity.
     * @param {pc.fw.Entity} entity The entity to register the instance to
     * @param {String} url The url the script was downloaded from
     * @param {String} name Then name declared in the script
     * @param {Object} instance An instance of the Script Object declared in the downloaded script
     */
    ScriptComponentSystem.prototype._registerInstance = function(entity, url, name, instance) {
        var data = this.getComponentData(entity);
        var instances = this.get(entity, "instances");
        if (instances[name]) {
            throw Error(pc.string.format("Script name collision '{0}'. Scripts from '{1}' and '{2}' {{3}}", name, url, instances[name].url, entity.getGuid()));
        }
        
        instances[name] = {
            url: url,
            name: name,
            instance: instance
        };
        this.set(entity, "instances", instances);
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
     * context.systems.script.message(enemy_entity, 'enemy', 'doDamage', 10);
     */
    ScriptComponentSystem.prototype.send = function (entity, name, functionName) {
        var args = pc.makeArray(arguments).slice(3);
        var instances = this.get(entity, "instances");
        var fn;        
        
        if(instances[name]) {
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

