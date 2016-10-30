pc.extend(pc, function () {
    /**
    * @component
    * @name pc.ScriptComponent
    * @class The ScriptComponent allows you to extend the functionality of an Entity by attaching your own Script Types defined in javascript files
    * to be executed with access to the Entity. For more details on scripting see <a href="//developer.playcanvas.com/user-manual/scripting/">Scripting</a>.
    * @param {pc.ScriptComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.Entity} entity The Entity that this Component is attached to.
    * @extends pc.Component
    * @property {ScriptType[]} scripts An array of all script instances attached to an entity. This Array shall not be modified by developer.
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
    * @name pc.ScriptComponent#enable
    * @description Fired when Component becomes enabled
    * Note: this event does not takes in account entity or any of its parent enabled state
    * @example
    * entity.script.on('enable', function () {
    *     // component is enabled
    * });
    */

    /**
    * @event
    * @name pc.ScriptComponent#disable
    * @description Fired when Component becomes disabled
    * Note: this event does not takes in account entity or any of its parent enabled state
    * @example
    * entity.script.on('disable', function () {
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
    * @description Fired when a script instance is created and attached to component
    * @param {String} name The name of the Script Type
    * @param {ScriptType} scriptInstance The instance of the {@link ScriptType} that has been created
    * @example
    * entity.script.on('create', function (name, scriptInstance) {
    *     // new script instance added to component
    * });
    */

    /**
    * @event
    * @name pc.ScriptComponent#create:[name]
    * @description Fired when a script instance is created and attached to component
    * @param {ScriptType} scriptInstance The instance of the {@link ScriptType} that has been created
    * @example
    * entity.script.on('create:playerController', function (scriptInstance) {
    *     // new script instance 'playerController' is added to component
    * });
    */

    /**
    * @event
    * @name pc.ScriptComponent#destroy
    * @description Fired when a script instance is destroyed and removed from component
    * @param {String} name The name of the Script Type
    * @param {ScriptType} scriptInstance The instance of the {@link ScriptType} that has been destroyed
    * @example
    * entity.script.on('destroy', function (name, scriptInstance) {
    *     // script instance has been destroyed and removed from component
    * });
    */

    /**
    * @event
    * @name pc.ScriptComponent#destroy:[name]
    * @description Fired when a script instance is destroyed and removed from component
    * @param {ScriptType} scriptInstance The instance of the {@link ScriptType} that has been destroyed
    * @example
    * entity.script.on('destroy:playerController', function (scriptInstance) {
    *     // script instance 'playerController' has been destroyed and removed from component
    * });
    */

    /**
    * @event
    * @name pc.ScriptComponent#error
    * @description Fired when a script instance had an exception
    * @param {ScriptType} scriptInstance The instance of the {@link ScriptType} that raised the exception
    * @param {Error} err Native JS Error object with details of an error
    * @param {String} method The method of the script instance that the exception originated from.
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

            this.fire('enable');
            this.fire('state', this.enabled);

            var script;
            for(var i = 0, len = this.scripts.length; i < len; i++) {
                script = this.scripts[i];
                script.enabled = script._enabled;

                if (! script._initialized && script.enabled) {
                    script._initialized = true;

                    script.__initializeAttributes();

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
                destroyed = this.destroy(this.scripts[0].__scriptType.__name);
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
                    console.warn('unhandled exception while calling "' + method + '" for "' + script.__scriptType.__name + '" script: ', ex);
                    console.error(ex);
                }

                script.fire('error', ex, method);
                this.fire('error', script, ex, method);
            }
        },

        _onInitialize: function() {
            var script, scripts = this._scripts;

            for(var i = 0, len = scripts.length; i < len; i++) {
                script = scripts[i];
                if (! script._initialized && script.enabled) {
                    script._initialized = true;
                    if (script.initialize)
                        this._scriptMethod(script, ScriptComponent.scriptMethods.initialize);
                }
            }
        },

        _onPostInitialize: function() {
            var script, scripts = this._scripts;

            for(var i = 0, len = scripts.length; i < len; i++) {
                script = scripts[i];
                if (! script._postInitialized && script.enabled) {
                    script._postInitialized = true;
                    if (script.postInitialize)
                        this._scriptMethod(script, ScriptComponent.scriptMethods.postInitialize);
                }
            }
        },

        _onUpdate: function(dt) {
            var script, scripts = this._scripts;

            for(var i = 0, len = scripts.length; i < len; i++) {
                script = scripts[i];
                if (script.update && script.enabled)
                    this._scriptMethod(script, ScriptComponent.scriptMethods.update, dt);
            }
        },

        _onPostUpdate: function(dt) {
            var script, scripts = this._scripts;
            
            for(var i = 0, len = scripts.length; i < len; i++) {
                script = scripts[i];
                if (script.postUpdate && script.enabled)
                    this._scriptMethod(script, ScriptComponent.scriptMethods.postUpdate, dt);
            }
        },

        /**
         * @function
         * @name pc.ScriptComponent#has
         * @description Detect if script is attached to an entity using name of {@link ScriptType}.
         * @param {String} name The name of the Script Type
         * @returns {Boolean} If script is attached to an entity
         * @example
         * if (entity.script.has('playerController')) {
         *     // entity has script
         * }
         */
        has: function(name) {
            var scriptType = name;

            // shorthand using script name
            if (typeof(scriptType) === 'string')
                scriptType = this.system.app.scripts.get(scriptType);

            return !! this._scriptsIndex[scriptType.__name];
        },

        /**
         * @function
         * @name pc.ScriptComponent#create
         * @description Create a script instance using name of a {@link ScriptType} and attach to an entity script component.
         * @param {String} name The name of the Script Type
         * @param {Object} [args] Object with arguments for a script
         * @param {Boolean} [args.enabled] if script instance is enabled after creation
         * @param {Object} [args.attributes] Object with values for attributes, where key is name of an attribute
         * @returns {ScriptType} Returns an instance of a {@link ScriptType} if successfuly attached to an entity,
         * or null if it failed because a script with a same name has already been added
         * or if the {@link ScriptType} cannot be found by name in the {@link pc.ScriptRegistry}.
         * @example
         * entity.script.create('playerController', {
         *     attributes: {
         *         speed: 4
         *     }
         * });
         */
        create: function(name, args) {
            var self = this;
            args = args || { };

            var scriptType = name;
            var scriptName = name;

            // shorthand using script name
            if (typeof(scriptType) === 'string') {
                scriptType = this.system.app.scripts.get(scriptType);
            } else if (scriptType) {
                scriptName = scriptType.__name;
            }

            if (scriptType) {
                if (! this._scriptsIndex[scriptType.__name] || ! this._scriptsIndex[scriptType.__name].instance) {
                    // create script instance
                    var scriptInstance = new scriptType({
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

                    this._scriptsIndex[scriptType.__name] = {
                        instance: scriptInstance,
                        onSwap: function() {
                            self.swap(scriptType.__name);
                        }
                    };

                    this[scriptType.__name] = scriptInstance;

                    if (! args.preloading)
                        scriptInstance.__initializeAttributes();

                    this.fire('create', scriptType.__name, scriptInstance);
                    this.fire('create:' + scriptType.__name, scriptInstance);

                    this.system.app.scripts.on('swap:' + scriptType.__name, this._scriptsIndex[scriptType.__name].onSwap);

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
                console.warn('script \'' + scriptName + '\' is not found, awaiting it to be added to registry');
            }

            return null;
        },

        /**
         * @function
         * @name pc.ScriptComponent#destroy
         * @description Destroy the script instance that is attached to an entity.
         * @param {String} name The name of the Script Type
         * @returns {Boolean} If it was successfuly destroyed
         * @example
         * entity.script.destroy('playerController');
         */
        destroy: function(name) {
            var scriptName = name;
            var scriptType = name;

            // shorthand using script name
            if (typeof(scriptType) === 'string') {
                scriptType = this.system.app.scripts.get(scriptType);
                if (scriptType)
                    scriptName = scriptType.__name;
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
            var scriptType = script;

            // shorthand using script name
            if (typeof(scriptType) === 'string')
                scriptType = this.system.app.scripts.get(scriptType);

            var old = this._scriptsIndex[scriptType.__name];
            if (! old || ! old.instance) return false;

            var scriptInstanceOld = old.instance;
            var ind = this._scripts.indexOf(scriptInstanceOld);

            var scriptInstance = new scriptType({
                app: this.system.app,
                entity: this.entity,
                enabled: scriptInstanceOld.enabled,
                attributes: scriptInstanceOld.__attributes
            });

            if (! scriptInstance.swap)
                return false;

            scriptInstance.__initializeAttributes();

            // add to component
            this._scripts[ind] = scriptInstance;
            this._scriptsIndex[scriptType.__name].instance = scriptInstance;
            this[scriptType.__name] = scriptInstance;

            this._scriptMethod(scriptInstance, ScriptComponent.scriptMethods.swap, scriptInstanceOld);

            this.fire('swap', scriptType.__name, scriptInstance);
            this.fire('swap:' + scriptType.__name, scriptInstance);

            return true;
        },

        /**
         * @function
         * @name pc.ScriptComponent#move
         * @description Move script instance to different position to alter update order of scripts within entity.
         * @param {String} name The name of the Script Type
         * @param {Number} ind New position index
         * @returns {Boolean} If it was successfuly moved
         * @example
         * entity.script.destroy('playerController');
         */
        move: function(name, ind) {
            if (ind >= this._scripts.length)
                return false;

            var scriptName = name;

            if (typeof(scriptName) !== 'string')
                scriptName = name.__name;

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
                            if (pc.createScript.reservedAttributes[attr])
                                continue;

                            if (! script.__attributes.hasOwnProperty(attr)) {
                                // new attribute
                                var scriptType = this.system.app.scripts.get(key);
                                if (scriptType)
                                    scriptType.attributes.add(attr, { });
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
