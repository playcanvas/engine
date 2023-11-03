import { Debug } from '../../../core/debug.js';
import { Component } from '../component.js';
import { Entity } from '../../entity.js';

/**
 * @typedef {Object|Map} AttributeDefinition
 * @property {'asset'|'boolean'|'curve'|'entity'|'json'|'number'|'rgb'|'rgba'|'string'|'vec2'|'vec3'|'vec4'} type - The attribute type
 */

/**
 * @callback UpdateFunction
 * @param {number} dt - The time since the last update.
 */

/**
 * @callback SwapFunction
 * @param {Object} newState - The new state to swap to.
 */

/**
 * @typedef {Object} ModuleInstance
 * @property {Function} [initialize] - A function called when the component is mounted
 * @property {UpdateFunction} [update] - A function called on game tick if the module is enabled
 * @property {Function} [destroy] - A function called when the module should be destroyed
 * @property {SwapFunction} [swap] - A function called to swap state
 */

/**
 * Checks if a class contains a method either itself or in it's inheritance chain
 *
 * @param {Function} Class - The class to check
 * @param {string} method - The name of the method to check
 * @returns {boolean} if a valid class and contains the method in it's inheritance chain
 */
const doesClassHaveMethod = (Class, method) => {
    return typeof Class === 'function' &&
        typeof Class.prototype === 'object' &&
        method in Class.prototype;
};

/**
 * The esmscriptComponent extends the functionality of an Entity by
 * allowing you to attach your own ESM modules to it.
 *
 * @augments Component
 */
class esmscriptComponent extends Component {
    /**
     * A list of valid attribute types
     */
    static VALID_ATTR_TYPES = new Set([
        "asset",
        "boolean",
        "curve",
        "entity",
        "json",
        "number",
        "rgb",
        "rgba",
        "string",
        "vec2",
        "vec3",
        "vec4"
    ]);

    /**
     * For any given attribute definition returns whether it's shape
     * is similar to a valid attribute definition.
     *
     * @param {AttributeDefinition} attributeDefinition - The attribute to check
     * @returns {boolean} True if the object can be treated as a attribute definition
     * @example
     * entity.esmscript.isValidAttributeDefinition({ type: 'entity' });
     */
    static isValidAttributeDefinition(attributeDefinition) {
        return attributeDefinition && esmscriptComponent.VALID_ATTR_TYPES.has(attributeDefinition.type);
    }

    /**
     * Create a new esmscriptComponent instance.
     *
     * @param {import('./system.js').esmscriptComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        /**
         * Holds all module instances of this component.
         * The execution order of modules should be considered indeterminate.
         *
         * Key: {string} moduleSpecifier - The identifier for the module.
         * Value: {ModuleInstance} moduleInstance - The instance of Script ES Module
         *
         * Example:
         * this.attributeDefinitions.set('moduleA', {'type': 'number', defaultValue 10});
         */
        this.modules = new Map();

        /**
         * Holds the attribute definitions for modules.
         *
         * Key: {string} moduleSpecifier - The identifier for the module.
         * Value: {AttributeDefinition} attributeDefinition - The definitions of attributes provided by the module.
         *
         * Example:
         * this.attributeDefinitions.set('moduleA', {'type': 'number', defaultValue 10});
         */
        this.attributeDefinitions = new Map();

        // Holds all the module specifiers for modules with an `update` method
        this.modulesWithUpdate = new Set();

