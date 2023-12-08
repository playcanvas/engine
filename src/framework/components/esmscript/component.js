import { Debug } from '../../../core/debug.js';
import { Component } from '../component.js';
import { classHasMethod } from '../../../core/class-utils.js';
import { forEachAttributeDefinition, getValueAtPath, populateWithAttributes, setValueAtPath } from './attribute-utils.js';

/**
 * @callback UpdateFunction
 * @param {number} dt - The time since the last update.
 * @ignore
 */

/**
 * @typedef {Object} ModuleInstance
 * @property {Function} [initialize] - A function called once when the module becomes initialized
 * @property {Function} [postInitialize] - A function called once after all modules become initialized
 * @property {Function} [active] - A function called when the module becomes active
 * @property {Function} [inactive] - A function called when the module becomes inactive
 * @property {UpdateFunction} [update] - A function called on game tick if the module is enabled
 * @property {Function} [destroy] - A function called when the module should be destroyed
 */

/**
 * This type represents a generic class constructor.
 * @typedef {Function} ModuleClass - The class constructor
 * @property {string} name - The name of the class
 * @property {AttributeDefinition} attributes - The attribute definitions for the class
 */

/**
 * @typedef {Object|Map} AttributeDefinition
 * @property {'asset'|'boolean'|'curve'|'entity'|'json'|'number'|'rgb'|'rgba'|'string'|'vec2'|'vec3'|'vec4'} type - The attribute type
 */


