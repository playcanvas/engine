pc.extend(pc, function () {
    /**
     * @constructor
     * @name pc.ComponentSystem
     * @classdesc Component Systems contain the logic and functionality to update all Components of a particular type.
     * @param {pc.Application} app The application managing this system.
     */
    var ComponentSystem = function (app) {
        this.app = app;
        this.dataStore = {};
        this.schema = [];

        pc.events.attach(this);
    };

    // Class methods
    pc.extend(ComponentSystem, {
        initialize: function (root) {
            ComponentSystem.fire('initialize', root);
        },

        postInitialize: function (root) {
            ComponentSystem.fire('postInitialize', root);
        },

        // Update all ComponentSystems
        update: function (dt, inTools) {
            if (inTools) {
                ComponentSystem.fire('toolsUpdate', dt);
            } else {
                ComponentSystem.fire('update', dt);
            }
        },

        // Update all ComponentSystems
        fixedUpdate: function (dt, inTools) {
            ComponentSystem.fire('fixedUpdate', dt);
        },

        // Update all ComponentSystems
        postUpdate: function (dt, inTools) {
            ComponentSystem.fire('postUpdate', dt);
        }
    });

    // Instance methods
    ComponentSystem.prototype = {
        /**
         * @private
         * @name pc.ComponentSystem#store
         * @description The store where all {@link pc.ComponentData} objects are kept
         */
        get store() {
            return this.dataStore;
        },

        /**
         * @private
         * @function
         * @name pc.ComponentSystem#addComponent
         * @description Create new {@link pc.Component} and {@link pc.ComponentData} instances and attach them to the entity
         * @param {pc.Entity} entity The Entity to attach this component to
         * @param {Object} data The source data with which to create the component
         * @returns {pc.Component} Returns a Component of type defined by the component system
         * @example
         *   var entity = new pc.Entity(app);
         *   app.systems.model.addComponent(entity, { type: 'box' });
         *   // entity.model is now set to a pc.ModelComponent
         */
        addComponent: function (entity, data) {
            var component = new this.ComponentType(this, entity);
            var componentData = new this.DataType();

            data = data || {};

            this.dataStore[entity._guid] = {
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
         * @private
         * @function
         * @name pc.ComponentSystem#removeComponent
         * @description Remove the {@link pc.Component} from the entity and delete the associated {@link pc.ComponentData}
         * @param {pc.Entity} entity The entity to remove the component from
         * @example
         * app.systems.model.removeComponent(entity);
         * // entity.model === undefined
         */
        removeComponent: function (entity) {
            var record = this.dataStore[entity._guid];
            var component = entity.c[this.id];
            this.fire('beforeremove', entity, component);
            delete this.dataStore[entity._guid];
            delete entity[this.id];
            delete entity.c[this.id];
            this.fire('remove', entity, record.data);
        },

        /**
         * @private
         * @function
         * @name pc.ComponentSystem#cloneComponent
         * @description Create a clone of component. This creates a copy all ComponentData variables.
         * @param {pc.Entity} entity The entity to clone the component from
         * @param {pc.Entity} clone The entity to clone the component into
         * @returns {pc.Component} The newly cloned component.
         */
        cloneComponent: function (entity, clone) {
            // default clone is just to add a new component with existing data
            var src = this.dataStore[entity._guid];
            return this.addComponent(clone, src.data);
        },

        /**
         * @private
         * @function
         * @name pc.ComponentSystem#initializeComponentData
         * @description Called during {@link pc.ComponentSystem#addComponent} to initialize the {@link pc.ComponentData} in the store
         * This can be overridden by derived Component Systems and either called by the derived System or replaced entirely
         * @param {pc.Component} component The component being initialized.
         * @param {Object} data The data block used to initialize the component.
         * @param {Array} properties The array of property descriptors for the component. A descriptor can be either a plain property name, or an object specifying the name and type.
         */
        initializeComponentData: function (component, data, properties) {
            data = data || {};

            // initialize
            properties.forEach(function (descriptor) {
                var name;
                var type;

                // If the descriptor is an object, it will have `name` and `type` members
                if (typeof descriptor === 'object') {
                    name = descriptor.name;
                    type = descriptor.type;
                // Otherwise, the descriptor is just the property name
                } else {
                    name = descriptor;
                }

                var value = data[name];

                if (value !== undefined) {
                    /*
                     * If we know the intended type of the value, convert the raw data
                     * into an instance of the specified type.
                     */
                    if (type !== undefined) {
                        value = convertValue(value, type);
                    }

                    component[name] = value;
                } else {
                    component[name] = component.data[name];
                }

            }, this);

            // after component is initialized call onEnable
            if (component.enabled && component.entity.enabled) {
                component.onEnable();
            }
        },

        /**
         * @private
         * @function
         * @name pc.ComponentSystem#getPropertiesOfType
         * @description Searches the component schema for properties that match the specified type.
         * @param {String} type The type to search for
         * @returns {Array} An array of property descriptors matching the specified type.
         */
        getPropertiesOfType: function (type) {
            var matchingProperties = [];
            var schema = this.schema || [];

            schema.forEach(function (descriptor) {
                if (descriptor && typeof descriptor === 'object' && descriptor.type === type) {
                    matchingProperties.push(descriptor);
                }
            });

            return matchingProperties;
        }
    };

    function convertValue(value, type) {
        if (!value) {
            return value;
        }

        value = (value && value.data) ? value.data : value;

        switch (type) {
            case 'rgb':
                return new pc.Color(value[0], value[1], value[2]);
            case 'rgba':
                return new pc.Color(value[0], value[1], value[2], value[3]);
            case 'vec2':
                return new pc.Vec2(value[0], value[1]);
            case 'vec3':
                return new pc.Vec3(value[0], value[1], value[2]);
            case 'vec4':
                return new pc.Vec4(value[0], value[1], value[2], value[3]);
            case 'boolean':
            case 'number':
            case 'string':
                return value;
            case 'entity':
                return value; // Entity fields should just be a string guid
            default:
                throw new Error('Could not convert unhandled type: ' + type);
        }
    }

    // Add event support
    pc.events.attach(ComponentSystem);

    ComponentSystem.destroy = function () {
        ComponentSystem.off('initialize');
        ComponentSystem.off('postInitialize');
        ComponentSystem.off('toolsUpdate');
        ComponentSystem.off('update');
        ComponentSystem.off('fixedUpdate');
        ComponentSystem.off('postUpdate');
    };

    return {
        ComponentSystem: ComponentSystem
    };
}());
