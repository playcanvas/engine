Object.assign(pc, function () {
    /**
     * @constructor
     * @name pc.ScriptRegistry
     * @classdesc Container for all Script Types that are available to this application
     * @description Create an instance of a pc.ScriptRegistry.
     * Note: PlayCanvas scripts can access the Script Registry from inside the application with {@link pc.Application#scripts} {@link pc.ADDRESS_REPEAT}.
     * @param {pc.Application} app Application to attach registry to.
     */
    var ScriptRegistry = function (app) {
        pc.events.attach(this);

        this.app = app;
        this._scripts = { };
        this._list = [];
    };

    ScriptRegistry.prototype.destroy = function () {
        this.app = null;
        this.off();
    };

    /**
     * @function
     * @name pc.ScriptRegistry#add
     * @description Add {@link ScriptType} to registry.
     * Note: when {@link pc.createScript} is called, it will add the {@link ScriptType} to the registry automatically.
     * If a script already exists in registry, and the new script has a `swap` method defined,
     * it will perform code hot swapping automatically in async manner.
     * @param {ScriptType} script Script Type that is created using {@link pc.createScript}
     * @returns {Boolean} True if added for the first time or false if script already exists
     * @example
     * var PlayerController = pc.createScript('playerController');
     * // playerController Script Type will be added to pc.ScriptRegistry automatically
     * app.scripts.has('playerController') === true; // true
     */
    ScriptRegistry.prototype.add = function (script) {
        var self = this;

        if (this._scripts.hasOwnProperty(script.__name)) {
            setTimeout(function () {
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
        setTimeout(function () {
            if (!self._scripts.hasOwnProperty(script.__name))
                return;


            // this is a check for a possible error
            // that might happen if the app has been destroyed before
            // setTimeout has finished
            if (!self.app || !self.app.systems || !self.app.systems.script) {
                return;
            }

            var components = self.app.systems.script._components;
            var i, scriptInstance, attributes;
            var scriptInstances = [];
            var scriptInstancesInitialized = [];

            for (components.loopIndex = 0; components.loopIndex < components.length; components.loopIndex++) {
                var component = components.items[components.loopIndex];
                // check if awaiting for script
                if (component._scriptsIndex[script.__name] && component._scriptsIndex[script.__name].awaiting) {
                    if (component._scriptsData && component._scriptsData[script.__name])
                        attributes = component._scriptsData[script.__name].attributes;

                    scriptInstance = component.create(script.__name, {
                        preloading: true,
                        ind: component._scriptsIndex[script.__name].ind,
                        attributes: attributes
                    });

                    if (scriptInstance)
                        scriptInstances.push(scriptInstance);
                }
            }

            // initialize attributes
            for (i = 0; i < scriptInstances.length; i++)
                scriptInstances[i].__initializeAttributes();

            // call initialize()
            for (i = 0; i < scriptInstances.length; i++) {
                if (scriptInstances[i].enabled) {
                    scriptInstances[i]._initialized = true;

                    scriptInstancesInitialized.push(scriptInstances[i]);

                    if (scriptInstances[i].initialize)
                        scriptInstances[i].initialize();
                }
            }

            // call postInitialize()
            for (i = 0; i < scriptInstancesInitialized.length; i++) {
                if (!scriptInstancesInitialized[i].enabled || scriptInstancesInitialized[i]._postInitialized) {
                    continue;
                }

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
     * @description Remove {@link ScriptType}.
     * @param {String} name Name of a {@link ScriptType} to remove
     * @returns {Boolean} True if removed or False if already not in registry
     * @example
     * app.scripts.remove('playerController');
     */
    ScriptRegistry.prototype.remove = function (name) {
        if (typeof name === 'function')
            name = name.__name;

        if (!this._scripts.hasOwnProperty(name))
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
     * @description Get {@link ScriptType} by name.
     * @param {String} name Name of a {@link ScriptType}.
     * @returns {ScriptType} The Script Type if it exists in the registry or null otherwise.
     * @example
     * var PlayerController = app.scripts.get('playerController');
     */
    ScriptRegistry.prototype.get = function (name) {
        return this._scripts[name] || null;
    };

    /**
     * @function
     * @name pc.ScriptRegistry#has
     * @description Check if a {@link ScriptType} with the specified name is in the registry.
     * @param {String} name Name of a {@link ScriptType}
     * @returns {Boolean} True if {@link ScriptType} is in registry
     * @example
     * if (app.scripts.has('playerController')) {
     *     // playerController is in pc.ScriptRegistry
     * }
     */
    ScriptRegistry.prototype.has = function (name) {
        return this._scripts.hasOwnProperty(name);
    };

    /**
     * @function
     * @name pc.ScriptRegistry#list
     * @description Get list of all {@link ScriptType}s from registry.
     * @returns {ScriptType[]} list of all {@link ScriptType}s in registry
     * @example
     * // logs array of all Script Type names available in registry
     * console.log(app.scripts.list().map(function(o) {
     *     return o.name;
     * }));
     */
    ScriptRegistry.prototype.list = function () {
        return this._list;
    };


    return {
        ScriptRegistry: ScriptRegistry
    };
}());
