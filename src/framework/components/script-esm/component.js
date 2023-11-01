import { pcImport } from '../../handlers/script-esm.js';
import { Debug } from '../../../core/debug.js';
import { Component } from '../component.js';

/**
 * The ScriptESMComponent allows you to extend the functionality of an Entity by attaching your own
 * ESM modules to the Entity.
 *
 * @augments Component
 */
class ScriptESMComponent extends Component {
    /**
     * Create a new ScriptESMComponent instance.
     *
     * @param {import('./system.js').ScriptESMComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        /**
         * Holds all module instances for this component.
         * @private
         */

        this.allModules = new Map();
        this.modulesWithUpdate = new Map();
        this.modulesWithPostUpdate = new Map();
    }

    /**
     * Fired when Component becomes enabled. Note: this event does not take in account entity or
     * any of its parent enabled state.
     *
     * @event ScriptESMComponent#enable
     * @example
     * entity.script.on('enable', function () {
     *     // component is enabled
     * });
     */

    /**
     * Fired when Component becomes disabled. Note: this event does not take in account entity or
     * any of its parent enabled state.
     *
     * @event ScriptESMComponent#disable
     * @example
     * entity.script.on('disable', function () {
     *     // component is disabled
     * });
     */

    /**
     * Fired when Component changes state to enabled or disabled. Note: this event does not take in
     * account entity or any of its parent enabled state.
     *
     * @event ScriptESMComponent#state
     * @param {boolean} enabled - True if now enabled, False if disabled.
     * @example
     * entity.esmodule.on('state', function (enabled) {
     *     // component changed state
     * });
     */

    /**
     * Fired when Component is removed from entity.
     *
     * @event ScriptESMComponent#remove
     * @example
     * entity.esmodule.on('remove', function () {
     *     // entity has no more script component
     * });
     */

    /**
     * Fired when an esm script instance is created and attached to component.
     *
     * @event ScriptESMComponent#create
     * @param {string} name - The name of the Script Type.
     * @param {import('../../script/script-type.js').ScriptType} scriptInstance - The instance of
     * the {@link ScriptType} that has been created.
     * @example
     * entity.esmodule.on('create', function (name, scriptInstance) {
     *     // new script instance added to component
     * });
     */

    /**
     * Fired when an esm script instance is created and attached to component.
     *
     * @event ScriptComponent#create:[name]
     * @param {import('../../script/script-type.js').ScriptType} scriptInstance - The instance of
     * the {@link ScriptType} that has been created.
     * @example
     * entity.esmodule.on('create:playerController', function (scriptInstance) {
     *     // new script instance 'playerController' is added to component
     * });
     */

    /**
     * Fired when a script instance is destroyed and removed from component.
     *
     * @event ScriptESMComponent#destroy
     * @param {string} name - The name of the Script Type.
     * @param {import('../../script/script-type.js').ScriptType} scriptInstance - The instance of
     * the {@link ScriptType} that has been destroyed.
     * @example
     * entity.esmodule.on('destroy', function (name, scriptInstance) {
     *     // script instance has been destroyed and removed from component
     * });
     */

    /**
     * Fired when a script instance is destroyed and removed from component.
     *
     * @event ScriptESMComponent#destroy:[name]
     * @param {import('../../script/script-type.js').ScriptType} Script ESM Module instance - The instance of
     * the {@link ScriptType} that has been destroyed.
     * @example
     * entity.script.on('destroy:playerController', function (scriptInstance) {
     *     // script instance 'playerController' has been destroyed and removed from component
     * });
     */

    _onBeforeRemove() {
        this.allModules.forEach(({ moduleInstance }) => {
            this.destroy(moduleInstance);
        });
    }

    _onInitialize() {
        this.allModules.forEach(({ moduleInstance }) => {
            moduleInstance.initialize?.();
        });
    }

    _onPostInitialize() {
        this.allModules.forEach(({ moduleInstance }) => {
            moduleInstance.postInitialize?.();
        });
    }

    _onUpdate(dt) {
        this.modulesWithUpdate.forEach(({ moduleInstance }) => {
            moduleInstance.update(dt);
        });
    }

    _onPostUpdate(dt) {
        this.modulesWithPostUpdate.forEach(({ moduleInstance }) => {
            moduleInstance.postUpdate(dt);
        });
    }

    /**
     * When an entity is cloned and it has entity script attributes that point to other entities in
     * the same subtree that is cloned, then we want the new script attributes to point at the
     * cloned entities. This method remaps the script attributes for this entity and it assumes
     * that this entity is the result of the clone operation.
     *
     * @param {ScriptESMComponent} oldScriptComponent - The source script component that belongs to
     * the entity that was being cloned.
     * @param {object} duplicatedIdsMap - A dictionary with guid-entity values that contains the
     * entities that were cloned.
     * @private
     */
    resolveDuplicatedEntityReferenceProperties(oldScriptComponent, duplicatedIdsMap) {

        // TODO - run over old script component, any entities found, re-point them
    }

    /**
     * Move module instance to different position which changes the execution order of scripts.
     * 
     * @param {string} moduleSpecifier - The specifier of the module to move.
     * @param {number} ind - New position index.
     * @returns {boolean} If it was successfully moved.
     * @example
     * entity.script.move('playerController', 0);
     */
    move(moduleSpecifier, ind) {

        const moduleToMove = this.allModules.get(moduleSpecifier);

        // Ensure params are valid
        if (!moduleToMove || ind < 0 || ind > this.allModules.size) return false;

        const keys = [...this.allModules.keys()];
        const entries = [...this.allModules.entries()];

        // Linear search - faster than findIndex
        const i = keys.indexOf(moduleSpecifier);

        // Remove the module from its current position
        entries.splice(i, 1);

        // Insert the module at the new position
        entries.splice(ind, 0, [moduleSpecifier, moduleToMove]);

        // reset the data
        this.allModules.clear();
        for (const [key, value] of entries) {
            this.allModules.set(key, value);
        }

        return true;
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
        return this.allModules.has(moduleSpecifier);
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
        return this.allModules.get(moduleSpecifier);
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
    create(moduleSpecifier, args) {

        // eslint-disable-next-line multiline-comment-style
        /* #if _ASSET_BASE_URL
        const finalUrl = $_ASSET_BASE_URL + this.system.app.assets.prefix +  moduleSpecifier;
        // #else */
        const finalUrl = moduleSpecifier;
        // #endif

        pcImport(this.system.app, finalUrl).then(({ default: ModuleClass, attributes: attributeDefinition }) => {

            this.addModule(moduleSpecifier, ModuleClass, attributeDefinition, args.attributes);

        }).catch(Debug.error);

    }

    addModule(moduleSpecifier, ModuleClass, attributeDefinition = {}, attributes = {}) {

        if (!ModuleClass)
            throw new Error(`The module '${moduleSpecifier}' does not export a default`);

        if (typeof ModuleClass !== 'function')
            throw new Error(`The module '${moduleSpecifier}' does not export a class or a function`);

        const moduleInstance = new ModuleClass(this.system.app, this.entity);

        // Iterate over the attribute definitions and assign them if they exist on the attributes
        Object.keys(attributeDefinition).forEach((attributeName) => {
            if (Object.hasOwn(attributes, attributeName)) {
                moduleInstance[attributeName] = attributes[attributeName];
            }
        });

        // Retrieve any previous instance associated with the module specifier
        const previousModuleInstance = this.allModules.get(moduleSpecifier)?.moduleInstance;
        const isHMREnabled = moduleInstance.swap && typeof moduleInstance.swap === 'function';

        // Add Modules to relevant update/post-update lists
        if ('update' in ModuleClass) this.modulesWithUpdate.add(moduleSpecifier);
        if ('postUpdate' in ModuleClass) this.modulesWithPostUpdate.add(moduleSpecifier);

        this.fire('create', moduleSpecifier, moduleInstance);
        this.fire('create:' + moduleSpecifier, moduleInstance);

        // Check if an existing module exists, ie. if this is a candidate to swap
        if (previousModuleInstance) {

            // Copy intrinsic state
            moduleInstance.enabled = previousModuleInstance.enabled;

            // Copy explicit state
            if (isHMREnabled)
                moduleInstance.swap(previousModuleInstance);

        } else if (moduleInstance.enabled || !Object.hasOwn(moduleInstance, 'enabled')) {
            moduleInstance.initialize();
        }

        // Listen for any subsequent load events
        this.system.app.assets.once(`load:url:${this.system.app.assets.prefix + moduleSpecifier}`, (asset) => {

            const NewModuleClass = asset.resource;

            // Only upgrade the module if the class or super class contains a swap
            if ('swap' in NewModuleClass) {
                this.addModule(moduleSpecifier, NewModuleClass, attributes);
            } else {
                Debug.warn(
                    `The Script Module '${NewModuleClass}' does not have a 'swap' method, and is ineligible for swapping. Please reload.`
                );
            }
        });

        this.allModules.set(moduleSpecifier, { ModuleClass, attributes, moduleInstance });

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

        const module = this.allModules.get(moduleSpecifier);

        if (module) {

            // Remove from local data
            this.allModules.delete(moduleSpecifier);
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

export { ScriptESMComponent };
