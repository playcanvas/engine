pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.ComponentSystem
     * @constructor Base constructor for all Component Systems.
     * @class The ComponentSystem contains the code and functionality for a particular aspect of a game objects behaviour.
     * The ComponentSystem class contains functionality but no data, it is matched with a ComponentData class which contains
     * all data but no functionality/code.
     * @example
     * var entity = ... (get the entity from somewhere)
     * var context = ... (your pc.fw.ApplicationContext)
     * 
     * var fov = context.systems.camera.get(entity, "fov");
     * fov = 120; // Change the camera FOV (field of view)
     * context.systems.camera.set(entity, "fov", fov):
     * @param {pc.fw.ApplicationContext} context The ApplicationContext used for this ComponentSystem
     */
    var ComponentSystem = function ComponentSystem(context) {
        var _components = {};
        this._name = "";
        this.context = context;
        
        /**
         * @function
         * @private
         * @name pc.fw.ComponentSystem#getComponents
         * @description Get a Object containing all entities and the ComponentData for this ComponentSystem
         * @returns {Object}  An Object containing {Entity, ComponentData} objects keyed by the Entity's guid
         */
        this.getComponents = function () {
            return _components;
        };
        this._getComponents = this.getComponents;
        
        /**
         * @function
         * @private
         * @name pc.fw.ComponentSystem#getComponentData
         * @description Get the ComponentData object for this Entity and ComponentSystem.
         * Note, that editing the ComponentData should be done through the ComponentSystem.set and ComponentSystem.get methods, in order for changes events to be fired
         * @param {pc.fw.Entity} entity The Entity to get the ComponentData for
         * @returns {pc.fw.ComponentData} The ComponentData object for this entity
         */
        this.getComponentData = function (entity) {
                if (_components[entity.getGuid()]) {
                    return _components[entity.getGuid()].component;
                } else {
                    return null;
            }
        };  
        this._getComponentData = this.getComponentData;
        
        //Add support for events
        pc.extend(this, pc.events);
        
        this.bind("set", function (entity, name, newValue, oldValue) {
            // Re-fire a set event but with the name customized to the value being changed.
            // So Component authors can bind to events for each data value e.g. this.bind("set_type", ...);
            this.fire("set_" + name, entity, name, newValue, oldValue);
        });
    };
    
    /* Static */
    
    /**
     * @function
     * @name pc.fw.ComponentSystem.update
     * @description Update all ComponentSystems from a single ComponentSystemRegistry  that have an update() method 
     * @param {Object} dt The time delta since the last update
     * @param {pc.fw.ApplicationContext} context The ApplicationContext with the ComponentSystemRegistry 
     * @param {Boolean} inTools If true then call toolsUpdate instead of normal update. 
     */
    ComponentSystem.update = function (dt, context, inTools) {
        var name;
        var registry = context.systems;
        
        for (name in registry) {
            if (registry.hasOwnProperty(name)) {
                if(!inTools) {
                    if (registry[name].update) {
                        registry[name].update(dt);
                    }           
                } else {
                    if (registry[name].toolsUpdate) {
                        registry[name].toolsUpdate(dt);
                    }                               
                }
            }
        }
    };
    
    /**
     * @function
     * @name pc.fw.ComponentSystem.updateFixed
     * @description Update all ComponentSystems from a single ComponentSystemRegistry that have an updateFixed() method 
     * @param {Object} dt The fixed time delta set to 1/60 seconds by default.
     * @param {pc.fw.ApplicationContext} context The ApplicationContext with the ComponentSystemRegistry 
     * @param {Boolean} inTools If true then call toolsUpdate instead of normal update. 
     */
    ComponentSystem.updateFixed = function (dt, context, inTools) {
        var name;
        var registry = context.systems;
        
        for (name in registry) {
            if (registry.hasOwnProperty(name)) {
                if(!inTools) {
                    if (registry[name].updateFixed) {
                        registry[name].updateFixed(dt);
                    }           
                } else {
                    if (registry[name].toolsUpdateFixed) {
                        registry[name].toolsUpdateFixed(dt);
                    }                               
                }
            }
        }
    };
    
    /**
     * @function
     * @name pc.fw.ComponentSystem.render
     * @description Render all ComponentSystems from a single ComponentSystemRegistry that have a render() method
     * @param {pc.fw.ApplicationContext} context The ApplicationContext
     * @param {Boolean} tools If true also call toolRender() function for tools specfic rendering
     */
    ComponentSystem.render = function (context, inTools) {
        var name;
        var registry = context.systems;
        
        for (name in registry) {
            if (registry.hasOwnProperty(name)) {
                if (registry[name].render) {
                    registry[name].render();
                }                    
                if(inTools && registry[name].toolsRender) {
                    registry[name].toolsRender();
                }
            }
        }   
    };
    
    ComponentSystem.toolUpdate = function (dt, context) {
        
    };
    
    ComponentSystem.toolRender = function (context) {
        
    };
     
    /**
     * Delete all components for this Entity
     * @param {pc.fw.Entity} entity
     * @param {pc.fw.ComponentSystemRegistry} registry The registry containing the ComponentSystem
     * @function
     * @name pc.fw.ComponentSystem.deleteComponents
     */
    ComponentSystem.deleteComponents = function (entity, registry) {
        var name;
        var component;
        
        for (name in registry) {
            if (registry.hasOwnProperty(name)) {
                if(registry[name]._getComponentData(entity)) {
                    registry[name].deleteComponent(entity);
                }
            }
        }
    }
    
    /* Instance */
    
    /**
     * @function
     * @name pc.fw.ComponentSystem#hasComponent
     * @description Check if the Entity has a this Component.
     * @param {pc.fw.Entity} entity The Entity to check for a Component
     */   
    ComponentSystem.prototype.hasComponent = function (entity) {
        return (this._getComponentData(entity) !== null);
    }
    
    ComponentSystem.prototype.initialiseComponent = function (entity, componentData, data, properties) {
        this.addComponent(entity, componentData);
        
        data = data || {};
        
        // initialise
        properties.forEach(function(value, index, arr) {
            if (typeof data[value] !== 'undefined') {
                this.set(entity, value, data[value]);
            } else {
                this.set(entity, value, componentData[value]);                
            }
            
        }, this);
        
    };
    
    /**
     * @function
     * @name pc.fw.ComponentSystem#createComponent
     * @description Create a new ComponentSystem attached to the entity
     * @param {pc.fw.Entity} entity Create a new ComponentSystem attached to this Entity
     * @param {Object} data Data to initialize the ComponentData with
     */
    ComponentSystem.prototype.createComponent = function (entity, data) {  
        throw new Error("createComponent not implemented");
    };
    
    /**
     * @function
     * @name pc.fw.ComponentSystem#deleteComponent
     * @description Delete this ComponentSystem's Component from this entity
     * @param {pc.fw.Entity} entity The Entity to delete a Component from
     */
    ComponentSystem.prototype.deleteComponent = function (entity) {
        var component = this._getComponentData(entity);
        this.removeComponent(entity);
    };
    
    /**
     * @function
     * @name pc.fw.ComponentSystem#addComponent
     * @description Add a Component to this Entity by attaching a ComponentData object to it.
     * @param {pc.fw.Entity} entity The Entity to add the Component to
     * @param {pc.fw.ComponentData} data The ComponentData to be added
     */
    ComponentSystem.prototype.addComponent = function (entity, data) {
        var components = this._getComponents();
        components[entity.getGuid()] = {
            entity: entity,
            component: data
        };
    };
    
    /**
     * @function
     * @name pc.fw.ComponentSystem#removeComponent
     * @description Remove a Component from this Entity
     * @param {pc.fw.Entity} entity The Entity to remove the Component from
     */
    ComponentSystem.prototype.removeComponent = function (entity) {
        var components = this._getComponents();
        delete components[entity.getGuid()];
    };
    
    /**
     * @function
     * @name pc.fw.ComponentSystem#set
     * @description Set a value in the ComponentData. 
     * This method will silently continue even if the entity doesn't have the component required.
     * @param {pc.fw.Entity} entity The Entity to modify
     * @param {String} name The name of the property to modify
     * @param {Object} value The new value for the property
     */
    ComponentSystem.prototype.set = function (entity, name, value) {
        var oldValue;
        var componentData = this._getComponentData(entity);
        
        if(componentData) {

            oldValue = componentData[name];
            // Check for an accessor first, (an accessor is a function with the same name but a leading underscore)
            if(this["_" + name] && typeof(this["_" + name]) === "function") {
                this["_" + name](componentData, value);
            } else if(componentData[name] !== undefined) {
                componentData[name] = value;
            }
            this.fire('set', entity, name, oldValue, value)
        }
    }
    
    /**
     * @function
     * @name pc.fw.ComponentSystem#get
     * @description Return a value from the ComponentData
     * @param {pc.fw.Entity} entity The Entity to access
     * @param {String} name The name of the property to access
     * @return {Object} Value of property or null if property or component doesn't exist
     */
    ComponentSystem.prototype.get = function (entity, name) {
        var componentData = this._getComponentData(entity);
        if(componentData) {
            // Check for accessor first (an accessor is a function with the same name but a leading underscore)
            if(this["_" + name] && typeof(this["_" + name]) === "function") {
                // found an accessor on the Component
                return this["_" + name](componentData);
            } else if(componentData[name] !== undefined) {
                return componentData[name];
            } 
        }
    }
    
    return {
        ComponentSystem: ComponentSystem
    };
    
}());