const appEntityDefinition = {
    app: { type: 'app' },
    entity: { type: 'entity' }
};

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
     * @param {import('./../../../framework/entity.js').Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        this.initialized = false;

        /**
         * Object shorthand passed to scripts update and postUpdate
         */
        this.appEntity = { app: system.app, entity: entity };

        /**
         * Holds all ESM instances of this component.
         * @type {Set<ModuleInstance>}
         */
        this.modules = new Set();

        /**
         * Holds a map of modules class names to instances to enable shorthand lookup
         * @type {Map<string, ModuleInstance>}
         */
        this.moduleNameInstanceMap = new Map();

        /**
         * Holds the attribute definitions for modules.
         * @type {Map<ModuleInstance, AttributeDefinition>}
         */
        this.attributeDefinitions = new Map();

        // Holds all modules with an `update` method
        this.modulesWithUpdate = new Set();

        // Holds all modules with a `postUpdate` method
        this.modulesWithPostUpdate = new Set();

        // Contains all the enabled modules.
        this.enabledModules = new Set();

        // Contains all the uninitialized modules.
        this.uninitializedModules = new Set();

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

    set enabled(value) {
        this._enabled = value;
        if (this.isActive) this.flushUninitializedModules();
    }

    get enabled() {
        return !!this._enabled;
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
            if (this.uninitializedModules.has(module)) continue;
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
            if (this.enabledModules.has(module)) continue;
            if (this.uninitializedModules.has(module)) continue;
            module.inactive?.();
        }
    }

    flushUninitializedModules() {
        for (const module of this.uninitializedModules) {
            if (!this.isActive) break;
            if (!this.isModuleEnabled(module) && !this.awaitingToBeEnabledModules.has(module)) continue;
            module.initialize();
            this.uninitializedModules.delete(module);
        }
    }

    onEnable() {
        if (this.isActive) this.flushUninitializedModules();
    }

    _onInitialize() {
        if (!this.initialized) this.flushUninitializedModules();
        this.initialized = true;
    }

    _onPostInitialize() {
        for (const module of this.modules) {
            if (!this.isActive) break;
            if (!this.enabledModules.has(module)) module.postInitialize?.();
        }
    }

    _onUpdate(dt) {
        for (const module of this.modulesWithUpdate) {
            if (!this.isActive) break;
            module.update(dt);
        }
    }

    _onPostUpdate(dt) {
        for (const module of this.modulesWithPostUpdate) {
            if (!this.isActive) break;
            module.postUpdate(dt);
        }
    }

    /**
     * Disables a module and prevents it receiving lifecycle events
     * @param {ModuleInstance} module - The module to disable
     */
    disableModule(module) {

        if (!this.modules.has(module)) {
            Debug.error(`The ESM Script '${module?.constructor?.name}' has not been added to this component.`);
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
            Debug.error(`The ESM Script '${module?.constructor?.name}' has not been added to this component.`);
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
     * @internal
     * @todo
     * When an entity is cloned and it has entity script attributes that point to other entities in
     * the same subtree that are also cloned, then we want the new script attributes to point at the
     * cloned entities. This method remaps the script attributes for this entity and it assumes
     * that this entity is the result of the clone operation.
     *
     * @param {EsmScriptComponent} oldScriptComponent - The source script component that belongs to
     * the entity that was being cloned.
     * @param {object} duplicatedIdsMap - A dictionary with guid-entity values that contains the
     * entities that were cloned.
     */
    resolveDuplicatedEntityReferenceProperties(oldScriptComponent, duplicatedIdsMap) {

        // for each module in the old component
        for (const esmscript of oldScriptComponent.modules) {

            // Get the attribute definition for the specified esm script
            const attributeDefinitions = oldScriptComponent.attributeDefinitions.get(esmscript);
            const newModule = this.moduleNameInstanceMap.get(esmscript.constructor.name);

            // for each attribute definition
            forEachAttributeDefinition(attributeDefinitions, (def, path) => {

                // If the attribute is an entity
                if (def.type === 'entity') {

                    // Get the value of the attribute
                    const entity = getValueAtPath(esmscript, path);
                    if (!entity) return;

                    // Get the guid of the entity
                    const guid = entity.getGuid();

                    // If the guid is in the duplicatedIdsMap, then we need to update the value
                    if (guid && duplicatedIdsMap[guid]) {
                        setValueAtPath(newModule, path, duplicatedIdsMap[guid]);
                    }
                }
            });
        }
    }

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
            Debug.warn(`The ESM Script '${module.constructor?.name}' has not been added to this component`);
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
     * @param {ModuleClass} ModuleClass - The ESM Script class to add to the component
     * @param {Object.<string, AttributeDefinition>} [attributeValues] - A set of attributes to be assigned to the Script Module instance
     * @param {boolean} [enabled] - Whether the script is enabled or not.
     * @returns {ModuleInstance|null} An instance of the module
     */
    add(ModuleClass, attributeValues = {}, enabled = true) {

        if (!ModuleClass || typeof ModuleClass !== 'function')
            throw new Error(`The ESM Script is undefined`);

        if (!ModuleClass.name || ModuleClass.name === '')
            throw new Error('Anonymous classes are not supported. Use `class MyClass{}` instead of `const MyClass = class{}`');

        if (this.moduleNameInstanceMap.has(ModuleClass.name))
            throw new Error(`An ESM Script called '${ModuleClass.name}' has already been added to this component.`);

        // @ts-ignore
        const attributeDefinition = ModuleClass.attributes || {};

        // @ts-ignore
        // Create the esm script instance
        const module = new ModuleClass();

        // Create an attribute definition and values with { app, entity }
        const attributeDefinitionWithAppEntity = { ...attributeDefinition, ...appEntityDefinition };
        const attributeValueWithAppEntity = { ...attributeValues, ...this.appEntity };

        // Assign any provided attributes
        populateWithAttributes(
            this.system.app,
            attributeDefinitionWithAppEntity,
            attributeValueWithAppEntity,
            module);

        this.modules.add(module);
        this.moduleNameInstanceMap.set(ModuleClass.name, module);
        this.attributeDefinitions.set(module, attributeDefinition);

        // If the class has an initialize method ...
        if (classHasMethod(ModuleClass, 'initialize')) {

            // If the component and hierarchy are currently active, initialize now.
            if (this.isActive && enabled) module.initialize();

            // otherwise mark to initialize later
            else this.uninitializedModules.add(module);
        }

        // Enable the module, so that it receives lifecycle hooks
        if (enabled) this.enableModule(module);

        this.fire('create', module);

        return module;
    }
}

export { EsmScriptComponent };
