import { EventHandler } from '../core/event-handler.js';

/**
 * @class
 * @name ScriptRegistry
 * @augments EventHandler
 * @classdesc Container for all Script Types that are available to this application.
 * @description Create an instance of a ScriptRegistry.
 * Note: PlayCanvas scripts can access the Script Registry from inside the application with {@link Application#scripts} {@link ADDRESS_REPEAT}.
 * @param {Application} app - Application to attach registry to.
 */
class ScriptRegistry extends EventHandler {
    constructor(app) {
        super();

        this.app = app;
        this._scripts = { };
        this._list = [];
    }

    destroy() {
        this.app = null;
        this.off();
    }

    /* eslint-disable jsdoc/no-undefined-types */
    /**
     * @function
     * @name ScriptRegistry#add
     * @description Add {@link ScriptType} to registry.
     * Note: when {@link createScript} is called, it will add the {@link ScriptType} to the registry automatically.
     * If a script already exists in registry, and the new script has a `swap` method defined,
     * it will perform code hot swapping automatically in async manner.
     * @param {Class<ScriptType>} script - Script Type that is created using {@link createScript}.
     * @returns {boolean} True if added for the first time or false if script already exists.
     * @example
     * var PlayerController = pc.createScript('playerController');
     * // playerController Script Type will be added to pc.ScriptRegistry automatically
     * console.log(app.scripts.has('playerController')); // outputs true
     */
    /* eslint-enable jsdoc/no-undefined-types */
    add(script) {
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
    }

    /* eslint-disable jsdoc/no-undefined-types */
    /**
     * @function
     * @name ScriptRegistry#remove
     * @description Remove {@link ScriptType}.
     * @param {string|Class<ScriptType>} nameOrType - The name or type of {@link ScriptType}.
     * @returns {boolean} True if removed or False if already not in registry.
     * @example
     * app.scripts.remove('playerController');
     */
    /* eslint-enable jsdoc/no-undefined-types */
    remove(nameOrType) {
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
    }

    /* eslint-disable jsdoc/no-undefined-types */
    /**
     * @function
     * @name ScriptRegistry#get
     * @description Get {@link ScriptType} by name.
     * @param {string} name - Name of a {@link ScriptType}.
     * @returns {Class<ScriptType>} The Script Type if it exists in the registry or null otherwise.
     * @example
     * var PlayerController = app.scripts.get('playerController');
     */
    /* eslint-enable jsdoc/no-undefined-types */
    get(name) {
        return this._scripts[name] || null;
    }

    /* eslint-disable jsdoc/no-undefined-types */
    /**
     * @function
     * @name ScriptRegistry#has
     * @description Check if a {@link ScriptType} with the specified name is in the registry.
     * @param {string|Class<ScriptType>} nameOrType - The name or type of {@link ScriptType}.
     * @returns {boolean} True if {@link ScriptType} is in registry.
     * @example
     * if (app.scripts.has('playerController')) {
     *     // playerController is in pc.ScriptRegistry
     * }
     */
    /* eslint-enable jsdoc/no-undefined-types */
    has(nameOrType) {
        if (typeof nameOrType === 'string') {
            return this._scripts.hasOwnProperty(nameOrType);
        }

        if (!nameOrType) return false;
        var scriptName = nameOrType.__name;
        return this._scripts[scriptName] === nameOrType;
    }

    /* eslint-disable jsdoc/no-undefined-types */
    /**
     * @function
     * @name ScriptRegistry#list
     * @description Get list of all {@link ScriptType}s from registry.
     * @returns {Array<Class<ScriptType>>} list of all {@link ScriptType}s in registry.
     * @example
     * // logs array of all Script Type names available in registry
     * console.log(app.scripts.list().map(function (o) {
     *     return o.name;
     * }));
     */
    /* eslint-enable jsdoc/no-undefined-types */
    list() {
        return this._list;
    }
}

export { ScriptRegistry };
