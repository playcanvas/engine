pc.extend(pc.fw, function () {
    /**
    * @component
    * @name pc.fw.ScriptComponent
    * @class The ScriptComponent allows you to extend the functionality of an Entity by attaching your own javascript files
    * to be executed with access to the Entity. For more details on scripting see <a href="//developer.playcanvas.com/user-manual/scripting/">Scripting</a>.
    * @param {pc.fw.ScriptComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
    * @extends pc.fw.Component
    * @property {Boolean} enabled Enables or disables the Component. If the Component is disabled then the following methods will not be called on the script instances:
    * <ul>
    * <li>initialize</li>
    * <li>postInitialize</li>
    * <li>update</li>
    * <li>fixedUpdate</li>
    * <li>postUpdate</li>
    * </ul>
    * @property {Object[]} scripts An array of all the scripts to load. Each script object has this format:
    * {url: 'url.js', name: 'url', 'attributes': [attribute1, attribute2, ...]}
    */

    var ScriptComponent = function ScriptComponent(system, entity) {
        this.on("set_scripts", this.onSetScripts, this);
    };
    ScriptComponent = pc.inherits(ScriptComponent, pc.fw.Component);

    pc.extend(ScriptComponent.prototype, {
        /**
         * @private
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
            console.warn("DEPRECATED: ScriptComponent.send() is deprecated and will be removed soon. Please use: http://developer.playcanvas.com/user-manual/scripting/communication/")
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

        onEnable: function () {
            ScriptComponent._super.onEnable.call(this);

            // if the scripts of the component have been loaded
            // then call the appropriate methods on the component
            if (this.data.areScriptsLoaded) {
                if (!this.data.initialized) {
                    this.system._initializeScriptComponent(this);
                } else {
                    this.system._enableScriptComponent(this);
                }

                if (!this.data.postInitialized) {
                    this.system._postInitializeScriptComponent(this);
                }
            }
        },

        onDisable: function () {
            ScriptComponent._super.onDisable.call(this);
            this.system._disableScriptComponent(this);
        },

        onSetScripts: function(name, oldValue, newValue) {
            if (!this.system._inTools || this.runInTools) {
                // if we only need to update script attributes then update them and return
                if (this._updateScriptAttributes(oldValue, newValue)) {
                    return;
                }

                // disable the script first
                if (this.enabled) {
                    this.system._disableScriptComponent(this);
                }

                this.system._destroyScriptComponent(this);

                this.data.areScriptsLoaded = false;

                // get the urls and names to be loaded
                var scripts = newValue;

                // grab a unique set of urls and names so we don't load the same scripts multiple times if they are in the same url
                var urlsDict = {};
                var namesDict = {};
                for(var i = 0; i < scripts.length; ++i) {
                    urlsDict[scripts[i].url] = true;

                    if(scripts[i].name !== undefined) {
                        namesDict[scripts[i].name] = true;
                    }
                }

                var urls = [];
                for(var key in urlsDict) {
                    urls.push(key);
                }

                var names = [];
                for(var key in namesDict) {
                    names.push(key);
                }

                // try to load the scripts synchronously first
                if (this._loadFromCache(urls, names)) {
                    return;
                }

                // not all scripts are in the cache so load them asynchronously
                this._loadScripts(urls, names);
            }
        },

        // Check if only script attributes need updating in which
        // case just update the attributes and return otherwise return false
        _updateScriptAttributes: function (oldValue, newValue) {
            var onlyUpdateAttributes = true;

            if (oldValue.length !== newValue.length) {
                onlyUpdateAttributes = false;
            } else {
                var i; len = newValue.length;
                for (i=0; i<len; i++) {
                    if (oldValue[i].url !== newValue[i].url) {
                        onlyUpdateAttributes = false;
                        break;
                    }
                }
            }

            if (onlyUpdateAttributes) {
                for (var key in this.instances) {
                    if (this.instances.hasOwnProperty(key)) {
                        this.system._updateAccessors(this.entity, this.instances[key]);
                    }
                }
            }

            return onlyUpdateAttributes;
        },

        // Load each url from the cache synchronously. If one of the urls is not in the cache
        // then stop and return false.
        _loadFromCache: function (urls, names) {
            var cached = [];

            for (var i=0, len=urls.length; i<len; i++) {
                var type = this.system.context.loader.getFromCache(urls[i]);

                // if we cannot find the script in the cache then return and load
                // all scripts with the resource loader
                if (!type) {
                    return false;
                } else {
                    cached.push(type);
                }
            }

            for (var i=0, len=cached.length; i<len; i++) {
                var cachedResource = cached[i];

                // check if this is a regular JS file
                if (cachedResource == true) {
                    continue;
                }

                cachedResource.scripts.forEach(function (ScriptType, index) {
                    // Make sure that script component hasn't been removed since we started loading
                    // Also make sure to not load this if this script was in the same file as other scripts and it is not actually required
                    if (ScriptType && this.entity.script && (!names.length || names.indexOf(ScriptType._pcScriptName) >= 0)) {
                        // Make sure that we haven't already instaciated another identical script while loading
                        // e.g. if you do addComponent, removeComponent, addComponent, in quick succession
                        if (!this.entity.script.instances[ScriptType._pcScriptName]) {
                            var instance = new ScriptType(this.entity);
                            this.system._preRegisterInstance(this.entity, urls[i], ScriptType._pcScriptName, instance);
                        }
                    }
                }, this); 
            }

            if (this.data) {
                this.data.areScriptsLoaded = true;
            }

            // If there is no request batch, then this is not part of a load request and so we need
            // to register the instances immediately to call the initialize function
            this.system.onInitialize(this.entity);
            this.system.onPostInitialize(this.entity);

            return true;
        },

        // Load each script url asynchronously using the resource loader
        _loadScripts: function (urls, names) {
            // Load and register new scripts and instances
            var requests = urls.map(function (url) {
                return new pc.resources.ScriptRequest(url);
            });

            var options = {
                parent: this.entity.getRequest()
            };

            var promise = this.system.context.loader.request(requests, options);
            promise.then(function (resources) {
                resources.forEach(function (loadResult, resultsIndex) {
                    // loadResult may be null if the script component is loading an ordinary javascript lib rather than a PlayCanvas script
                    if(loadResult) {
                        loadResult.scripts.forEach(function (ScriptType, index) {
                            // Make sure that script component hasn't been removed since we started loading
                            // Also make sure to not load this if this script was in the same file as other scripts and it is not actually required
                            if (ScriptType && this.entity.script && (!names.length || names.indexOf(ScriptType._pcScriptName) >= 0)) {
                                // Make sure that we haven't already instaciated another identical script while loading
                                // e.g. if you do addComponent, removeComponent, addComponent, in quick succession
                                if (!this.entity.script.instances[ScriptType._pcScriptName]) {
                                    var instance = new ScriptType(this.entity);
                                    this.system._preRegisterInstance(this.entity, loadResult.url, ScriptType._pcScriptName, instance);
                                }
                            }
                        }, this);
                    }
                }, this);

                if (this.data) {
                    this.data.areScriptsLoaded = true;
                }

                // If there is no request batch, then this is not part of a load request and so we need
                // to register the instances immediately to call the initialize function
                if (!options.parent) {
                    this.system.onInitialize(this.entity);
                    this.system.onPostInitialize(this.entity);
                }
            }.bind(this)).then(null, function (error) {
                // Re-throw any exceptions from the Script constructor to stop them being swallowed by the Promises lib
                setTimeout(function () {
                    throw error;
                })
            });
        }

    });

    return {
        ScriptComponent: ScriptComponent
    };
}());
