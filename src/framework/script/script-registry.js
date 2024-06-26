import { EventHandler } from '../../core/event-handler.js';

/**
 * Container for all {@link ScriptType}s that are available to this application. Note that
 * PlayCanvas scripts can access the Script Registry from inside the application with
 * {@link AppBase#scripts}.
 *
 * @category Script
 */
class ScriptRegistry extends EventHandler {
    /**
     * @type {Object<string, typeof import('./script-type.js').ScriptType>}
     * @private
     */
    _scripts = {};

    /**
     * @type {typeof import('./script-type.js').ScriptType[]}
     * @private
     */
    _list = [];

    /**
     * A Map of script names to attribute schemas.
     *
     * @type {Map<string, import('./script-attributes.js').AttributeSchema>}
     * @private
     */
    _scriptSchemas = new Map();

    /**
     * Create a new ScriptRegistry instance.
     *
     * @param {import('../app-base.js').AppBase} app - Application to attach registry to.
     */
    constructor(app) {
        super();

        this.app = app;
    }

    destroy() {
        this.app = null;
        this.off();
    }

    /**
     * Registers a schema against a script instance.
     *
     * @param {string} id - The key to use to store the schema
     * @param {import('./script-attributes.js').AttributeSchema} schema - An schema definition for the script
     */
    addSchema(id, schema) {
        if (!schema) return;
        this._scriptSchemas.set(id, schema);
    }

    /**
     * Returns a schema for a given script name.
     *
     * @param {string} id - The key to store the schema under
     * @returns {import('./script-attributes.js').AttributeSchema | undefined} - The schema stored under the key
     */
    getSchema(id) {
        return this._scriptSchemas.get(id);
    }

    /**
     * Add {@link ScriptType} to registry. Note: when {@link createScript} is called, it will add
     * the {@link ScriptType} to the registry automatically. If a script already exists in
     * registry, and the new script has a `swap` method defined, it will perform code hot swapping
     * automatically in async manner.
     *
     * @param {typeof import('./script-type.js').ScriptType} script - Script Type that is created
     * using {@link createScript}.
     * @returns {boolean} True if added for the first time or false if script already exists.
     * @example
     * var PlayerController = pc.createScript('playerController');
     * // playerController Script Type will be added to pc.ScriptRegistry automatically
     * console.log(app.scripts.has('playerController')); // outputs true
     */
    add(script) {
        const scriptName = script.__name;

        if (this._scripts.hasOwnProperty(scriptName)) {
            setTimeout(() => {
                if (script.prototype.swap) {
                    // swapping
                    const old = this._scripts[scriptName];
                    const ind = this._list.indexOf(old);
                    this._list[ind] = script;
                    this._scripts[scriptName] = script;

                    this.fire('swap', scriptName, script);
                    this.fire('swap:' + scriptName, script);
                } else {
                    console.warn(`script registry already has '${scriptName}' script, define 'swap' method for new script type to enable code hot swapping`);
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
        setTimeout(() => {
            if (!this._scripts.hasOwnProperty(scriptName))
                return;

            // this is a check for a possible error
            // that might happen if the app has been destroyed before
            // setTimeout has finished
            if (!this.app || !this.app.systems || !this.app.systems.script) {
                return;
            }

            const components = this.app.systems.script._components;
            let attributes;
            const scriptInstances = [];
            const scriptInstancesInitialized = [];

            for (components.loopIndex = 0; components.loopIndex < components.length; components.loopIndex++) {
                const component = components.items[components.loopIndex];
                // check if awaiting for script
                if (component._scriptsIndex[scriptName] && component._scriptsIndex[scriptName].awaiting) {
                    if (component._scriptsData && component._scriptsData[scriptName])
                        attributes = component._scriptsData[scriptName].attributes;

                    const scriptInstance = component.create(scriptName, {
                        preloading: true,
                        ind: component._scriptsIndex[scriptName].ind,
                        attributes: attributes
                    });

                    if (scriptInstance)
                        scriptInstances.push(scriptInstance);

                    // initialize attributes
                    for (const script of component.scripts) {
                        component.initializeAttributes(script);
                    }
                }
            }

            // call initialize()
            for (let i = 0; i < scriptInstances.length; i++) {
                if (scriptInstances[i].enabled) {
                    scriptInstances[i]._initialized = true;

                    scriptInstancesInitialized.push(scriptInstances[i]);

                    if (scriptInstances[i].initialize)
                        scriptInstances[i].initialize();
                }
            }

            // call postInitialize()
            for (let i = 0; i < scriptInstancesInitialized.length; i++) {
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

    /**
     * Remove {@link ScriptType}.
     *
     * @param {string|typeof import('./script-type.js').ScriptType} nameOrType - The name or type
     * of {@link ScriptType}.
     * @returns {boolean} True if removed or False if already not in registry.
     * @example
     * app.scripts.remove('playerController');
     */
    remove(nameOrType) {
        let scriptType = nameOrType;
        let scriptName = nameOrType;

        if (typeof scriptName !== 'string') {
            scriptName = scriptType.__name;
        } else {
            scriptType = this.get(scriptName);
        }

        if (this.get(scriptName) !== scriptType)
            return false;

        delete this._scripts[scriptName];
        const ind = this._list.indexOf(scriptType);
        this._list.splice(ind, 1);

        this.fire('remove', scriptName, scriptType);
        this.fire('remove:' + scriptName, scriptType);

        return true;
    }

    /**
     * Get {@link ScriptType} by name.
     *
     * @param {string} name - Name of a {@link ScriptType}.
     * @returns {typeof import('./script-type.js').ScriptType} The Script Type if it exists in the
     * registry or null otherwise.
     * @example
     * var PlayerController = app.scripts.get('playerController');
     */
    get(name) {
        return this._scripts[name] || null;
    }

    /**
     * Check if a {@link ScriptType} with the specified name is in the registry.
     *
     * @param {string|typeof import('./script-type.js').ScriptType} nameOrType - The name or type
     * of {@link ScriptType}.
     * @returns {boolean} True if {@link ScriptType} is in registry.
     * @example
     * if (app.scripts.has('playerController')) {
     *     // playerController is in pc.ScriptRegistry
     * }
     */
    has(nameOrType) {
        if (typeof nameOrType === 'string') {
            return this._scripts.hasOwnProperty(nameOrType);
        }

        if (!nameOrType) return false;
        const scriptName = nameOrType.__name;
        return this._scripts[scriptName] === nameOrType;
    }

    /**
     * Get list of all {@link ScriptType}s from registry.
     *
     * @returns {Array<typeof import('./script-type.js').ScriptType>} list of all {@link ScriptType}s
     * in registry.
     * @example
     * // logs array of all Script Type names available in registry
     * console.log(app.scripts.list().map(function (o) {
     *     return o.name;
     * }));
     */
    list() {
        return this._list;
    }
}

export { ScriptRegistry };
