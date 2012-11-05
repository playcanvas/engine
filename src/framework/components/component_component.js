pc.extend(pc.fw, function () {
    var Component = function (system, entity) {
        this.system = system;
        this.entity = entity;

        pc.extend(this, pc.events);

        this.bind("set", function (name, oldValue, newValue) {
            this.fire("set_" + name, name, oldValue, newValue);
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
        Component: Component
    };
}());
