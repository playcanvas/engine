import { Debug } from '../../../core/debug.js';
import { Component } from '../component.js';
import { Entity } from '../../entity.js';
import { classHasMethod } from '../../../core/class-utils.js';
import { DynamicImport } from '../../handlers/esmscript.js';

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
 * @property {Boolean} [enabled] - A flag that determines whether the ESM Script can receive life cycle updates (init/update)
 * @property {Function} [initialize] - A function called when the component is mounted
 * @property {UpdateFunction} [update] - A function called on game tick if the module is enabled
 * @property {Function} [destroy] - A function called when the module should be destroyed
 * @property {SwapFunction} [swap] - A function called to swap state
 */

/**
 * The EsmScriptComponent extends the functionality of an Entity by
 * allowing you to attach your own ESM modules to it.
 *
 * @augments Component
 */
class EsmScriptComponent extends Component {
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
        return attributeDefinition && EsmScriptComponent.VALID_ATTR_TYPES.has(attributeDefinition.type);
    }

    /**
     * Create a new EsmScriptComponent instance.
     *
     * @param {import('./system.js').EsmScriptComponentSystem} system - The ComponentSystem that
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
     * @event EsmScriptComponent#enable
     * @example
     * entity.esmscript.on('enable', function () {
     *     // component is enabled
     * });
     */

    /**
     * Fired when Component becomes disabled. Note: this event does not take in account entity or
     * any of its parent enabled state.
     *
     * @event EsmScriptComponent#disable
     * @example
     * entity.esmscript.on('disable', function () {
     *     // component is disabled
     * });
     */

    /**
     * Fired when Component changes state to enabled or disabled. Note: this event does not take in
     * account entity or any of its parent enabled state.
     *
     * @event EsmScriptComponent#state
     * @param {boolean} enabled - True if now enabled, False if disabled.
     * @example
     * entity.esmscript.on('state', function (enabled) {
     *     // component changed state
     * });
     */

    /**
     * Fired when Component is removed from entity.
     *
     * @event EsmScriptComponent#remove
     * @example
     * entity.esmscript.on('remove', function () {
     *     // entity has no more script component
     * });
     */

    /**
     * Fired when an esm script instance is created and attached to component.
     *
     * @event EsmScriptComponent#create
     * @param {ModuleInstance} moduleInstance - The instance of
     * the {@link ModuleInstance} that has been created.
     * @example
     * entity.esmscript.on('create', function (name, moduleInstance) {
     *     // new script instance added to component
     * });
     */

    /**
     * Fired when a script instance is destroyed and removed from component.
     *
     * @event EsmScriptComponent#destroyed:[name]
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
            module.update(dt);
        });
    }

    _onPostUpdate(dt) {
        this.modulesWithPostUpdate.forEach((module) => {
            module.postUpdate(dt);
        });
    }

    /**
     * @todo
     * When an entity is cloned and it has entity script attributes that point to other entities in
     * the same subtree that is cloned, then we want the new script attributes to point at the
     * cloned entities. This method remaps the script attributes for this entity and it assumes
     * that this entity is the result of the clone operation.
     *
     * @param {EsmScriptComponent} oldScriptComponent - The source script component that belongs to
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
     * provided function once for each valid definition and it's children attributes in a flat structure
     *
     * @param {AttributeDefinition} attributeDefinitions - An iterable object or Map where each key-value pair consists of an attributeName and an attributeDefinition.
     * @param {Function} callbackFn - A function to execute for each valid entry. The function is called with (attributeName, attributeDefinition).
     * @param {array} [path] - A path
     *
     * @example
     * forEachAttribute({
     *   thisAttr: { type: 'entity' }
     *   nested: {
     *     thatAttr: { type: 'asset' }
     *   }
     * }, (name, definition) => console.log(`Name: ${name}, Type: ${definition.type}, Path: ${path}`) )
     * Output: 'Name: thisAttr, Type: entity, Path: ''
     *         'Name: thatAttr, Type: asset', Path: 'nested'
     */
    static forEachAttributeDefinition(attributeDefinitions = {}, callbackFn, path = []) {

        if (!callbackFn) return;

        for (const attributeName in attributeDefinitions) {

            const attributeDefinition = attributeDefinitions[attributeName];
            if (!EsmScriptComponent.isValidAttributeDefinition(attributeDefinition)) {

                // If this is a nested attribute definition, then recurse
                if (typeof attributeDefinition === 'object') {
                    callbackFn(attributeName, attributeDefinition, path);
                    EsmScriptComponent.forEachAttributeDefinition(attributeDefinition, callbackFn, [...path, attributeName]);
                }

            } else {
                callbackFn(attributeName, attributeDefinition, path);
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

    unregister(ModuleClass) {

        const moduleInstance = this.modules.get(ModuleClass);

        if (moduleInstance) {
            this.modulesWithPostUpdate.delete(moduleInstance);
            this.modulesWithUpdate.delete(moduleInstance);
            this.modules.delete(ModuleClass);
        }
    }

    /**
     * Registers a ESM Script class with the the component system
     * and assigns attributes in line with the {@link AttributeDefinition}.
     * If the module is enabled, it will receive lifecycle updates.
     *
     * @param {Function} ModuleClass - The ES Script Module class to add to the component
     * @param {AttributeDefinition} attributeDefinition - Defines the attributes of the ESM Script
     * @param {object} [attributes] - A set of attributes to be assigned to the Script Module instance
     *
     * @returns {ModuleInstance} An instance of the module
     */

    register(ModuleClass, attributeDefinition = {}, attributes = {}) {

        if (!ModuleClass || typeof ModuleClass !== 'function')
            throw new Error(`The ESM Script Module class is undefined`);

        if (this.modules.get(ModuleClass)) {
            Debug.warn(`The ESM Script class '${ModuleClass.name}' has already been added to this component`);
            return this.modules.get(ModuleClass);
        }

        const moduleInstance = new ModuleClass(this.system.app, this.entity);

        // Add Modules to relevant update/post-update lists
        if (classHasMethod(ModuleClass, 'update')) this.modulesWithUpdate.add(moduleInstance);
        if (classHasMethod(ModuleClass, 'postUpdate')) this.modulesWithPostUpdate.add(moduleInstance);

        // Assign any attribute definition that have been provided, or if not, assign the default
        EsmScriptComponent.populateWithAttributes(moduleInstance, attributeDefinition, attributes);

        this.fire('create', moduleInstance);

        this.modules.set(ModuleClass, moduleInstance);
        this.attributeDefinitions.set(ModuleClass, attributeDefinition);

        return moduleInstance;
    }

    /**
     * The 'import' method provides a convenient function for importing an ESM Script and
     * registering it with the component system. It will import the module, add or replace
     * it within the component, and swap any state if if possible.
     *
     * Note that the ESM Script will be dynamically imported, which will trigger a
     * network request if the module has not already been imported somewhere else.
     *
     * @param {string} path - The path to the ESM Script
     * @param {Object} attributes - The set of attributes to attach to the ESM Script
     *
     * @example
     * // Uncomment bellow to ensure the module is statically imported
     * // import 'https://domain.com/path/to/module.js'
     *
     * entity.esmscript.create(
     *  new URL('https://domain.com/path/to/module.js'),
     *  { particleCount: 10 }
     * )
     */
    import(path, attributes = {}) {

        const app = this.system.app;

        // normalize the URL
        const url = new URL(path, 'https://example.com');
        const moduleSpecifier = url.pathname + url.search;

        DynamicImport(app, moduleSpecifier).then((ModuleExport) => {

            const { default: ModuleClass, attributes: attributeDefinition } = ModuleExport;
            const module = this.register(ModuleClass, attributeDefinition, attributes);

            // When the asset associated with this moduleSpecifier updates...
            app.assets.once(`load:url:${moduleSpecifier}`, ({ resource }) => {

                const NewModuleClass = resource;

                // If the new class has a swap method, then remove the previous module class
                if (classHasMethod(NewModuleClass, 'swap'))
                    this.unregister(ModuleClass);

                // Register the new class
                const newModuleInstance = this.register(NewModuleClass, attributeDefinition, attributes);

                // swap
                const didSwap = this.swap(module, newModuleInstance);

                // If it fails, then instantiate the module
                if (!didSwap) newModuleInstance.initialize?.();
                else this.register(ModuleClass, attributeDefinition, attributes);

            });

            module.initialize?.();

        }).catch(Debug.error);
    }

    /**
     * If possible, this method will swap state between a target and source ESM Script.
     *
     * @param {ModuleInstance} sourceModule - The source ESM Script to copy state from
     * @param {ModuleInstance} targetModule - The target ESM Script to copy state to
     * @returns {Boolean} true if the state was swapped, or false if it failed.
     */
    swap(sourceModule, targetModule) {
        if (classHasMethod(targetModule.constructor, 'swap')) {
            targetModule.swap?.(sourceModule);
            return true;
        }

        Debug.warn(`ESM Script '${targetModule.constructor.name}' cannot be swapped, as it does not have a 'swap' method.`);
        return false;
    }

    /**
     * A Dictionary object where each key is a string and each value is an AttributeDefinition.
     * @typedef {Object.<string, AttributeDefinition>} AttributeDefinitionDict
     */

    /**
     * This function recursively populates an object with attributes based on an attribute definition.
     * Only attributes defined in the definition. Note that this does not perform any type-checking.
     * If no attribute is specified it uses the default value from the attribute definition if available.
     *
     * @param {Object} object - The object to populate with attributes
     * @param {AttributeDefinitionDict} attributeDefDict - The definition
     * @param {Object} attributes - The attributes to apply
     *
     * @example
     * const attributes = { someNum: 1, nested: { notStr: 2, ignoredValue: 20 }}
     * const definitions = {
     *  someNum: { type: 'number' },
     *  nested: {
     *      notStr: { type: 'string' },
     *      otherValue: { type: 'number', default: 3 }
     *  }
     * }
     *
     * populateWithAttributes(object, attributeDefDict, attributes)
     * // outputs { someNum: 1, nested: { notStr: 2, otherValue: 3 }}
     */
    static populateWithAttributes(object, attributeDefDict, attributes) {

        for (const attributeName in attributeDefDict) {
            const attributeDefinition = attributeDefDict[attributeName];

            if (EsmScriptComponent.isValidAttributeDefinition(attributeDefinition)) {
                if (!Object.hasOwn(object, attributeName)) {
                    object[attributeName] = attributes?.[attributeName] || attributeDefinition.default;
                }
            } else if (typeof attributeDefinition === 'object') {

                this.populateWithAttributes(
                    object[attributeName] = {},
                    attributeDefinition,
                    attributes?.[attributeName]
                );
            }
        }
    }

    /**
     * Destroy the script instance that is attached to an entity.
     *
     * @param {ModuleInstance} moduleInstance - The moduleInstance to destroy.
     * @returns {boolean} If it was successfully destroyed.
     * @example
     * entity.esmscript.destroy(playerController);
     */
    destroy(moduleInstance) {

        const ModuleClass = moduleInstance.constructor;
        const module = this.modules.get(ModuleClass);

        if (module) {

            // Remove from local data
            this.modules.delete(ModuleClass);
            this.attributeDefinitions.delete(ModuleClass);
            this.modulesWithPostUpdate.delete(ModuleClass);
            this.modulesWithPostUpdate.delete(ModuleClass);

            // Call modules destroy if present
            module.destroy?.();

            // Fire component level events
            this.fire('destroyed', module);

            return true;
        }

        return false;
    }
}

export { EsmScriptComponent };
