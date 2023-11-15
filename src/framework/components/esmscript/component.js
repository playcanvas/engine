import { Debug } from '../../../core/debug.js';
import { Component } from '../component.js';
import { Entity } from '../../entity.js';
import { classHasMethod } from '../../../core/class-utils.js';
import { DynamicImport } from '../../handlers/esmscript.js';

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
 * @property {Boolean} [enabled] - A flag that determines whether the ESM Script can receive life cycle updates (init/update)
 * @property {Function} [initialize] - A function called when the component is ;
 * @property {Function} [postInitialize] - A function called after all component have initialized
 * @property {UpdateFunction} [update] - A function called on game tick if the module is enabled
 * @property {Function} [destroy] - A function called when the module should be destroyed
 * @property {SwapFunction} [swap] - A function called to swap state
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
     * @typedef {Object|Map} AttributeDefinition
     * @property {'asset'|'boolean'|'curve'|'entity'|'json'|'number'|'rgb'|'rgba'|'string'|'vec2'|'vec3'|'vec4'} type - The attribute type
     */

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
         * Holds all ESM instances of this component.
         *
         * @type {Map<Function, ModuleInstance>}
         */
        this.modules = new Map();

        /**
         * Holds all module specifiers for each ESM Script
         * @type {Map<string, import('src/core/event-handler.js').HandleEventCallback>}
         */
        this.modulesSpecifiersEventMap = new Map();

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
        this.modules.forEach((moduleInstance) => {

            const ModuleClass = moduleInstance.constructor;

            // Remove from local data
            this.modules.delete(ModuleClass);
            this.attributeDefinitions.delete(ModuleClass);
            this.modulesWithPostUpdate.delete(ModuleClass);
            this.modulesWithPostUpdate.delete(ModuleClass);

            // Call modules destroy if present
            moduleInstance.destroy?.();

            // Fire component level events
            this.fire('destroyed', module);
        });

        // Remove events
        for (const [moduleSpecifier, callback] of this.modulesSpecifiersEventMap) {
            this.system.app.assets.off(`load:url:${moduleSpecifier}`, callback);
        }
    }

    _onInitialize() {
        for (const [, module] of this.modules) {
            module.initialize?.();
        }
    }

    _onPostInitialize() {
        for (const [, module] of this.modules) {
            module.postInitialize?.();
        }
    }

    _onUpdate(dt) {
        for (const module of this.modulesWithUpdate) {
            module.update(dt);
        }
    }

    _onPostUpdate(dt) {
        for (const module of this.modulesWithPostUpdate) {
            module.postUpdate(dt);
        }
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
     * @param {Function} moduleClass - The ESM Script Class.
     * @returns {boolean} If script is attached to an entity.
     * @example
     * if (entity.module.has(ModuleClass)) {
     *     // entity has script
     * }
     */
    has(moduleClass) {
        return this.modules.has(moduleClass);
    }

    /**
     * Get a script instance (if attached).
     *
     * @param {Function} moduleClass - The ESM Script Class.
     * @returns {ModuleInstance|undefined} If an ESM Script is attached, the
     * instance is returned. Otherwise null is returned.
     * @example
     * const controller = entity.module.get(ModuleClass);
     */
    get(moduleClass) {
        return this.modules.get(moduleClass);
    }

    /**
     * Removes a module instance from the component.
     * @param {*} ModuleClass - The ESM Script class to remove
     */
    remove(ModuleClass) {

        const moduleInstance = this.modules.get(ModuleClass);

        if (!moduleInstance) {
            Debug.warn(`The ESM Script '${ModuleClass?.name}' has not been added to this component`);
            return;
        }

        this.modulesWithPostUpdate.delete(moduleInstance);
        this.modulesWithUpdate.delete(moduleInstance);
        this.attributeDefinitions.delete(ModuleClass);
        this.modules.delete(ModuleClass);
    }

    /**
     * Adds an ESM Script class to the component system
     * and assigns attributes based on it's `attributeDefinition`
     * If the module is enabled, it will receive lifecycle updates.
     *
     * @param {Function} ModuleClass - The ES Script Module class to add to the component
     * @param {AttributeDefinition} attributeDefinition - Defines the attributes of the ESM Script
     * @param {object} [attributes] - A set of attributes to be assigned to the Script Module instance
     *
     * @returns {ModuleInstance} An instance of the module
     */

    add(ModuleClass, attributeDefinition = {}, attributes = {}) {

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
     * This method will attempt to swap ESM Script, copying over attributes and state if possible
     *
     * @param {Function} SourceESMScriptClass - The source ESM Script to copy state from
     * @param {Function} TargetESMScriptClass - The target ESM Script to copy state to
     * @param {AttributeDefinition} attributeDefinition - Defines the attributes that will be copied from the SourceESMScriptClass
     * @returns {Boolean} true if the state was swapped, or false if it failed.
     */
    swap(SourceESMScriptClass, TargetESMScriptClass, attributeDefinition) {

        const moduleInstance = this.modules.get(SourceESMScriptClass);

        if (!moduleInstance) {
            Debug.warn(`The ESM Script '${SourceESMScriptClass?.name}' has not been added to this component`);
            return false;
        }

        if (!classHasMethod(TargetESMScriptClass, 'swap')) {
            Debug.warn(`The ESM Script '${TargetESMScriptClass?.name}' does not implement a 'swap' method, so is ineligible for hot swapping`);
            return false;
        }

        // Remove the previous ESM Script
        this.remove(SourceESMScriptClass);

        // Add the new script, using the old instance as the attribute source
        const attributes = moduleInstance;
        const newModuleInstance = this.add(TargetESMScriptClass, attributeDefinition, attributes);

        // and swap the state if possible
        newModuleInstance.swap?.(module);

        return true;

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
