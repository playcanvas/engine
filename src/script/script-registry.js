pc.extend(pc, function () {
    /**
    * @name pc.ScriptRegistry
    * @class Container for all Script Types that are available to this application
    * @description Create an instance of an ScriptRegistry.
    * Note: PlayCanvas scripts are provided with an ScriptRegistry instance as 'app.scripts'.
    * @param {pc.Application} app Application to attach registry to.
    */
    var ScriptRegistry = function (app) {
        pc.events.attach(this);

        this.app = app;
        this._scripts = { };
        this._list = [ ];
    };


    /**
     * @function
     * @name pc.ScriptRegistry#add
     * @description Add Script Type to registry.
     * Note: when `pc.CreateScript` is called, it will add script to pc.ScriptRegistry automatically.
     * If script already exists in registry, and new Script Type has `swap` method defined,
     * it will perform code hot swapping automatically in async manner
     * @param {ScriptType} scriptType Script Type that is created using {pc.Script}
     * @returns {Boolean} True if first time added or false if script already exists
     * @example
     * var PlayerController = pc.CreateScript('playerController');
     * // playerController Script Type will be added to pc.ScriptRegistry automatically
     * app.scripts.has('playerController') === true; // true
     */
    ScriptRegistry.prototype.add = function(script) {
        var self = this;

        if (this._scripts.hasOwnProperty(script.__name)) {
            setTimeout(function() {
                if (script.prototype.swap) {
                    // swapping
                    var old = self._scripts[script.__name];
                    var ind = self._list.indexOf(old);
                    self._list[ind] = script;
                    self._scripts[script.__name] = script;

                    self.fire('swap', script.__name, script);
                    self.fire('swap:' + script.__name, script);
                } else {
                    console.warn('script registry already has \'' + script.__name + '\' script, define \'swap\' method for new script type to enable code hot swapping');
                }
            });
            return false;
        }

        this._scripts[script.__name] = script;
        this._list.push(script);

        this.fire('add', script.__name, script);
        this.fire('add:' + script.__name, script);

        // for all components awaiting Script Type
        // create script instance
        setTimeout(function() {
            if (! self._scripts.hasOwnProperty(script.__name))
                return;

            var components = self.app.systems.script._components;
            var i, s, scriptInstance, attributes;
            var scriptInstances = [ ];
            var scriptInstancesInitialized = [ ];

            for(i = 0; i < components.length; i++) {
                // check if awaiting for script
                if (components[i]._scriptsIndex[script.__name] && components[i]._scriptsIndex[script.__name].awaiting) {
                    if (components[i]._scriptsData && components[i]._scriptsData[script.__name])
                        attributes = components[i]._scriptsData[script.__name].attributes;

                    scriptInstance = components[i].create(script.__name, {
                        preloading: true,
                        ind: components[i]._scriptsIndex[script.__name].ind,
                        attributes: attributes
                    });

                    if (scriptInstance)
                        scriptInstances.push(scriptInstance);
                }
            }

            // initialize attributes
            for(i = 0; i < scriptInstances.length; i++)
                scriptInstances[i].__initializeAttributes();

            // call initialize()
            for(i = 0; i < scriptInstances.length; i++) {
                if (scriptInstances[i].enabled) {
                    scriptInstances[i]._initialized = true;

                    scriptInstancesInitialized.push(scriptInstances[i]);

                    if (scriptInstances[i].initialize)
                        scriptInstances[i].initialize();
                }
            }

            // call postInitialize()
            for(i = 0; i < scriptInstancesInitialized.length; i++) {
                scriptInstancesInitialized[i]._postInitialized = true;

                if (scriptInstancesInitialized[i].postInitialize)
                    scriptInstancesInitialized[i].postInitialize();
            }
        });

        return true;
    };

    /**
     * @function
     * @name pc.ScriptRegistry#remove
     * @description Remove Script Type.
     * @param {String} name Name of a Script Type to remove
     * @returns {Boolean} True if removed or False if already not in registry
     * @example
     * app.scripts.remove('playerController');
     */
    ScriptRegistry.prototype.remove = function(script) {
        var name = script;

        if (typeof(script) === 'function')
            name = script.__name;

        if (! this._scripts.hasOwnProperty(name))
            return false;

        var item = this._scripts[name];
        delete this._scripts[name];

        var ind = this._list.indexOf(item);
        this._list.splice(ind, 1);

        this.fire('remove', name, item);
        this.fire('remove:' + name, item);

        return true;
    };

    /**
     * @function
     * @name pc.ScriptRegistry#get
     * @description Get Script Type by name.
     * @param {String} name Name of a Script Type
     * @returns {?ScriptType} Script Type will be returned if it is in registry otherwise null will be returned
     * @example
     * var PlayerController = app.scripts.get('playerController');
     */
    ScriptRegistry.prototype.get = function(name) {
        return this._scripts[name] || null;
    };

    /**
     * @function
     * @name pc.ScriptRegistry#has
     * @description Detect by name of Script Type if it's in registry
     * @param {String} name Name of a Script Type
     * @returns {Boolean} True if Script Type is in registry
     * @example
     * if (app.scripts.has('playerController')) {
     *     // playerController is in pc.ScriptRegistry
     * }
     */
    ScriptRegistry.prototype.has = function(name) {
        return this._scripts.hasOwnProperty(name);
    };

    /**
     * @function
     * @name pc.ScriptRegistry#list
     * @description Get list of all Script Type's from registry.
     * @returns {ScriptType[]} list of all Script Type's in registry
     * @example
     * // logs array of all Script Type names available in registry
     * console.log(app.scripts.list().map(function(o) {
     *     return o.name;
     * }));
     */
    ScriptRegistry.prototype.list = function() {
        return this._list;
    };


    return {
        ScriptRegistry: ScriptRegistry
    };
}());
