pc.extend(pc.fw, function () {
    var ComponentSystem = function (context) {
        this.context = context;
        this.dataStore = {};

        pc.extend(this, pc.events);
    };

    pc.extend(ComponentSystem, {
        initialize: function (root) {
            ComponentSystem.fire('initialize', root);
        },

        /**
        * Update all ComponentSystems
        */
        update: function (dt, context, inTools) {
            if (inTools) {
                ComponentSystem.fire('toolsUpdate', dt);
            } else {
                ComponentSystem.fire('update', dt);
            }
        },

        /**
        * Update all ComponentSystems
        */
        fixedUpdate: function (dt) {
            ComponentSystem.fire('fixedUpdate', dt);
        },

        /**
        * Update all ComponentSystems
        */
        postUpdate: function (dt) {
            ComponentSystem.fire('postUpdate', dt);
        }
    });
    pc.extend(ComponentSystem, pc.events);

    ComponentSystem.prototype = {
        /**
        * @name pc.fw.ComponentSystem#store
        * @description The store where all pc.fw.ComponentData objects are kept
        */
        get store() {
            return this.dataStore;
        },

        /**
        * @name pc.fw.ComponentSystem#addComponent
        * @description Create new pc.fw.Component and pc.fw.ComponentData instances and attach them to the entity
        */
        addComponent: function (entity, data) {
            var component = new this.ComponentType(this, entity);
            var componentData = new this.DataType();

            this.dataStore[entity.getGuid()] = {
                entity: entity,
                data: componentData
            };

            entity[this.id] = component;

            this.initializeComponentData(component, data, []);

            this.fire('add', entity, component);

            return component;
        },

        /**
        * @name pc.fw.ComponentSystem#removeComponent
        * @description Remove the pc.fwComponent from the entity and delete the associated pc.fw.ComponentData
        */
        removeComponent: function (entity) {
            var record = this.dataStore[entity.getGuid()];
            delete this.dataStore[entity.getGuid()];
            delete entity[this.id];
            this.fire('remove', entity, record.data);                
        },

        /**
        * @name pc.fw.ComponentSystem#initializeComponentData
        * @description Called during addComponent() to initialize the pc.fw.ComponentData in the store
        * This can be overridden by derived ComponentSystems and either called by the derived System or replaced entirely
        */
        initializeComponentData: function (component, data, properties) {
            data = data || {};
            
            // initialize
            properties.forEach(function(value) {
                if (typeof data[value] !== 'undefined') {
                    component[value] = data[value];
                } else {
                    component[value] = component.data[value];
                }
                
            }, this);
        },

        // update: function (dt) {

        // },

        // fixedUpdate: function (dt) {

        // },

        // postUpdate: function (dt) {

        // },

        // render: function () {

        // }
    };


    var Component = function (system, entity) {
        this.system = system;
        this.entity = entity;

        pc.extend(this, pc.events);

        this.bind("set", function (name, oldValue, newValue) {
            this.fire("set_" + name, oldValue, newValue);
        });
    };

    Component.prototype = {
        get data() {
            var record = this.system.store[this.entity.getGuid()];
            if (record) {
                return record.data;
            } else {
                return null;
            }
        },

        assignSchema: function (schema) {
            // Create getter/setter pairs for each property defined in the schema
            schema.forEach(function (prop) {
                var set;
                if (prop.readOnly) {
                    Object.defineProperty(this, prop.name, {
                        get: function () {
                            return this.data[prop.name];
                        }
                    });
                } else {
                    Object.defineProperty(this, prop.name, {
                        get: function () {
                            return this.data[prop.name];
                        },
                        set: function (value) {
                            var oldValue = this.data[prop.name];
                            this.data[prop.name] = value;
                            this.fire('set', prop.name, oldValue, value);                            
                        }
                    });
                };
            }.bind(this));

            // Expose properties to the Designer
            this.exposeProperties(schema);
        },

        exposeProperties: function (schema) {
            if (schema.exposed !== false) {
                editor.link.addComponentType(this.system.id);
                
                schema.forEach(function (prop) {
                    editor.link.expose(this.system.id, prop);
                }.bind(this));                
            }
        },

        // get: function (name) {
        //     var componentData = this.data;
        //     if(componentData) {
        //         // Check for accessor first (an accessor is a function with the same name but a leading underscore)
        //         if(this["_" + name] && typeof(this["_" + name]) === "function") {
        //             // found an accessor on the Component
        //             return this["_" + name](componentData);
        //         } else if(componentData[name] !== undefined) {
        //             return componentData[name];
        //         } 
        //     }        
        // },

        // set: function (name, value) {
        //     var oldValue;
        //     var componentData = this.data
        //     if(componentData) {
        //         oldValue = componentData[name];
        //         // Check for an accessor first, (an accessor is a function with the same name but a leading underscore)
        //         if(this["_" + name] && typeof(this["_" + name]) === "function") {
        //             this["_" + name](componentData, value);
        //         } else if(componentData[name] !== undefined) {
        //             componentData[name] = value;
        //         }
        //         this.fire('set', name, oldValue, value)
        //     }        
        // }
    };

    return {
        ComponentSystem: ComponentSystem,
        Component: Component
    };
}());
