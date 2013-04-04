pc.extend(pc.fw, function () {
    /**
    * @name pc.fw.ComponentSystem
    * @class Component Systems contain the logic and functionality to update all Components of a particular type
    * @param {pc.fw.ApplicationContext} context The ApplicationContext for the running application
    */
    var ComponentSystem = function (context) {
        this.context = context;
        this.dataStore = {};
        this.schema = [];

        pc.extend(this, pc.events);
    };

    // Class methods
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

    // Instance methods
    ComponentSystem.prototype = {
        /**
        * @field
        * @type Array
        * @name pc.fw.ComponentSystem#store
        * @description The store where all {@link pc.fw.ComponentData} objects are kept
        */
        get store() {
            return this.dataStore;
        },

        /**
        * @function
        * @name pc.fw.ComponentSystem#addComponent
        * @description Create new {@link pc.fw.Component} and {@link pc.fw.ComponentData} instances and attach them to the entity
        * @param {pc.fw.Entity} entity The Entity to attach this component to
        * @param {Object} data The source data with which to create the compoent
        * @returns {pc.fw.Component} Returns a Component of type defined by the component system
        * @example 
        *   var data = {
        *       type: 'Box',
        *       color: '0xff0000'
        *   };
        *   var entity = new pc.fw.Entity();
        *   context.systems.primitive.addComponent(entity, data);
        *   // entity.primitive now set to a PrimitiveComponent
        */
        addComponent: function (entity, data) {
            var component = new this.ComponentType(this, entity);
            var componentData = new this.DataType();

            data = data || {};
            
            this.dataStore[entity.getGuid()] = {
                entity: entity,
                data: componentData
            };

            entity[this.id] = component;
            entity.c[this.id] = component;

            this.initializeComponentData(component, data, []);

            this.fire('add', entity, component);

            return component;
        },

        /**
        * @function
        * @name pc.fw.ComponentSystem#removeComponent
        * @description Remove the {@link pc.fw.Component} from the entity and delete the associated {@link pc.fw.ComponentData}
        * @param {pc.fw.Entity} entity The entity to remove the component from
        * @example
        * context.systems.primitive.removeComponent(this.entity);
        * // this.entity.primitive === undefined
        */
        removeComponent: function (entity) {
            var record = this.dataStore[entity.getGuid()];
            delete this.dataStore[entity.getGuid()];
            delete entity[this.id];
            delete entity.c[this.id];
            this.fire('remove', entity, record.data);
        },

        /**
        * @function
        * @name pc.fw.ComponentSystem#cloneComponent
        * @description Create a clone of component. This creates a copy all ComponentData variables.
        * @param {pc.fw.Entity} entity The entity to clone the component from
        * @param {pc.fw.Entity} clone The entity to clone the component into
        */
        cloneComponent: function (entity, clone) {
            // default clone is just to add a new component with existing data
            var src = this.dataStore[entity.getGuid()];
            return this.addComponent(clone, src.data);
        },

        /**
        * @private
        * @function
        * @name pc.fw.ComponentSystem#initializeComponentData
        * @description Called during {@link pc.fw.ComponentSystem#addComponent} to initialize the {@link pc.fw.ComponentData} in the store
        * This can be overridden by derived Component Systems and either called by the derived System or replaced entirely
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

        /**
        * @private
        * @function
        * @name pc.fw.ComponentSystem#exposeProperties
        * @description Expose properties into the Tools, set 'exposed: false' in to prevent properties appearing in the tools
        */
        exposeProperties: function () {
            editor.link.addComponentType(this.id);
                
            this.schema.forEach(function (prop) {
                if (prop.exposed !== false) {
                    editor.link.expose(this.id, prop);    
                }
            }.bind(this));                
        }
    };

    // Add event support
    pc.extend(ComponentSystem, pc.events);

    return {
        ComponentSystem: ComponentSystem
    };
}());