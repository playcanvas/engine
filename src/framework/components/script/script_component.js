pc.extend(pc.fw, function () {
    /**
    * @component
    * @name pc.fw.ScriptComponent
    * @class The ScriptComponent allows you to extend the functionality of an Entity by attaching your own javascript files
    * to be executed with access to the Entity.
    * @param {pc.fw.ScriptComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
    * @extends pc.fw.Component
    * @property {String[]} urls The URLs of all scripts to load
    */
    var ScriptComponent = function ScriptComponent(system, entity) {
        this.on("set_scripts", this.onSetScripts, this);
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

        onSetScripts: function(name, oldValue, newValue) {
            var scripts = newValue;
            var urls = scripts.map(function (s) {
                return s.url;
            });

            if (!this.system._inTools || this.runInTools) {
                // Load and register new scripts and instances
                var requests = urls.map(function (url) {
                    return new pc.resources.ScriptRequest(url);
                });
                var options = {
                    parent: this.entity.getRequest()
                };
                var promise = this.system.context.loader.request(requests, options); 
                promise.then(function (resources) {
                    resources.forEach(function (ScriptType, index) {
                        // ScriptType may be null if the script component is loading an ordinary javascript lib rather than a PlayCanvas script
                        // Make sure that script component hasn't been removed since we started loading
                        if (ScriptType && this.entity.script) {
                            // Make sure that we haven't already instaciated another identical script while loading
                            // e.g. if you do addComponent, removeComponent, addComponent, in quick succession
                            if (!this.entity.script.instances[ScriptType._pcScriptName]) { 
                                var instance = new ScriptType(this.entity);
                                this.system._preRegisterInstance(this.entity, urls[index], ScriptType._pcScriptName, instance);
                            }
                        }
                    }, this);
                    // If there is no request batch, then this is not part of a load request and so we need 
                    // to register the instances immediately to call the initialize function
                    if (!options.parent) {
                        this.system.onInitialize(this.entity);
                    }
                }.bind(this)).then(null, function (error) {
                    // Re-throw any exceptions from the Script constructor to stop them being swallowed by the Promises lib
                    setTimeout(function () {
                        throw error;
                    })
                });

                // urls.forEach(function (url, index, arr) {
                //     var url = urls[index].trim();
                //     var options = {
                //         parent: this.entity.getRequest()
                //     };
                //     var promise = this.system.context.loader.request(new pc.resources.ScriptRequest(url), options); 
                //     promise.then(function (resources) {
                //         var ScriptType = resources[0];

                //         // ScriptType may be null if the script component is loading an ordinary javascript lib rather than a PlayCanvas script
                //         // Make sure that script component hasn't been removed since we started loading
                //         if (ScriptType && this.entity.script) {
                //             // Make sure that we haven't already instaciated another identical script while loading
                //             // e.g. if you do addComponent, removeComponent, addComponent, in quick succession
                //             if (!this.entity.script.instances[ScriptType._pcScriptName]) { 
                //                 var instance = new ScriptType(this.entity);
                //                 this.system._preRegisterInstance(this.entity, url, ScriptType._pcScriptName, instance);
                                
                //                 // If there is no request batch, then this is not part of a load request and so we need 
                //                 // to register the instances immediately to call the initialize function
                //                 if (!options.parent) {
                //                     this.system.onInitialize(this.entity);
                //                 }
                //             }
                            
                //         }
                //     }.bind(this)).then(null, function (error) {
                //         // Re-throw any exceptions from the Script constructor to stop them being swallowed by the Promises lib
                //         setTimeout(function () {
                //             throw error;
                //         })
                //     });
                // }, this);            
            }
        }
    });

    return {
        ScriptComponent: ScriptComponent
    };
}());