        // Holds all the module specifiers for modules with a `postUpdate` method
        this.modulesWithPostUpdate = new Set();
    }

    /**
     * Fired when Component becomes enabled. Note: this event does not take in account entity or
     * any of its parent enabled state.
     *
     * @event esmscriptComponent#enable
     * @example
     * entity.esmscript.on('enable', function () {
     *     // component is enabled
     * });
     */

    /**
     * Fired when Component becomes disabled. Note: this event does not take in account entity or
     * any of its parent enabled state.
     *
     * @event esmscriptComponent#disable
     * @example
     * entity.esmscript.on('disable', function () {
     *     // component is disabled
     * });
     */

    /**
     * Fired when Component changes state to enabled or disabled. Note: this event does not take in
     * account entity or any of its parent enabled state.
     *
     * @event esmscriptComponent#state
     * @param {boolean} enabled - True if now enabled, False if disabled.
     * @example
     * entity.esmscript.on('state', function (enabled) {
     *     // component changed state
     * });
     */

    /**
     * Fired when Component is removed from entity.
     *
     * @event esmscriptComponent#remove
     * @example
     * entity.esmscript.on('remove', function () {
     *     // entity has no more script component
     * });
     */

    /**
     * Fired when an esm script instance is created and attached to component.
     *
     * @event esmscriptComponent#create
     * @param {string} name - The name of the Script Type.
     * @param {ModuleInstance} moduleInstance - The instance of
     * the {@link ModuleInstance} that has been created.
     * @example
     * entity.esmscript.on('create', function (name, moduleInstance) {
     *     // new script instance added to component
     * });
     */

    /**
     * Fired when an esm script instance is created and attached to component.
     *
     * @event esmscriptComponent#create:[name]
     * @param {ModuleInstance} moduleInstance - The instance of
     * the {@link ModuleInstance} that has been created.
     * @example
     * entity.esmscript.on('create:playerController', function (moduleInstance) {
     *     // new script instance 'playerController' is added to component
     * });
     */

    /**
     * Fired when a script instance is destroyed and removed from component.
     *
     * @event esmscriptComponent#destroyed:[name]
     * @param {ModuleInstance} moduleInstance - The module instance
     * that has been destroyed.
     * @example
     * entity.esmscript.on('destroyed:playerController', function (moduleInstance) {
     *     // modules instance 'playerController' has been destroyed and removed from component
     * });
     */

    _onBeforeRemove() {
        this.modules.forEach(({ moduleInstance }) => {
            this.destroy(moduleInstance);
        });
    }

    _onInitialize() {
        this.modules.forEach(({ moduleInstance }) => {
            moduleInstance.initialize?.();
        });
    }

    _onPostInitialize() {
        this.modules.forEach(({ moduleInstance }) => {
            moduleInstance.postInitialize?.();
        });
    }

    _onUpdate(dt) {
        this.modulesWithUpdate.forEach((module) => {
            this.modules.get(module).update(dt);
        });
    }

    _onPostUpdate(dt) {
        this.modulesWithPostUpdate.forEach((module) => {
            this.modules.get(module).postUpdate(dt);
        });
    }

    /**
     * When an entity is cloned and it has entity script attributes that point to other entities in
     * the same subtree that is cloned, then we want the new script attributes to point at the
     * cloned entities. This method remaps the script attributes for this entity and it assumes
     * that this entity is the result of the clone operation.
     *
     * @param {esmscriptComponent} oldScriptComponent - The source script component that belongs to
     * the entity that was being cloned.
     * @param {object} duplicatedIdsMap - A dictionary with guid-entity values that contains the
     * entities that were cloned.
     * @internal
     */
    resolveDuplicatedEntityReferenceProperties(oldScriptComponent, duplicatedIdsMap) {

        // for each module in the old component
        oldScriptComponent.modules.forEach((module, moduleSpecifier) => {

            // Get the attribute definition for the specified module
            const attributeDefinitions = this.attributeDefinitions.get(moduleSpecifier);
            this.forEachAttributeDefinition(attributeDefinitions, (attributeName, attributeDefinition) => {

                // If the attribute is an 'entity', then this needs to be resolved
                if (attributeDefinition.type === 'entity') {
                    const value = module[attributeName];
                    const newModule = this.modules.get(moduleSpecifier);

                    this._resolveEntityScriptAttribute(
                        attributeDefinition,
                        attributeName,
                        value,
                        false,
                        newModule,
                        duplicatedIdsMap
                    );
                }
            });
        });
    }

    /**
     * This method iterates recursively over an attribute definition and executes the
     * provided function once for each valid definition and it's children attributes.
     *
     * @param {AttributeDefinition} attributeDefinitions - An iterable object or Map where each key-value pair consists of an attributeName and an attributeDefinition.
     * @param {Function} callbackFn - A function to execute for each valid entry. The function is called with (attributeName, attributeDefinition).
     *
     * @example
     * forEachAttribute({
     *   thisAttr: { type: 'entity' }
     *   nested: {
     *     thatAttr: { type: 'asset' }
     *   }
     * }, (name, definition) => console.log(`Name: ${name}, Type: ${definition.type}`) )
     * Output: 'Name: thisAttr, Type: entity'
     *         'Name: thatAttr, Type: asset'
     */
    forEachAttributeDefinition(attributeDefinitions = {}, callbackFn) {

        if (!callbackFn) return;

        for (const attributeName in attributeDefinitions) {

            const attributeDefinition = attributeDefinitions[attributeName];
            if (!esmscriptComponent.isValidAttributeDefinition(attributeDefinition)) {

                // If this is a nested attribute definition, then recurse
                if (typeof attributeDefinition === 'object') {
                    this.forEachAttributeDefinition(attributeDefinition, callbackFn);
                }

            } else {
                callbackFn(attributeName, attributeDefinition);
            }
        }
    }

    _resolveEntityScriptAttribute(attribute, attributeName, oldValue, useGuid, newModule, duplicatedIdsMap) {
        if (attribute.array) {
            // handle entity array attribute
            const len = oldValue.length;
            if (!len) {
                return;
            }

            const newGuidArray = oldValue.slice();
            for (let i = 0; i < len; i++) {
                const guid = newGuidArray[i] instanceof Entity ? newGuidArray[i].getGuid() : newGuidArray[i];
                if (duplicatedIdsMap[guid]) {
                    newGuidArray[i] = useGuid ? duplicatedIdsMap[guid].getGuid() : duplicatedIdsMap[guid];
                }
            }

            newModule[attributeName] = newGuidArray;
        } else {

            // handle regular entity attribute
            if (oldValue instanceof Entity) {
                oldValue = oldValue.getGuid();
            } else if (typeof oldValue !== 'string') {
                return;
            }

            if (duplicatedIdsMap[oldValue]) {

                newModule[attributeName] = duplicatedIdsMap[oldValue];

            }
        }
    }

    /**
     * Detect if script is attached to an entity.
     *
     * @param {string} moduleSpecifier - The module specifier to search for
     * @returns {boolean} If script is attached to an entity.
     * @example
     * if (entity.module.has('path/to/module.mjs')) {
     *     // entity has script
     * }
     */
    has(moduleSpecifier) {
        return this.modules.has(moduleSpecifier);
    }

    /**
     * Get a script instance (if attached).
     *
     * @param {string} moduleSpecifier - The
     * name or type of {@link ScriptType}.
     * @returns {import('../../script/script-type.js').ScriptType|null} If script is attached, the
     * instance is returned. Otherwise null is returned.
     * @example
     * const controller = entity.module.get('module');
     */
    get(moduleSpecifier) {
        return this.modules.get(moduleSpecifier);
    }

    /**
     * Create a script instance and attach to an entity script component.
     *
     * @param {string} moduleSpecifier - The module specifier used to import the ES module.
     * @param {object} [args] - Object with arguments for a script.
     * @param {boolean} [args.enabled] - If script instance is enabled after creation. Defaults to
     * true.
     * @param {object} [args.attributes] - Object with values for attributes (if any), where key is
     * name of an attribute.
     * @param {boolean} [args.preloading] - If script instance is created during preload. If true,
     * script and attributes must be initialized manually. Defaults to false.
     * @param {number} [args.ind] - The index where to insert the script instance at. Defaults to
     * -1, which means append it at the end.
     * @returns {*} Returns an instance of a
     * ES Module if successfully attached to an entity, or null if the import fails
     * @example
     * entity.module.create('moduleSpecifier', {
     *     attributes: {
     *         speed: 4
     *     }
     * });
     */
    // create(moduleSpecifier, args = {}) {

    //     DynamicImport(this.system.app, moduleSpecifier).then(({ default: ModuleClass, attributes: attributeDefinition }) => {

    //         this.instantiateModule(moduleSpecifier, ModuleClass, attributeDefinition, args.attributes);

    //     }).catch(Debug.error);

    // }

    /**
     * Registers an in-memory Script ES module with the the component system, allowing it to interact with the engine update mechanic.
     * If the module already exists, ie. a module with the same specifier exists in this component, then it will
     * replace this *if* the module has a swap method.
     *
     * @param {string} moduleSpecifier - A unique module specifier, used to identify the module.
     * @param {Function} ModuleClass - The ES Script Module class to add to the component
     * @param {AttributeDefinition} attributeDefinition - A definition of the attributes used in the Script ESM class
     * @param {object} [attributes] - A set of attributes which are assigned to the Script Module instance
     * @returns {ModuleInstance} An instance of the module
     * @private
     */
    create(moduleSpecifier, ModuleClass, attributeDefinition = {}, attributes = {}) {

        if (!ModuleClass)
            throw new Error(`The module '${moduleSpecifier}' does not export a default`);

        if (typeof ModuleClass !== 'function')
            throw new Error(`The module '${moduleSpecifier}' does not export a class or a function`);

        const moduleInstance = new ModuleClass(this.system.app, this.entity);

        // Assign any attribute definition that has been provided, or assign the default
        this.forEachAttributeDefinition(attributeDefinition, (attributeName) => {
            moduleInstance[attributeName] = attributes[attributeName] || attributeDefinition[attributeName]?.default;
        });

        // Retrieve any previous instance associated with the module specifier
        const previousModuleInstance = this.modules.get(moduleSpecifier)?.moduleInstance;
        const isHMREnabled = moduleInstance.swap && typeof moduleInstance.swap === 'function';

        // Add Modules to relevant update/post-update lists
        if (doesClassHaveMethod(ModuleClass, 'update')) this.modulesWithUpdate.add(moduleSpecifier);
        if (doesClassHaveMethod(ModuleClass, 'postUpdate')) this.modulesWithPostUpdate.add(moduleSpecifier);

        this.fire('create', moduleSpecifier, moduleInstance);
        this.fire('create:' + moduleSpecifier, moduleInstance);

        // Check if an existing module exists, ie. if this is a candidate to swap
        if (previousModuleInstance) {

            // Copy intrinsic state
            moduleInstance.enabled = previousModuleInstance.enabled;

            // Copy user defined state using `swap`
            if (isHMREnabled)
                moduleInstance.swap(previousModuleInstance);

        } else if (moduleInstance.enabled || !Object.hasOwn(moduleInstance, 'enabled')) {
            moduleInstance.initialize?.();
        }

        // Listen for any subsequent load events
        this.system.app.assets.once(`load:url:${this.system.app.assets.prefix + moduleSpecifier}`, (asset) => {

            const NewModuleClass = asset.resource;
            console.log('PRE SWAP', NewModuleClass);

            // Only upgrade the module if the class contains a `swap` method
            if ('swap' in NewModuleClass) {
                this.create(moduleSpecifier, NewModuleClass, attributeDefinition, attributes);
            } else {
                Debug.warn(
                    `The Script Module '${NewModuleClass}' does not have a 'swap' method, and is therefore ineligible for hot reloading. Please reload.`
                );
            }
        });

        this.modules.set(moduleSpecifier, moduleInstance);
        this.attributeDefinitions.set(moduleSpecifier, attributeDefinition);

        return moduleInstance;
    }


    /**
     * Destroy the script instance that is attached to an entity.
     *
     * @param {string} moduleSpecifier - The
     * name or type of {@link ScriptType}.
     * @returns {boolean} If it was successfully destroyed.
     * @example
     * entity.script.destroy('playerController');
     */
    destroy(moduleSpecifier) {

        const module = this.modules.get(moduleSpecifier);

        if (module) {

            // Remove from local data
            this.modules.delete(moduleSpecifier);
            this.attributeDefinitions.delete(moduleSpecifier);
            this.modulesWithPostUpdate.delete(moduleSpecifier);
            this.modulesWithPostUpdate.delete(moduleSpecifier);

            // Fire component level events
            this.fire('destroy', moduleSpecifier, module);
            this.fire('destroy:' + moduleSpecifier, module);

            // Call modules destroy if present
            module.destroy?.();

            return true;
        }

        return false;
    }
}

export { esmscriptComponent };
