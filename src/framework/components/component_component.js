pc.extend(pc, function () {
    /**
    * @name pc.Component
    * @constructor Base constructor for a Component
    * @class Components are used to attach functionality onto Entities. Components
    * can receive update events each frame, and expose properties to the tools.
    * @param {pc.ComponentSystem} system The ComponentSystem used to create this Component
    * @param {pc.Entity} entity The Entity that this Component is attached to
    *
    * @property {pc.ComponentData} data Access the {@link pc.ComponentData} directly.
    * Usually you should access the data properties via the individual properties as
    * modifying this data directly will not fire 'set' events.
    */
    var Component = function (system, entity) {
        this.system = system;
        this.entity = entity;

        pc.events.attach(this);

        if (this.system.schema) {
            this.buildAccessors(this.system.schema);
        }

        this.on("set", function (name, oldValue, newValue) {
            this.fire("set_" + name, name, oldValue, newValue);
        });

        this.on('set_enabled', this.onSetEnabled, this);
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

        buildAccessors: function (schema) {
            var self = this;

            // Create getter/setter pairs for each property defined in the schema
            schema.forEach(function (prop) {
                Object.defineProperty(self, prop, {
                    get: function () {
                        return self.data[prop];
                    },
                    set: function (value) {
                        var data = self.data;
                        var oldValue = data[prop];
                        data[prop] = value;
                        self.fire('set', prop, oldValue, value);
                    },
                    configurable: true
                });
            });
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
