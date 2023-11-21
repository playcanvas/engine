import { Debug } from '../../../core/debug.js';
import { Component } from '../component.js';
import { Entity } from '../../entity.js';
import { classHasMethod } from '../../../core/class-utils.js';

/**
 * @callback UpdateFunction
 * @param {number} dt - The time since the last update.
 * @ignore
 */

/**
 * @callback SwapFunction
 * @param {Object} newState - The new state to swap to.
 * @ignore
 */

/**
 * @typedef {Object} ModuleInstance
 * @property {Function} [active] - A function called when the module becomes active
 * @property {Function} [inactive] - A function called when the module becomes inactive
 * @property {UpdateFunction} [update] - A function called on game tick if the module is enabled
 * @property {Function} [destroy] - A function called when the module should be destroyed
 */

/**
 * This type represents a generic class constructor.
 * @typedef {Function} ModuleClass
 */

/**
 * @typedef {Object|Map} AttributeDefinition
 * @property {'asset'|'boolean'|'curve'|'entity'|'json'|'number'|'rgb'|'rgba'|'string'|'vec2'|'vec3'|'vec4'} type - The attribute type
 */

/**
 * The expected output of an ESM Script file. It contains the class definition and the attributes it requires.
 * @typedef {Object} ModuleExport
 * @property {ModuleClass} default - The default export of a esm script that defines a class
 * @property {Object.<string, AttributeDefinition>} attributes - An object containing the names of attributes and their definitions;
 */

/**
 * The EsmScriptComponent extends the functionality of an Entity by
 * allowing you to attach your own ESM modules to it.
 *
 * **The api is likely to change, use at your own discretion**
 * @ignore
 * @augments Component
 */
class EsmScriptComponent extends Component {
    /**
     * A list of valid attribute types
     * @ignore
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
     * For any given attribute definition returns whether it conforms to the required
     * shape of an attribute definition.
     *
     * @param {AttributeDefinition|object} attributeDefinition - The attribute to check
     * @returns {boolean} True if the object can be treated as a attribute definition
     * @example
     * isValidAttributeDefinition({ type: 'entity' }); // true
     * isValidAttributeDefinition({ type: 'invalidType' }); // false
     * isValidAttributeDefinition({ x: 'y' }); // false
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
         * Object shorthand passed to scripts update and postUpdate
         */
        this.appEntity = { app: system.app, entity: entity };

        /**
         * Holds all ESM instances of this component.
         *
         * @type {Set.<ModuleInstance>}
         */
        this.modules = new Set();

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

        // Holds all modules with an `update` method
        this.modulesWithUpdate = new Set();

        // Holds all modules with a `postUpdate` method
        this.modulesWithPostUpdate = new Set();

        // Contains all the enabled modules. An enabled module, is one that is locally considered as
        this.enabledModules = new Set();

        // Contains all the modules awaiting to be enabled.
        this.awaitingToBeEnabledModules = new Set();

