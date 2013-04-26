pc.extend(pc.fw, function () {
    /**
    * @component
    * @name pc.fw.ScriptComponent
    * @class The ScriptComponent allows you to extend the functionality of an Entity by attaching your own javascript files
    * to be executed with access to the Entity.
    * @param {pc.fw.ScriptComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
    * @extends pc.fw.Component
    */
    var ScriptComponent = function ScriptComponent(system, entity) {
        this.on("set_urls", this.onSetUrls, this);
    };
    ScriptComponent = pc.inherits(ScriptComponent, pc.fw.Component);

    pc.extend(ScriptComponent.prototype, {
        /**
         * @function
         * @name pc.fw.ScriptComponent#send
         * @description Send a message to a script attached to the entity.
         * Sending a message to a script is similar to calling a method on a Script Object, except that the message will not fail if the method isn't present.
         * @param {String} name The name of the script to send the message to
         * @param {String} functionName The name of the function to call on the script
         * @returns The result of the function call
         * @example
         * // Call doDamage(10) on the script object called 'enemy' attached to entity.
         * entity.script.send('enemy', 'doDamage', 10);
         */
        send: function (name, functionName) {
            var args = pc.makeArray(arguments).slice(2);
            var instances = this.entity.script.instances;
            var fn;
            
            if(instances && instances[name]) {
                fn = instances[name].instance[functionName];
                if (fn) {
                    return fn.apply(instances[name].instance, args);    
                }
                
            }
        },

        onSetUrls: function(name, oldValue, newValue) {
            var urls = newValue;

            if (!this.system._inTools || this.runInTools) {
                // Load and register new scripts and instances
                urls.forEach(function (url, index, arr) {
                    var url = urls[index].trim();
                    var options = {
                        parent: this.entity.getRequest()
                    };
                    var promise = this.system.context.loader.request(new pc.resources.ScriptRequest(url), options); 
                    promise.then(function (resources) {
                        var ScriptType = resources[0];

                        // ScriptType may be null if the script component is loading an ordinary javascript lib rather than a PlayCanvas script
                        if (ScriptType) {
                            var instance = new ScriptType(this.entity);
                            this.system._preRegisterInstance(this.entity, url, ScriptType._pcScriptName, instance);
                            
                            // If there is no request batch, then this is not part of a load request and so we need 
                            // to register the instances immediately to call the initialize function
                            if (!options.parent) {
                                this.system.onInitialize(this.entity);
                            }
                        }
                    }.bind(this));
                }, this);            
            }
        }
    });

    return {
        ScriptComponent: ScriptComponent
    };
}());