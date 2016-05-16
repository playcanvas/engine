pc.extend(pc, function () {
    /**
    * @name pc.ScriptRegistry
    * @class Container for all scripts that are available to this application
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
     * @description Add Script Object to pc.ScriptRegistry.
     * Note: when `new pc.Script` is called, it will add script to pc.ScriptRegistry automatically.
     * If script already exists in registry, and new Script Object has `swap` method defined,
     * it will perform code hot swapping automatically in async manner
     * @param {pc.ScriptObject} script The {@pc.ScriptObject} that has been created using {@link pc.Script}
     * @returns {Boolean} True if first time added or false if script already exists
     * @example
     * var PlayerController = new pc.Script('playerController');
     * // playerController Script Object will be added to pc.ScriptRegistry automatically
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
                    console.warn('script registry already has \'' + script.__name + '\' script, define \'swap\' method to script object to enable code hot swapping');
                }
            });
            return false;
        }

        this._scripts[script.__name] = script;
        this._list.push(script);

        this.fire('add', script.__name, script);
        this.fire('add:' + script.__name, script);

        // for all components awaiting Script Object
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
     * @description Remove Script Object from pc.ScriptRegistry.
     * @param {String} script Name of a Script Object to remove from pc.ScriptRegistry
     * @returns {Boolean} True if removed or False if not in pc.ScriptRegistry
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
     * @description Get Script Object by name from pc.ScriptRegistry.
     * @param {String} script Name of a Script Object
     * @returns {function} Script Object will be returned if in pc.ScriptRegistry or Null
     * @example
     * var PlayerController = app.scripts.get('playerController');
     */
    ScriptRegistry.prototype.get = function(name) {
        return this._scripts[name] || null;
    };

    /**
     * @function
     * @name pc.ScriptRegistry#has
     * @description Detect if Script Object is in pc.ScriptRegistry by name.
     * @param {String} script Name of a Script Object
     * @returns {Boolean} True if Script Object is in pc.ScriptRegistry
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
     * @description Get list of all Script Object's from pc.ScriptRegistry.
     * @returns {function[]} list of all Script Object's in pc.ScriptRegistry
     * @example
     * // logs array of all Script Object names from registry
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
