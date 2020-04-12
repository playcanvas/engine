Object.assign(pc, function () {
    var ScriptLegacyComponent = function ScriptLegacyComponent(system, entity) {
        pc.Component.call(this, system, entity);

        this.on("set_scripts", this.onSetScripts, this);
    };
    ScriptLegacyComponent.prototype = Object.create(pc.Component.prototype);
    ScriptLegacyComponent.prototype.constructor = ScriptLegacyComponent;

    Object.assign(ScriptLegacyComponent.prototype, {
        send: function (name, functionName) {
            console.warn("DEPRECATED: ScriptLegacyComponent.send() is deprecated and will be removed soon. Please use: http://developer.playcanvas.com/user-manual/scripting/communication/");
            var args = pc.makeArray(arguments).slice(2);
            var instances = this.entity.script.instances;
            var fn;

            if (instances && instances[name]) {
                fn = instances[name].instance[functionName];
                if (fn) {
                    return fn.apply(instances[name].instance, args);
                }

            }
        },

        onEnable: function () {
            // if the scripts of the component have been loaded
            // then call the appropriate methods on the component
            if (this.data.areScriptsLoaded && !this.system.preloading) {
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
            this.system._disableScriptComponent(this);
        },

        onSetScripts: function (name, oldValue, newValue) {
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

                // get the urls
                var scripts = newValue;
                var urls = scripts.map(function (s) {
                    return s.url;
                });

                // try to load the scripts synchronously first
                if (this._loadFromCache(urls)) {
                    return;
                }

                // not all scripts are in the cache so load them asynchronously
                this._loadScripts(urls);
            }
        },

        // Check if only script attributes need updating in which
        // case just update the attributes and return otherwise return false
        _updateScriptAttributes: function (oldValue, newValue) {
            var onlyUpdateAttributes = true;

            if (oldValue.length !== newValue.length) {
                onlyUpdateAttributes = false;
            } else {
                var i, len = newValue.length;
                for (i = 0; i < len; i++) {
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
        _loadFromCache: function (urls) {
            var i, len;
            var cached = [];

            var prefix = this.system.app._scriptPrefix || "";
            var regex = /^http(s)?:\/\//i;

            for (i = 0, len = urls.length; i < len; i++) {
                var url = urls[i];
                if (!regex.test(url)) {
                    url = pc.path.join(prefix, url);
                }

                var type = this.system.app.loader.getFromCache(url, 'script');

                // if we cannot find the script in the cache then return and load
                // all scripts with the resource loader
                if (!type) {
                    return false;
                }

                cached.push(type);
            }

            for (i = 0, len = cached.length; i < len; i++) {
                var ScriptType = cached[i];

                // check if this is a regular JS file
                if (ScriptType === true) {
                    continue;
                }

                // ScriptType may be null if the script component is loading an ordinary JavaScript lib rather than a PlayCanvas script
                // Make sure that script component hasn't been removed since we started loading
                if (ScriptType && this.entity.script) {
                    // Make sure that we haven't already instantiated another identical script while loading
                    // e.g. if you do addComponent, removeComponent, addComponent, in quick succession
                    if (!this.entity.script.instances[ScriptType._pcScriptName]) {
                        var instance = new ScriptType(this.entity);
                        this.system._preRegisterInstance(this.entity, urls[i], ScriptType._pcScriptName, instance);
                    }
                }
            }

            if (this.data) {
                this.data.areScriptsLoaded = true;
            }

            // We only need to initialize after preloading is complete
            // During preloading all scripts are initialized after everything is loaded
            if (!this.system.preloading) {
                this.system.onInitialize(this.entity);
                this.system.onPostInitialize(this.entity);
            }

            return true;
        },

        _loadScripts: function (urls) {
            var count = urls.length;

            var prefix = this.system.app._scriptPrefix || "";

            urls.forEach(function (url) {
                var _url = null;
                var _unprefixed = null;
                // support absolute URLs (for now)
                if (url.toLowerCase().startsWith("http://") || url.toLowerCase().startsWith("https://")) {
                    _unprefixed = url;
                    _url = url;
                } else {
                    _unprefixed = url;
                    _url = pc.path.join(prefix, url);
                }
                this.system.app.loader.load(_url, "script", function (err, ScriptType) {
                    count--;
                    if (!err) {
                        // ScriptType is null if the script is not a PlayCanvas script
                        if (ScriptType && this.entity.script) {
                            if (!this.entity.script.instances[ScriptType._pcScriptName]) {
                                var instance = new ScriptType(this.entity);
                                this.system._preRegisterInstance(this.entity, _unprefixed, ScriptType._pcScriptName, instance);
                            }
                        }
                    } else {
                        console.error(err);
                    }
                    if (count === 0) {
                        this.data.areScriptsLoaded = true;

                        // We only need to initialize after preloading is complete
                        // During preloading all scripts are initialized after everything is loaded
                        if (!this.system.preloading) {
                            this.system.onInitialize(this.entity);
                            this.system.onPostInitialize(this.entity);
                        }
                    }
                }.bind(this));
            }.bind(this));
        }
    });

    return {
        ScriptLegacyComponent: ScriptLegacyComponent
    };
}());
