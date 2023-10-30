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

        this.modules = new Map();
        this.moduleAttributes = new Map();

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
     * entity.script.on('state', function (enabled) {
     *     // component changed state
     * });
     */

    /**
     * Fired when Component is removed from entity.
     *
     * @event ScriptESMComponent#remove
     * @example
     * entity.script.on('remove', function () {
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
     * entity.script.on('create', function (name, scriptInstance) {
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
     * entity.script.on('create:playerController', function (scriptInstance) {
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
     * entity.script.on('destroy', function (name, scriptInstance) {
     *     // script instance has been destroyed and removed from component
     * });
     */

    /**
     * Fired when a script instance is destroyed and removed from component.
     *
     * @event ScriptESMComponent#destroy:[name]
     * @param {import('../../script/script-type.js').ScriptType} scriptInstance - The instance of
     * the {@link ScriptType} that has been destroyed.
     * @example
     * entity.script.on('destroy:playerController', function (scriptInstance) {
     *     // script instance 'playerController' has been destroyed and removed from component
     * });
     */

    /**
     * Fired when a script instance had an exception.
     *
     * @event ScriptESMComponent#error
     * @param {import('../../script/script-type.js').ScriptType} scriptInstance - The instance of
     * the {@link ScriptType} that raised the exception.
     * @param {Error} err - Native JS Error object with details of an error.
     * @param {string} method - The method of the script instance that the exception originated from.
     * @example
     * entity.script.on('error', function (scriptInstance, err, method) {
     *     // script instance caught an exception
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
        this.modules.forEach(({ moduleInstance }) => {
            moduleInstance.update?.(dt);
        });
    }

    _onPostUpdate(dt) {
        this.modules.forEach(({ moduleInstance }) => {
            moduleInstance.postUpdate?.(dt);
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
    create(moduleSpecifier, args) {

        const { attributes: definedAttributes } = args;

        // eslint-disable-next-line multiline-comment-style
        /* #if _ASSET_BASE_URL
        const finalUrl = $_ASSET_BASE_URL + this.system.app.assets.prefix +  moduleSpecifier;
        // #else */
        const finalUrl = moduleSpecifier;
        // #endif

        pcImport(this.system.app, finalUrl).then(({ default: ModuleClass, attributes }) => {

            this.addModule(moduleSpecifier, ModuleClass, attributes, definedAttributes);

        }).catch(Debug.error);

    }

    addModule(moduleSpecifier, ModuleClass, attributes = {}, definedAttributes) {

        if (!ModuleClass)
            throw new Error(`Please check your exports. The module '${moduleSpecifier}' does not contain a default export`);

        if (typeof ModuleClass !== 'function')
            throw new Error(`The module '${moduleSpecifier}' does not export a class or a function`);

        if (!attributes) Debug.warn(`The module '${moduleSpecifier}' does not export any attributes`);

        const moduleInstance = new ModuleClass(this.entity, attributes);

        // Assign attributes to module instance
        Object.entries(attributes).forEach(([attributeName, { value }]) => {
            moduleInstance[attributeName] = definedAttributes[attributeName];
        });

        // Retrieve any previous instance associated with the module specifier
        const previousModuleInstance = this.modules.get(moduleSpecifier)?.moduleInstance;
        const isHMREnabled = moduleInstance.swap && typeof moduleInstance.swap === 'function';

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
            moduleInstance.initialize(definedAttributes);
        }

        this.system.app.assets.once(`load:url:${this.system.app.assets.prefix + moduleSpecifier}`, (asset) => {
            const NewModuleClass = asset.resource;
            this.addModule(moduleSpecifier, NewModuleClass, attributes);
        });

        this.modules.set(moduleSpecifier, { ModuleClass, attributes, moduleInstance });

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
            module.destroy();
            this.modules.delete(moduleSpecifier);
            return true;
        }

        return false;
    }
}

export { ScriptESMComponent };