        // Contains all the enabled modules that have not been marked as active modules.
        this.enabledAndInactiveModules = new Set();
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
     * @param {ModuleInstance} moduleInstance - The module instance that was created.
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
        for (const module of this.modules) {

            const ModuleClass = module.constructor;

            // disables the module
            this.disableModule(module);

            // Call modules destroy if present
            module.destroy?.();

            // Remove from local data
            this.modules.delete(module);
            this.attributeDefinitions.delete(ModuleClass);
        }
    }

    get isActive() {
        return this.enabled && this.entity.enabled;
    }

    flushActiveModules() {

        // ensure app-entity refs are up-to-date
        this.appEntity.entity = this.entity;
        this.appEntity.system = this.system;

        for (const module of this.awaitingToBeEnabledModules) {
            if (!this.isActive) break;
            this.enabledModules.add(module);
            if (classHasMethod(module.constructor, 'update')) this.modulesWithUpdate.add(module);
            if (classHasMethod(module.constructor, 'postUpdate')) this.modulesWithPostUpdate.add(module);
            module.active?.(this.appEntity);
        }
        this.awaitingToBeEnabledModules.clear();
    }

    flushInactiveModules() {
        for (const module of this.modules) {
            if (!this.isActive) break;
            if (!this.enabledModules.has(module)) module.inactive?.();
        }
    }

    _onUpdate(dt) {

        // ensure app-entity refs are up-to-date
        this.appEntity.entity = this.entity;
        this.appEntity.system = this.system;

        for (const module of this.modulesWithUpdate) {
            if (!this.isActive) break;
            module.update(dt, this.appEntity);
        }
    }

    _onPostUpdate(dt) {

        // ensure app-entity refs are up-to-date
        this.appEntity.entity = this.entity;
        this.appEntity.system = this.system;

        for (const module of this.modulesWithPostUpdate) {
            if (!this.isActive) break;
            module.postUpdate(dt, this.appEntity);
        }
    }

    /**
     * Disables a module and prevents it receiving lifecycle events
     * @param {ModuleInstance} module - The module to disable
     */
    disableModule(module) {

        if (!this.modules.has(module)) {
            Debug.error(`The module '${module?.constructor?.name}' has not been added to this component.`);
            return;
        }

        this.enabledModules.delete(module);
        this.awaitingToBeEnabledModules.delete(module);
        this.modulesWithUpdate.delete(module);
        this.modulesWithPostUpdate.delete(module);
    }

    /**
     * Enables a module, allowing it to receive lifecycle events
     * @param {ModuleInstance} module - The module to enable
     * @internal
     */
    enableModule(module) {

        if (!this.modules.has(module)) {
            Debug.error(`The module '${module?.constructor?.name}' has not been added to this component.`);
            return;
        }

        if (this.enabledModules.has(module))
            return;

        this.awaitingToBeEnabledModules.add(module);
    }

    /**
     * @param {ModuleInstance} module - The module to check
     * @returns {boolean} if the module will receive lifecycle updates
     * @internal
     */
    isModuleEnabled(module) {
        return this.enabledModules.has(module);
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
            EsmScriptComponent.forEachAttributeDefinition(attributeDefinitions, (attributeName, attributeDefinition) => {

                // If the attribute is an 'entity', then this needs to be resolved
                if (attributeDefinition.type === 'entity') {
                    const value = module?.[attributeName];
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
     * @param {ModuleInstance} module - The ESM Script Class.
     * @returns {boolean} If script is attached to an entity.
     * @example
     * if (entity.module.has(ModuleClass)) {
     *     // entity has script
     * }
     */
    has(module) {
        return this.modules.has(module);
    }

    // /**
    //  * Get a script instance (if attached).
    //  *
    //  * @param {Function} moduleClass - The ESM Script Class.
    //  * @returns {ModuleInstance|undefined} If an ESM Script is attached, the
    //  * instance is returned. Otherwise null is returned.
    //  * @example
    //  * const controller = entity.module.get(ModuleClass);
    //  */
    // get(moduleClass) {
    //     return this.modules.get(module);
    // }

    /**
     * Removes a module instance from the component.
     * @param {ModuleInstance} module - The instance of the esm script to remove
     */
    remove(module) {

        if (!this.modules.has(module)) {
            Debug.warn(`The esm script '${module.constructor?.name}' has not been added to this component`);
            return;
        }

        this.disableModule(module);
        this.attributeDefinitions.delete(module);
        this.modules.delete(module);
    }

    /**
     * Adds an ESM Script class to the component system and assigns its attributes based on the `attributeDefinition`
     * If the module is enabled, it will receive lifecycle updates.
     *
     * @param {ModuleExport} moduleExport - The export of the ESM Script to add to the component
     * @param {Object.<string, AttributeDefinition>} [attributeValues] - A set of attributes to be assigned to the Script Module instance
     * @returns {ModuleInstance|null} An instance of the module
     */
    add(moduleExport, attributeValues = {}) {

        // destructure the module export
        const { default: ModuleClass, attributes: attributeDefinition = {} } = moduleExport;

        if (!ModuleClass || typeof ModuleClass !== 'function')
            throw new Error(`The ESM Script Module class is undefined`);

        // if (this.modules.has(ModuleClass)) {
        //     Debug.warn(`The ESM Script class '${ModuleClass?.name}' has already been added to this component`);
        //     return null;
        // }

        // Create the esm script instance
        const module = new ModuleClass({ app: this.system.app, entity: this.entity });

        // Assign any attribute definition that have been provided, or if not, assign the default
        EsmScriptComponent.populateWithAttributes(module, attributeDefinition, attributeValues);

        this.modules.add(module);
        this.attributeDefinitions.set(module, attributeDefinition);

        // Enable the module, so that it receives lifecycle hooks
        this.enableModule(module);

        this.fire('create', module);

        return module;
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
}

export { EsmScriptComponent };
