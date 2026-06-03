import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { reservedScriptNames } from './constants.js';
import { getScriptRegistryName } from './script.js';

/**
 * @import { AppBase } from '../app-base.js'
 * @import { AttributeSchema } from './script-attributes.js'
 * @import { Script } from './script.js'
 * @import { ScriptType } from './script-type.js'
 */

/**
 * Container for all {@link ScriptType}s that are available to this application. Note that
 * PlayCanvas scripts can access the Script Registry from inside the application with
 * {@link AppBase#scripts}.
 *
 * @category Script
 */
class ScriptRegistry extends EventHandler {
    /**
     * A Map of script names to script classes. A Map is used (rather than a plain object) so that
     * script names which collide with `Object.prototype` members - e.g. `hasOwnProperty`,
     * `toString`, `__proto__` - are stored and looked up safely.
     *
     * @type {Map<string, typeof ScriptType>}
     * @private
     */
    _scripts = new Map();

    /**
     * @type {typeof ScriptType[]}
     * @private
     */
    _list = [];

    /**
     * A Map of script names to attribute schemas.
     *
     * @type {Map<string, AttributeSchema>}
     * @private
     */
    _scriptSchemas = new Map();

    /**
     * Create a new ScriptRegistry instance.
     *
     * @param {AppBase} app - Application to attach registry to.
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
     * @param {AttributeSchema} schema - An schema definition for the script
     */
    addSchema(id, schema) {
        if (!schema) return;
        this._scriptSchemas.set(id, schema);
    }

    /**
     * Returns a schema for a given script name.
     *
     * @param {string} id - The key to store the schema under
     * @returns {AttributeSchema | undefined} - The schema stored under the key
     */
    getSchema(id) {
        return this._scriptSchemas.get(id);
    }

