pc.extend(pc.fw, function () {
    
    function _onSet (entity, name, oldValue, newValue) {
        var component;
        var functions = {
            "urls": function(entity, name, oldValue, newValue){
                var urls = newValue;
                if(pc.type(urls) == "string") {
                    urls = urls.split(",");
                }
               
                // Load and register new scripts and instances
                urls.forEach(function (url, index, arr) {
                    var url = new pc.URI(pc.path.join(pc.content.source, urls[index].trim())).toString();
                    this.context.loader.request(new pc.resources.ScriptRequest(url), function (resources) {
                        var ScriptType = resources[url];
                        instance = new ScriptType(entity);
                        this.registerInstance(entity, url, ScriptType._pcScriptName, instance);                        
                    }.bind(this));
                }, this);
            }
        };
        
        if(functions[name]) {
            functions[name].call(this, entity, name, oldValue, newValue);
        }
    }
    
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

        this.bind("set", pc.callback(this, _onSet));
    }
    ScriptComponentSystem = ScriptComponentSystem.extendsFrom(pc.fw.ComponentSystem);

    ScriptComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.ScriptComponentData();
        var properties = ["urls"];
        var index;
        var length;
        var url;
        var obj;
        var instance;
        data = data || {};
                    
        this.addComponent(entity, componentData);
        
        // Set all properties
        properties.forEach(function (value, index, arr) {
            if(pc.isDefined(data[value])) {
                this.set(entity, value, data[value]);
            }
        }, this);
        
        return componentData;
    };

    ScriptComponentSystem.prototype.update = function (dt) {
        var instance;
        var i;
        var entity;
        var component;
        var components = this._getComponents();
        var length = components.length;
        
        for (id in components) {
            if (components.hasOwnProperty(id)) {
                entity = components[id].entity;
                component = components[id].component;
                
                data = this._getComponentData(entity);
                length = data.instances.length;
                
                for(name in data.instances) {
                    if(data.instances.hasOwnProperty(name)) {
                        if(data.instances[name].instance.update) {
                            data.instances[name].instance.update(dt);
                        }                        
                    }
                }
            }
        }
    };

    ScriptComponentSystem.prototype.render = function () {
        var instance;
        var i;
        var entity;
        var component;
        var components = this._getComponents();
        var length = components.length;
        
        for (id in components) {
            if (components.hasOwnProperty(id)) {
                entity = components[id].entity;
                component = components[id].component;
                
                data = this._getComponentData(entity);
                length = data.instances.length;
                
                for(name in data.instances) {
                    if(data.instances.hasOwnProperty(name)) {
                        if(data.instances[name].instance.render) {
                            data.instances[name].instance.render();
                        }                        
                    }
                }
            }
        }
    }
   
    ScriptComponentSystem.prototype.registerInstance = function(entity, url, name, instance) {
        var data = this._getComponentData(entity);
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
     * @name pc.fw.ScriptComponentSystem#message
     * @description Send a message (i.e. call a function) on the a script attached to a specific entity
     * @param {pc.fw.Entity} entity The entity to send the message to
     * @param {String} name The name of the script to send the message to
     * @param {String} functionName The name of the function to call on the script
     * @returns The result of the function call
     */
    ScriptComponentSystem.prototype.message = function (entity, name, functionName) {
        var args = pc.makeArray(arguments).slice(3);
        var instances = this.get(entity, "instances");
        var i, length = Object.keys(instances).length;
        var fn;        
        
        if(instances[name]) {
            fn = instances[name].instance[functionName];
            if (fn) {
                return fn.apply(instances[name].instance, args);    
            }
            
        }
    };
     
    return {
        ScriptComponentSystem: ScriptComponentSystem
    };
}());

