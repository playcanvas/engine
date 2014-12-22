pc.extend(pc, function () {
    /**
    * @name pc.Component
    * @constructor Base constructor for a Component
    * @class Components are used to attach functionality onto Entities. Components
    * can receive update events each frame, and expose properties to the tools.
    * @param {pc.ComponentSystem} system The ComponentSystem used to create this Component
    * @param {pc.Entity} entity The Entity that this Component is attached to
    */
    var Component = function (system, entity) {
        this.system = system;
        this.entity = entity;

        pc.events.attach(this);

        this.buildAccessors(this.system.schema);

        this.on("set", function (name, oldValue, newValue) {
            this.fire("set_" + name, name, oldValue, newValue);
        });

        this.on('set_enabled', this.onSetEnabled, this);
    };

    Component.prototype = {
        /**
        * @property
        * @name pc.Component#data
        * @description Access the {@link pc.ComponentData} directly. Usually you should
        * access the data properties via the individual properties as modifying this data directly 
        * will not fire 'set' events.
        * @type {pc.ComponentData} 
        */
        get data() {
            var record = this.system.store[this.entity.getGuid()];
            if (record) {
                return record.data;
            } else {
                return null;
            }
        },

        buildAccessors: function (schema) {
            // Create getter/setter pairs for each property defined in the schema
            schema.forEach(function (prop) {
                var set;
                if (prop.readOnly) {
                    Object.defineProperty(this, prop.name, {
                        get: function () {
                            return this.data[prop.name];
                        },
                        configurable: true
                    });
                } else {
                    Object.defineProperty(this, prop.name, {
                        get: function () {
                            return this.data[prop.name];
                        },
                        set: function (value) {
                            var data = this.data;
                            var oldValue = data[prop.name];
                            data[prop.name] = value;
                            this.fire('set', prop.name, oldValue, value);                            
                        },
                        configurable: true
                    });
                }
            }.bind(this));
        },

        onSetEnabled: function (name, oldValue, newValue) {
            if (oldValue !== newValue) {
                if (this.entity.enabled) {
                    if (newValue) {
                        this.onEnable();
                    } else {
                        this.onDisable();
                    }
                }
            }
        },

        onEnable: function () {
        },

        onDisable: function () {
        }
    };

    return {
        Component: Component
    };
}());
