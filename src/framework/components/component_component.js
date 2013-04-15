pc.extend(pc.fw, function () {
    /**
    * @name pc.fw.Component
    * @constructor Base constructor for a Component
    * @class Components are used to attach functionality onto Entities. Components
    * can receive update events each frame, and expose properties to the tools.
    * @param {pc.fw.ComponentSystem} system The ComponentSystem used to create this Component
    * @param {pc.fw.Entity} entity The Entity that this Component is attached to
    */
    var Component = function (system, entity) {
        this.system = system;
        this.entity = entity;

        pc.extend(this, pc.events);

        this.buildAccessors(this.system.schema);

        this.on("set", function (name, oldValue, newValue) {
            this.fire("set_" + name, name, oldValue, newValue);
        });
    };

    Component.prototype = {
        /**
        * @property
        * @name pc.fw.Component#data
        * @description Access the {@link pc.fw.ComponentData} directly. Usually you should
        * access the data properties via the individual properties as modifying this data directly 
        * will not fire 'set' events.
        * @type {pc.fw.ComponentData} 
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
                }
            }.bind(this));
        }
    };

    return {
        Component: Component
    };
}());
