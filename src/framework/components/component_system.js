pc.extend(pc.fw, function () {
    var ComponentSystem = function (context) {
        this.context = context;
        this.dataStore = {};

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
            entity.c[this.id] = component;

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
            delete entity.c[this.id];
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
        }
    };

    // Add event support
    pc.extend(ComponentSystem, pc.events);

    return {
        ComponentSystem: ComponentSystem,
    };
}());
