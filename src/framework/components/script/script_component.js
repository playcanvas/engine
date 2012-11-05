pc.extend(pc.fw, function () {
    var ScriptComponent = function ScriptComponent(entity) {
        this.bind("set_urls", this.onSetUrls.bind(this));
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
         * // Call doDamage(10) on the script object called 'enemy' attached to entityEntity.
         * entityEntity.script.send('enemy', 'doDamage', 10);
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
                
        /**
         * @function
         * @name pc.fw.ScriptComponentSystem#broadcast
         * @description Send a message to all Script Objects with a specific name.
         * Sending a message is similar to calling a method on a Script Object, except that the message will not fail if the method isn't present
         * @param {String} name The name of the script to send the message to
         * @param {String} functionName The name of the functio nto call on the Script Object
         * @example
         * // Call doDamage(10) on all 'enemy' scripts
         * entityEntity.script.broadcast('enemy', 'doDamage', 10);
         */
        broadcast: function (name, functionName) {
            var args = pc.makeArray(arguments).slice(1);
            
            var id, entity, componentData, fn;
            var dataStore = this.system.store;
            var results = [];
            
            for (id in dataStore) {
                if (dataStore.hasOwnProperty(id)) {
                    entity = dataStore[id].entity;
                    data = dataStore[id].data;
                    if (data.instances[name]) {
                        fn = data.instances[name].instance[functionName];
                        if(fn) {
                            fn.apply(data.instances[name].instance, args);
                        }
                    }
                }
            }
        },

        onSetUrls: function(name, oldValue, newValue) {
            var urls = newValue;
            var prefix = pc.content.source || "";

            var options = {
                batch: this.entity.getRequestBatch()
            };
            
            if (!this.system._inTools || this.runInTools) {
                // Load and register new scripts and instances
                urls.forEach(function (url, index, arr) {
                    var url = new pc.URI(pc.path.join(prefix, urls[index].trim())).toString();
                    this.system.context.loader.request(new pc.resources.ScriptRequest(url), function (resources) {
                        var ScriptType = resources[url];

                        // ScriptType may be null if the script component is loading an ordinary javascript lib rather than a PlayCanvas script
                        if (ScriptType) {
                            var instance = new ScriptType(this.entity);
                            this.system._preRegisterInstance(this.entity, url, ScriptType._pcScriptName, instance);
                            
                            // If there is no request batch, then this is not part of a load request and so we need 
                            // to register the instances immediately to call the initialize function
                            if (!options.batch) {
                                this.system._registerInstances(this.entity);
                            }                        
                        }
                    }.bind(this), function (errors) {
                        Object.keys(errors).forEach(function (key) {
                            logERROR(errors[key]);
                        });
                    }, function (progress) {
                        
                    }, options);
                }, this);            
            }
        }
    });

    return {
        ScriptComponent: ScriptComponent,
    };
}());

