Object.assign(pc, function () {
    /**
     * @class
     * @name pc.ScriptRegistry
     * @augments pc.EventHandler
     * @classdesc Container for all Script Types that are available to this application.
     * @description Create an instance of a pc.ScriptRegistry.
     * Note: PlayCanvas scripts can access the Script Registry from inside the application with {@link pc.Application#scripts} {@link pc.ADDRESS_REPEAT}.
     * @param {pc.Application} app - Application to attach registry to.
     */
    var ScriptRegistry = function (app) {
        pc.EventHandler.call(this);

        this.app = app;
        this._scripts = { };
        this._list = [];
    };
    ScriptRegistry.prototype = Object.create(pc.EventHandler.prototype);
    ScriptRegistry.prototype.constructor = ScriptRegistry;

    ScriptRegistry.prototype.destroy = function () {
        this.app = null;
        this.off();
    };

    /* eslint-disable jsdoc/no-undefined-types */
    /**
     * @function
     * @name pc.ScriptRegistry#add
     * @description Add {@link pc.ScriptType} to registry.
     * Note: when {@link pc.createScript} is called, it will add the {@link pc.ScriptType} to the registry automatically.
     * If a script already exists in registry, and the new script has a `swap` method defined,
     * it will perform code hot swapping automatically in async manner.
     * @param {Class<pc.ScriptType>} script - Script Type that is created using {@link pc.createScript}.
     * @returns {boolean} True if added for the first time or false if script already exists.
     * @example
     * var PlayerController = pc.createScript('playerController');
     * // playerController Script Type will be added to pc.ScriptRegistry automatically
     * console.log(app.scripts.has('playerController')); // outputs true
     */
    /* eslint-enable jsdoc/no-undefined-types */
    ScriptRegistry.prototype.add = function (script) {
        var self = this;
        var scriptName = script.__name;

        if (this._scripts.hasOwnProperty(scriptName)) {
            setTimeout(function () {
                if (script.prototype.swap) {
                    // swapping
                    var old = self._scripts[scriptName];
                    var ind = self._list.indexOf(old);
                    self._list[ind] = script;
                    self._scripts[scriptName] = script;

                    self.fire('swap', scriptName, script);
                    self.fire('swap:' + scriptName, script);
                } else {
                    console.warn('script registry already has \'' + scriptName + '\' script, define \'swap\' method for new script type to enable code hot swapping');
                }
            });
            return false;
        }

        this._scripts[scriptName] = script;
        this._list.push(script);

        this.fire('add', scriptName, script);
        this.fire('add:' + scriptName, script);

        // for all components awaiting Script Type
        // create script instance
        setTimeout(function () {
            if (!self._scripts.hasOwnProperty(scriptName))
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
                if (component._scriptsIndex[scriptName] && component._scriptsIndex[scriptName].awaiting) {
                    if (component._scriptsData && component._scriptsData[scriptName])
                        attributes = component._scriptsData[scriptName].attributes;

                    scriptInstance = component.create(scriptName, {
                        preloading: true,
                        ind: component._scriptsIndex[scriptName].ind,
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

    /* eslint-disable jsdoc/no-undefined-types */
    /**
     * @function
     * @name pc.ScriptRegistry#remove
     * @description Remove {@link pc.ScriptType}.
     * @param {string|Class<pc.ScriptType>} nameOrType - The name or type of {@link pc.ScriptType}.
     * @returns {boolean} True if removed or False if already not in registry.
     * @example
     * app.scripts.remove('playerController');
     */
    /* eslint-enable jsdoc/no-undefined-types */
    ScriptRegistry.prototype.remove = function (nameOrType) {
        var scriptType = nameOrType;
        var scriptName = nameOrType;

        if (typeof scriptName !== 'string') {
            scriptName = scriptType.__name;
        } else {
            scriptType = this.get(scriptName);
        }

        if (this.get(scriptName) !== scriptType)
            return false;

        delete this._scripts[scriptName];
        var ind = this._list.indexOf(scriptType);
        this._list.splice(ind, 1);

        this.fire('remove', scriptName, scriptType);
        this.fire('remove:' + scriptName, scriptType);

        return true;
    };

    /* eslint-disable jsdoc/no-undefined-types */
    /**
     * @function
     * @name pc.ScriptRegistry#get
     * @description Get {@link pc.ScriptType} by name.
     * @param {string} name - Name of a {@link pc.ScriptType}.
     * @returns {Class<pc.ScriptType>} The Script Type if it exists in the registry or null otherwise.
     * @example
     * var PlayerController = app.scripts.get('playerController');
     */
    /* eslint-enable jsdoc/no-undefined-types */
    ScriptRegistry.prototype.get = function (name) {
        return this._scripts[name] || null;
    };

    /* eslint-disable jsdoc/no-undefined-types */
    /**
     * @function
     * @name pc.ScriptRegistry#has
     * @description Check if a {@link pc.ScriptType} with the specified name is in the registry.
     * @param {string|Class<pc.ScriptType>} nameOrType - The name or type of {@link pc.ScriptType}.
     * @returns {boolean} True if {@link pc.ScriptType} is in registry.
     * @example
     * if (app.scripts.has('playerController')) {
     *     // playerController is in pc.ScriptRegistry
     * }
     */
    /* eslint-enable jsdoc/no-undefined-types */
    ScriptRegistry.prototype.has = function (nameOrType) {
        if (typeof nameOrType === 'string') {
            return this._scripts.hasOwnProperty(nameOrType);
        }

        if (!nameOrType) return false;
        var scriptName = nameOrType.__name;
        return this._scripts[scriptName] === nameOrType;
    };

    /* eslint-disable jsdoc/no-undefined-types */
    /**
     * @function
     * @name pc.ScriptRegistry#list
     * @description Get list of all {@link pc.ScriptType}s from registry.
     * @returns {Array<Class<pc.ScriptType>>} list of all {@link pc.ScriptType}s in registry.
     * @example
     * // logs array of all Script Type names available in registry
     * console.log(app.scripts.list().map(function (o) {
     *     return o.name;
     * }));
     */
    /* eslint-enable jsdoc/no-undefined-types */
    ScriptRegistry.prototype.list = function () {
        return this._list;
    };


    return {
        ScriptRegistry: ScriptRegistry
    };
}());