    /**
     * Add a script to the registry, keyed by its name. The name is taken from the script's static
     * `scriptName` property (for {@link Script} classes), or assigned by {@link createScript} /
     * {@link registerScript}. Note: when {@link createScript} or {@link registerScript} is called,
     * the script is added to the registry automatically, so calling this method directly is only
     * required when registering a {@link Script} class manually (e.g. in an engine-only project).
     *
     * If a script with the same name already exists in the registry, and the new script has a
     * `swap` method defined, it will perform code hot swapping automatically in an async manner.
     *
     * @param {typeof Script | typeof ScriptType} script - The script class to add. Must have a
     * resolvable name (a static `scriptName`, an assigned `__name`, or an inferable class name).
     * @returns {boolean} True if the script was added for the first time. False if a script with
     * the same name already exists, or if the script has no resolvable name.
     * @example
     * var PlayerController = pc.createScript('playerController');
     * // playerController Script Type will be added to pc.ScriptRegistry automatically
     * console.log(app.scripts.has('playerController')); // outputs true
     * @example
     * // engine-only: register an ESM Script class manually
     * class Rotator extends pc.Script {
     *     static scriptName = 'rotator';
     * }
     * app.scripts.add(Rotator);
     * console.log(app.scripts.has('rotator')); // outputs true
     */
    add(script) {
        // Resolve the script name from the class itself, considering only own properties. This
        // handles two cases:
        // - ESM scripts declare their name with a static `scriptName` field. Being a class field,
        //   it shadows the inherited `scriptName` accessor with [[Define]] semantics, so the setter
        //   that would assign `__name` never runs and `__name` is left unset.
        // - A subclass must not inherit (and then overwrite in the registry) the name of its base
        //   class, which would happen if `__name`/`scriptName` were read through the prototype chain.
        // The result is persisted as an own `__name` so subsequent lookups resolve correctly.
        const scriptName = getScriptRegistryName(script);

        if (!scriptName) {
            Debug.error(`script class '${script?.name ?? script}' has no name and cannot be added to the script registry.`);
            return false;
        }

        // Reject names that would clash with ScriptComponent/EventHandler members. This is also
        // checked (and thrown) by `registerScript`/`createScript`, but is enforced here too so the
        // direct `app.scripts.add()` path is guarded.
        if (reservedScriptNames.has(scriptName)) {
            Debug.error(`script name '${scriptName}' is reserved and cannot be added to the script registry.`);
            return false;
        }

        script.__name = scriptName;

        if (this._scripts.has(scriptName)) {
            setTimeout(() => {
                if (script.prototype.swap) {
                    // swapping
                    const old = this._scripts.get(scriptName);
                    const ind = this._list.indexOf(old);
                    this._list[ind] = script;
                    this._scripts.set(scriptName, script);

                    this.fire('swap', scriptName, script);
                    this.fire(`swap:${scriptName}`, script);
                } else {
                    console.warn(`script registry already has '${scriptName}' script, define 'swap' method for new script type to enable code hot swapping`);
                }
            });
            return false;
        }

        this._scripts.set(scriptName, script);
        this._list.push(script);

        this.fire('add', scriptName, script);
        this.fire(`add:${scriptName}`, script);

        // for all components awaiting Script Type
        // create script instance
        setTimeout(() => {
            if (!this._scripts.has(scriptName)) {
                return;
            }

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
                    if (component._scriptsData && component._scriptsData[scriptName]) {
                        attributes = component._scriptsData[scriptName].attributes;
                    }

                    const scriptInstance = component.create(scriptName, {
                        preloading: true,
                        ind: component._scriptsIndex[scriptName].ind,
                        attributes: attributes
                    });

                    if (scriptInstance) {
                        scriptInstances.push(scriptInstance);
                    }

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

                    if (scriptInstances[i].initialize) {
                        scriptInstances[i].initialize();
                    }
                }
            }

            // call postInitialize()
            for (let i = 0; i < scriptInstancesInitialized.length; i++) {
                if (!scriptInstancesInitialized[i].enabled || scriptInstancesInitialized[i]._postInitialized) {
                    continue;
                }

                scriptInstancesInitialized[i]._postInitialized = true;

                if (scriptInstancesInitialized[i].postInitialize) {
                    scriptInstancesInitialized[i].postInitialize();
                }
            }
        });

        return true;
    }

    /**
     * Remove {@link ScriptType}.
     *
     * @param {string|typeof ScriptType} nameOrType - The name or type
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

        if (this.get(scriptName) !== scriptType) {
            return false;
        }

        this._scripts.delete(scriptName);
        const ind = this._list.indexOf(scriptType);
        this._list.splice(ind, 1);

        this.fire('remove', scriptName, scriptType);
        this.fire(`remove:${scriptName}`, scriptType);

        return true;
    }

    /**
     * Get {@link ScriptType} by name.
     *
     * @param {string} name - Name of a {@link ScriptType}.
     * @returns {typeof ScriptType} The Script Type if it exists in the
     * registry or null otherwise.
     * @example
     * var PlayerController = app.scripts.get('playerController');
     */
    get(name) {
        return this._scripts.get(name) || null;
    }

    /**
     * Check if a {@link ScriptType} with the specified name is in the registry.
     *
     * @param {string|typeof ScriptType} nameOrType - The name or type
     * of {@link ScriptType}.
     * @returns {boolean} True if {@link ScriptType} is in registry.
     * @example
     * if (app.scripts.has('playerController')) {
     *     // playerController is in pc.ScriptRegistry
     * }
     */
    has(nameOrType) {
        if (typeof nameOrType === 'string') {
            return this._scripts.has(nameOrType);
        }

        if (!nameOrType) return false;
        const scriptName = nameOrType.__name;
        return this._scripts.get(scriptName) === nameOrType;
    }

    /**
     * Get list of all {@link ScriptType}s from registry.
     *
     * @returns {Array<typeof ScriptType>} list of all {@link ScriptType}s
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
