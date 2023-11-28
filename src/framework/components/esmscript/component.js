import { Debug } from '../../../core/debug.js';
import { Component } from '../component.js';
import { classHasMethod } from '../../../core/class-utils.js';
import { rawToValue, reduceAttributeDefinition } from './attribute-utils.js';

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
         * @type {Set.<ModuleInstance>}
         */
        this.modules = new Set();

        /**
         * Holds a map of modules class names to instances to enable shorthand lookup
         * @type {Map.<string, ModuleInstance>}
         */
        this.moduleNameInstanceMap = new Map();

        /**
         * Holds the attribute definitions for modules.
         * @type {Map.<ModuleInstance, AttributeDefinition>}
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
            this.moduleNameInstanceMap.delete(ModuleClass.name);
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
            this.awaitingToBeEnabledModules.delete(module);
            this.enabledModules.add(module);
            if (classHasMethod(module.constructor, 'update')) this.modulesWithUpdate.add(module);
            if (classHasMethod(module.constructor, 'postUpdate')) this.modulesWithPostUpdate.add(module);
            module.active?.(this.appEntity);
        }
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
    // resolveDuplicatedEntityReferenceProperties(oldScriptComponent, duplicatedIdsMap) {

    //     // for each module in the old component
    //     oldScriptComponent.modules.forEach((module, moduleSpecifier) => {

    //         // Get the attribute definition for the specified module
    //         const attributeDefinitions = this.attributeDefinitions.get(moduleSpecifier);
    //         EsmScriptComponent.forEachAttributeDefinition(attributeDefinitions, (attributeName, attributeDefinition) => {

    //             // If the attribute is an 'entity', then this needs to be resolved
    //             if (attributeDefinition.type === 'entity') {
    //                 const value = module?.[attributeName];
    //                 const newModule = this.modules.get(moduleSpecifier);

    //                 this._resolveEntityScriptAttribute(
    //                     attributeDefinition,
    //                     attributeName,
    //                     value,
    //                     false,
    //                     newModule,
    //                     duplicatedIdsMap
    //                 );
    //             }
    //         });
    //     });
    // }

    // _resolveEntityScriptAttribute(attribute, attributeName, oldValue, useGuid, newModule, duplicatedIdsMap) {
    //     if (attribute.array) {
    //         // handle entity array attribute
    //         const len = oldValue.length;
    //         if (!len) {
    //             return;
    //         }

    //         const newGuidArray = oldValue.slice();
    //         for (let i = 0; i < len; i++) {
    //             const guid = newGuidArray[i] instanceof Entity ? newGuidArray[i].getGuid() : newGuidArray[i];
    //             if (duplicatedIdsMap[guid]) {
    //                 newGuidArray[i] = useGuid ? duplicatedIdsMap[guid].getGuid() : duplicatedIdsMap[guid];
    //             }
    //         }

    //         newModule[attributeName] = newGuidArray;
    //     } else {

    //         // handle regular entity attribute
    //         if (oldValue instanceof Entity) {
    //             oldValue = oldValue.getGuid();
    //         } else if (typeof oldValue !== 'string') {
    //             return;
    //         }

    //         if (duplicatedIdsMap[oldValue]) {

    //             newModule[attributeName] = duplicatedIdsMap[oldValue];

    //         }
    //     }
    // }

    /**
     * Checks if the component contains an esm script.
     *
     * @param {string} moduleName - A case sensitive esm script name.
     * @returns {boolean} If script is attached to an entity.
     * @example
     * if (entity.module.has('Rotator')) {
     *     // entity has script
     * }
     */
    has(moduleName) {
        return this.moduleNameInstanceMap.has(moduleName);
    }

    /**
     * Returns a module instance from it's name
     *
     * @param {string} moduleName - A case sensitive esm script name.
     * @returns {ModuleInstance|undefined} the module if attached to this component
     * @example
     * const rotator = entity.esmscript.get('Rotator')
     */
    get(moduleName) {
        return this.moduleNameInstanceMap.get(moduleName);
    }

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
        this.moduleNameInstanceMap.delete(module.constructor.name);
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

        if (!ModuleClass.name || ModuleClass.name === '')
            throw new Error('Anonymous classes are not supported. Please use `class MyClass{}` as opposed to `const MyClass = class{}`');

        // Create the esm script instance
        const module = new ModuleClass();

        // Assign any attribute definition that have been provided, or if not, assign the default
        EsmScriptComponent.populateWithAttributes(this.system.app, attributeDefinition, attributeValues, module);
        this.modules.add(module);
        this.moduleNameInstanceMap.set(ModuleClass.name, module);
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
     * @param {AppBase} app - The app base to search for asset references
     * @param {AttributeDefinitionDict} attributeDefDict - The definition
     * @param {Object} attributes - The attributes to apply
     * @param {Object} [object] - The object to populate with attributes
     *
     * @returns {Object} the object with properties set
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
     * populateWithAttributes(app, object, attributeDefDict, attributes)
     * // outputs { someNum: 1, nested: { notStr: 2, otherValue: 3 }}
     */
    static populateWithAttributes(app, attributeDefDict, attributes, object = {}) {

        return reduceAttributeDefinition(attributeDefDict, attributes, (object, key, attributeDefinition, value) => {
            const mappedValue = rawToValue(app, attributeDefinition, value);

            if (mappedValue === null) {
                Debug.warn(`The attribute '${key}' has an invalid type of '${attributeDefinition.type}'`)
            } else {
                object[key] = mappedValue;
            }

        }, object);

    }
}

export { EsmScriptComponent };
