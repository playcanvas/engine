pc.extend(pc, function () {
    /**
    * @component
    * @name pc.ScriptComponent
    * @class The ScriptComponent allows you to extend the functionality of an Entity by attaching your own Script Instances defined in javascript files
    * to be executed with access to the Entity. For more details on scripting see <a href="//developer.playcanvas.com/user-manual/scripting/">Scripting</a>.
    * @param {pc.ScriptComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.Entity} entity The Entity that this Component is attached to.
    * @extends pc.Component
    * @property {Array} scripts An array of all Script Instances attached to an entity. This Array shall not be modified by developer.
    */

    var ScriptComponent = function ScriptComponent(system, entity) {
        this._scripts = [ ];
        this._scriptsIndex = { };
        this._scriptsData = null;
        this._oldState = true;
        this.on('set_enabled', this._onSetEnabled, this);
    };
    ScriptComponent = pc.inherits(ScriptComponent, pc.Component);

    ScriptComponent.scriptMethods = {
        initialize: 'initialize',
        postInitialize: 'postInitialize',
        update: 'update',
        postUpdate: 'postUpdate',
        swap: 'swap'
    };

    /**
    * @event
    * @name pc.ScriptComponent#enabled
    * @description Fired when Component becomes enabled
    * Note: this event does not takes in account entity or any of its parent enabled state
    * @example
    * entity.script.on('enabled', function () {
    *     // component is enabled
    * });
    */

    /**
    * @event
    * @name pc.ScriptComponent#disabled
    * @description Fired when Component becomes disabled
    * Note: this event does not takes in account entity or any of its parent enabled state
    * @example
    * entity.script.on('disabled', function () {
    *     // component is disabled
    * });
    */

    /**
    * @event
    * @name pc.ScriptComponent#state
    * @description Fired when Component changes state to enabled or disabled
    * Note: this event does not takes in account entity or any of its parent enabled state
    * @param {Boolean} enabled True if now enabled, False if disabled
    * @example
    * entity.script.on('state', function (enabled) {
    *     // component changed state
    * });
    */

    /**
    * @event
    * @name pc.ScriptComponent#remove
    * @description Fired when Component is removed from entity
    * @example
    * entity.script.on('remove', function () {
    *     // entity has no more script component
    * });
    */

    /**
    * @event
    * @name pc.ScriptComponent#create
    * @description Fired when Script Instance is created and attached to component
    * @param {String} name The Name of Script Instance created
    * @param {Object} scriptInstance Script Instance that has been created
    * @example
    * entity.script.on('create', function (name, scriptInstance) {
    *     // new script instance added to component
    * });
    */

    /**
    * @event
    * @name pc.ScriptComponent#create:[name]
    * @description Fired when Script Instance is created and attached to component
    * @param {Object} scriptInstance Script Instance that has been created
    * @example
    * entity.script.on('create:playerController', function (scriptInstance) {
    *     // new script instance 'playerController' is added to component
    * });
    */

    /**
    * @event
    * @name pc.ScriptComponent#destroy
    * @description Fired when Script Instance is destroyed and removed from component
    * @param {String} name The Name of Script Instance destroyed
    * @param {Object} scriptInstance Script Instance that has been destroyed
    * @example
    * entity.script.on('destroy', function (name, scriptInstance) {
    *     // script instance has been destroyed and removed from component
    * });
    */

    /**
    * @event
    * @name pc.ScriptComponent#destroy:[name]
    * @description Fired when Script Instance is destroyed and removed from component
    * @param {Object} scriptInstance Script Instance that has been destroyed
    * @example
    * entity.script.on('destroy:playerController', function (scriptInstance) {
    *     // script instance 'playerController' has been destroyed and removed from component
    * });
    */

    /**
    * @event
    * @name pc.ScriptComponent#error
    * @description Fired when Script Instance had an exception
    * @param {String} script Script Instance exception happened in
    * @param {Error} err Native JS Error object with details of error
    * @param {String} method Script Instance method exception originated from
    * @example
    * entity.script.on('error', function (scriptInstance, err, method) {
    *     // script instance caught an exception
    * });
    */

    pc.extend(ScriptComponent.prototype, {
        onEnable: function () {
            ScriptComponent._super.onEnable.call(this);
            this._checkState();
        },

        onDisable: function () {
            ScriptComponent._super.onDisable.call(this);
            this._checkState();
        },

        onPostStateChange: function() {
            var script;
            for(var i = 0; i < this.scripts.length; i++) {
                script = this.scripts[i];

                if (script._initialized && ! script._postInitialized) {
                    script._postInitialized = true;

                    if (script.postInitialize)
                        this._scriptMethod(script, ScriptComponent.scriptMethods.postInitialize);
                }
            }
        },

        _onSetEnabled: function(prop, old, value) {
            this._checkState();
        },

        _checkState: function() {
            var state = this.enabled && this.entity.enabled;
            if (state === this._oldState)
                return;

            this._oldState = state;

            this.fire('enabled');
            this.fire('state', this.enabled);

            var script;
            for(var i = 0, len = this.scripts.length; i < len; i++) {
                script = this.scripts[i];
                script.enabled = script._enabled;

                if (! script._initialized && script.enabled) {
                    script._initialized = true;

                    if (script.initialize)
                        this._scriptMethod(script, ScriptComponent.scriptMethods.initialize);
                }
            }
        },

        _onBeforeRemove: function() {
            this.fire('remove');

            // destroy all scripts
            var destroyed = true;
            while(this.scripts.length > 0 && destroyed)
                destroyed = this.destroy(this.scripts[0].__scriptObject.__name);
        },

        _onInitializeAttributes: function() {
            for(var i = 0, len = this.scripts.length; i < len; i++)
                this.scripts[i].__initializeAttributes();
        },

        _scriptMethod: function(script, method, arg) {
            try {
                script[method](arg);
            } catch(ex) {
                // disable script if it fails to call method
                script.enabled = false;

                if (! script._callbacks || ! script._callbacks.error) {
                    console.warn('unhandled exception while calling "' + method + '" for "' + script.__scriptObject.__name + '" script: ', ex);

                    // #ifdef DEBUG
                    console.error(ex.stack);
                    // #endif
                }

                script.fire('error', ex, method);
                this.fire('error', script, ex, method);
            }
        },

        _onInitialize: function() {
            var script;
            for(var i = 0, len = this.scripts.length; i < len; i++) {
                script = this.scripts[i];
                if (script.enabled && ! script._initialized) {
                    script._initialized = true;
                    if (script.initialize)
                        this._scriptMethod(script, ScriptComponent.scriptMethods.initialize);
                }
            }
        },

        _onPostInitialize: function() {
            var script;
            for(var i = 0, len = this.scripts.length; i < len; i++) {
                script = this.scripts[i];
                if (script.enabled && ! script._postInitialized) {
                    script._postInitialized = true;
                    if (script.postInitialize)
                        this._scriptMethod(script, ScriptComponent.scriptMethods.postInitialize);
                }
            }
        },

        _onUpdate: function(dt) {
            var script;
            for(var i = 0, len = this.scripts.length; i < len; i++) {
                script = this.scripts[i];
                if (script.enabled && script.update)
                    this._scriptMethod(script, ScriptComponent.scriptMethods.update, dt);
            }
        },

        _onPostUpdate: function(dt) {
            var script;
            for(var i = 0, len = this.scripts.length; i < len; i++) {
                script = this.scripts[i];
                if (script.enabled && script.postUpdate)
                    this._scriptMethod(script, ScriptComponent.scriptMethods.postUpdate, dt);
            }
        },

        /**
         * @function
         * @name pc.ScriptComponent#has
         * @description Check if script is attached to the entity.
         * @param {String} script The name of Script Object
         * @returns {Boolean} If script is attached to the entity
         * @example
         * if (entity.script.has('playerController')) {
         *     // entity has script
         * }
         */
        has: function(script) {
            var scriptObject = script;

            // shorthand using script name
            if (typeof(scriptObject) === 'string')
                scriptObject = this.system.app.scripts.get(scriptObject);

            return !! this._scriptsIndex[scriptObject.__name];
        },

        /**
         * @function
         * @name pc.ScriptComponent#create
         * @description Create Script Instance and attach to entity script component.
         * @param {String} script The name of Script Object
         * @param {Object} [args] Object with arguments for a script
         * @param {Boolean} [args.enabled] if Script Instance is enabled after creation
         * @param {Object} [args.attributes] Object with values for attributes, where key is name of an attribute
         * @returns Script Instance if successfuly attached to entity,
         * or Null if failed due to same script name been added already
         * or Script Object is not found by name in {@link pc.ScriptRegistry}
         * @example
         * entity.script.create('playerController', {
         *     attributes: {
         *         speed: 4
         *     }
         * });
         */
        create: function(script, args) {
            var self = this;
            args = args || { };

            var scriptObject = script;
            var scriptName = script;

            // shorthand using script name
            if (typeof(scriptObject) === 'string') {
                scriptObject = this.system.app.scripts.get(scriptObject);
            } else if (scriptObject) {
                scriptName = scriptObject.__name;
            }

            if (scriptObject) {
                if (! this._scriptsIndex[scriptObject.__name] || ! this._scriptsIndex[scriptObject.__name].instance) {
                    // create script instance
                    var scriptInstance = new scriptObject({
                        app: this.system.app,
                        entity: this.entity,
                        enabled: args.hasOwnProperty('enabled') ? args.enabled : true,
                        attributes: args.attributes || null
                    });

                    var ind = -1;
                    if (typeof(args.ind) === 'number' && args.ind !== -1 && this._scripts.length > args.ind)
                        ind = args.ind;

                    if (ind === -1) {
                        this._scripts.push(scriptInstance);
                    } else {
                        this._scripts.splice(ind, 0, scriptInstance);
                    }

                    this._scriptsIndex[scriptObject.__name] = {
                        instance: scriptInstance,
                        onSwap: function() {
                            self.swap(scriptObject.__name);
                        }
                    };

                    this[scriptObject.__name] = scriptInstance;

                    if (! args.preloading)
                        scriptInstance.__initializeAttributes();

                    this.fire('create', scriptObject.__name, scriptInstance);
                    this.fire('create:' + scriptObject.__name, scriptInstance);

                    this.system.app.scripts.on('swap:' + scriptObject.__name, this._scriptsIndex[scriptObject.__name].onSwap);

                    if (! args.preloading && this.enabled && scriptInstance.enabled && ! scriptInstance._initialized) {
                        scriptInstance._initialized = true;
                        scriptInstance._postInitialized = true;

                        if (scriptInstance.initialize)
                            this._scriptMethod(scriptInstance, ScriptComponent.scriptMethods.initialize);

                        if (scriptInstance.postInitialize)
                            this._scriptMethod(scriptInstance, ScriptComponent.scriptMethods.postInitialize);
                    }

                    return scriptInstance;
                } else {
                    console.warn('script \'' + scriptName + '\' is already added to entity \'' + this.entity.name + '\'');
                }
            } else {
                this._scriptsIndex[scriptName] = {
                    awaiting: true,
                    ind: this._scripts.length
                };
                console.warn('script \'' + scriptName + '\' is not found, could not add to entity \'' + this.entity.name + '\'');
            }

            return null;
        },

        /**
         * @function
         * @name pc.ScriptComponent#destroy
         * @description Destroy Script Instance that is attached to entity.
         * @param {String} script The name of Script Object
         * @returns {Boolean} If it was successfuly destroyed
         * @example
         * entity.script.destroy('playerController');
         */
        destroy: function(script) {
            var scriptName = script;
            var scriptObject = script;

            // shorthand using script name
            if (typeof(scriptObject) === 'string') {
                scriptObject = this.system.app.scripts.get(scriptObject);
                if (scriptObject)
                    scriptName = scriptObject.__name;
            }

            var scriptData = this._scriptsIndex[scriptName];
            delete this._scriptsIndex[scriptName];
            if (! scriptData) return false;

            if (scriptData.instance) {
                var ind = this._scripts.indexOf(scriptData.instance);
                this._scripts.splice(ind, 1);
            }

            // remove swap event
            this.system.app.scripts.unbind('swap:' + scriptName, scriptData.onSwap);

            delete this._scriptsIndex[scriptName];
            delete this[scriptName];

            this.fire('destroy', scriptName, scriptData.instance || null);
            this.fire('destroy:' + scriptName, scriptData.instance || null);

            if (scriptData.instance)
                scriptData.instance.fire('destroy');

            return true;
        },

        swap: function(script) {
            var scriptObject = script;

            // shorthand using script name
            if (typeof(scriptObject) === 'string')
                scriptObject = this.system.app.scripts.get(scriptObject);

            var old = this._scriptsIndex[scriptObject.__name];
            if (! old || ! old.instance) return false;

            var scriptInstanceOld = old.instance;
            var ind = this._scripts.indexOf(scriptInstanceOld);

            var scriptInstance = new scriptObject({
                app: this.system.app,
                entity: this.entity,
                enabled: scriptInstanceOld.enabled,
                attributes: scriptInstanceOld.__attributes
            });

            if (! scriptInstance.swap)
                return false;

            // add to component
            this._scripts[ind] = scriptInstance;
            this._scriptsIndex[scriptObject.__name].instance = scriptInstance;
            this[scriptObject.__name] = scriptInstance;

            this._scriptMethod(scriptInstance, ScriptComponent.scriptMethods.swap, scriptInstanceOld);

            this.fire('swap', scriptObject.__name, scriptInstance);
            this.fire('swap:' + scriptObject.__name, scriptInstance);

            return true;
        },

        /**
         * @function
         * @name pc.ScriptComponent#move
         * @description Move Script Instance to different position to alter update order of scripts within entity.
         * @param {String} script The name of Script Object
         * @param {Number} ind New position index within scripts
         * @returns {Boolean} If it was successfuly destroyed
         * @example
         * entity.script.destroy('playerController');
         */
        move: function(script, ind) {
            if (ind >= this._scripts.length)
                return false;

            var scriptName = script;

            if (typeof(script) !== 'string')
                scriptName = script.__name;

            var scriptData = this._scriptsIndex[scriptName];
            if (! scriptData || ! scriptData.instance)
                return false;

            var indOld = this._scripts.indexOf(scriptData.instance);
            if (indOld === -1 || indOld === ind)
                return false;

            // move script to another position
            this._scripts.splice(ind, 0, this._scripts.splice(indOld, 1)[0]);

            this.fire('move', scriptName, scriptData.instance, ind, indOld);
            this.fire('move:' + scriptName, scriptData.instance, ind, indOld);

            return true;
        }
    });


    Object.defineProperty(ScriptComponent.prototype, 'scripts', {
        get: function() {
            return this._scripts;
        },
        set: function(value) {
            this._scriptsData = value;

            for(var key in value) {
                if (! value.hasOwnProperty(key))
                    continue;

                var script = this._scriptsIndex[key];
                if (script) {
                    // existing script

                    // enabled
                    if (typeof(value[key].enabled) === 'boolean')
                        script.enabled = !! value[key].enabled;

                    // attributes
                    if (typeof(value[key].attributes) === 'object') {
                        for(var attr in value[key].attributes) {
                            if (pc.Script.reservedAttributes[attr])
                                continue;

                            if (! script.__attributes.hasOwnProperty(attr)) {
                                // new attribute
                                var scriptObject = this.system.app.scripts.get(key);
                                if (scriptObject)
                                    scriptObject.attributes.add(attr, { });
                            }

                            // update attribute
                            script[attr] = value[key].attributes[attr];
                        }
                    }
                } else {
                    // TODO scripts2
                    // new script
                    console.log(this.order);
                }
            }
        }
    });

    return {
        ScriptComponent: ScriptComponent
    };
}());
