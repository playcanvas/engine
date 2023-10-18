import { Debug } from '../../../core/debug.js';
import { SortedLoopArray } from '../../../core/sorted-loop-array.js';

import { ScriptAttributes } from '../../script/script-attributes.js';

import { Component } from '../component.js';
import { Entity } from '../../entity.js';

/**
 * The ScriptComponent allows you to extend the functionality of an Entity by attaching your own
 * Script Types defined in JavaScript files to be executed with access to the Entity. For more
 * details on scripting see [Scripting](https://developer.playcanvas.com/user-manual/scripting/).
 *
 * @augments Component
 */
class ESModuleComponent extends Component {
    /**
     * Create a new ScriptComponent instance.
     *
     * @param {import('./system.js').ScriptComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        this.modules = new Map();
        this.moduleAttributes = new Map();

        /**
         * Holds all script instances for this component.
         *
         * @type {import('../../script/script-type.js').ScriptType[]}
         * @private
         */
        this._scripts = [];
        // holds all script instances with an update method
        this._updateList = new SortedLoopArray({ sortBy: '__executionOrder' });
        // holds all script instances with a postUpdate method
        this._postUpdateList = new SortedLoopArray({ sortBy: '__executionOrder' });

        this._scriptsIndex = {};
        this._destroyedScripts = [];
        this._destroyed = false;
        this._scriptsData = null;
        this._oldState = true;

        // override default 'enabled' property of base pc.Component
        // because this is faster
        this._enabled = true;

        // whether this component is currently being enabled
        this._beingEnabled = false;
        // if true then we are currently looping through
        // script instances. This is used to prevent a scripts array
        // from being modified while a loop is being executed
        this._isLoopingThroughScripts = false;

        // the order that this component will be updated
        // by the script system. This is set by the system itself.
        this._executionOrder = -1;

        this.on('set_enabled', this._onSetEnabled, this);
    }

    /**
     * Fired when Component becomes enabled. Note: this event does not take in account entity or
     * any of its parent enabled state.
     *
     * @event ScriptComponent#enable
     * @example
     * entity.script.on('enable', function () {
     *     // component is enabled
     * });
     */

    /**
     * Fired when Component becomes disabled. Note: this event does not take in account entity or
     * any of its parent enabled state.
     *
     * @event ScriptComponent#disable
     * @example
     * entity.script.on('disable', function () {
     *     // component is disabled
     * });
     */

    /**
     * Fired when Component changes state to enabled or disabled. Note: this event does not take in
     * account entity or any of its parent enabled state.
     *
     * @event ScriptComponent#state
     * @param {boolean} enabled - True if now enabled, False if disabled.
     * @example
     * entity.script.on('state', function (enabled) {
     *     // component changed state
     * });
     */

    /**
     * Fired when Component is removed from entity.
     *
     * @event ScriptComponent#remove
     * @example
     * entity.script.on('remove', function () {
     *     // entity has no more script component
     * });
     */

    /**
     * Fired when a script instance is created and attached to component.
     *
     * @event ScriptComponent#create
     * @param {string} name - The name of the Script Type.
     * @param {import('../../script/script-type.js').ScriptType} scriptInstance - The instance of
     * the {@link ScriptType} that has been created.
     * @example
     * entity.script.on('create', function (name, scriptInstance) {
     *     // new script instance added to component
     * });
     */

    /**
     * Fired when a script instance is created and attached to component.
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
     * @event ScriptComponent#destroy
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
     * @event ScriptComponent#destroy:[name]
     * @param {import('../../script/script-type.js').ScriptType} scriptInstance - The instance of
     * the {@link ScriptType} that has been destroyed.
     * @example
     * entity.script.on('destroy:playerController', function (scriptInstance) {
     *     // script instance 'playerController' has been destroyed and removed from component
     * });
     */

    /**
     * Fired when a script instance is moved in component.
     *
     * @event ScriptComponent#move
     * @param {string} name - The name of the Script Type.
     * @param {import('../../script/script-type.js').ScriptType} scriptInstance - The instance of
     * the {@link ScriptType} that has been moved.
     * @param {number} ind - New position index.
     * @param {number} indOld - Old position index.
     * @example
     * entity.script.on('move', function (name, scriptInstance, ind, indOld) {
     *     // script instance has been moved in component
     * });
     */

    /**
     * Fired when a script instance is moved in component.
     *
     * @event ScriptComponent#move:[name]
     * @param {import('../../script/script-type.js').ScriptType} scriptInstance - The instance of
     * the {@link ScriptType} that has been moved.
     * @param {number} ind - New position index.
     * @param {number} indOld - Old position index.
     * @example
     * entity.script.on('move:playerController', function (scriptInstance, ind, indOld) {
     *     // script instance 'playerController' has been moved in component
     * });
     */

    /**
     * Fired when a script instance had an exception.
     *
     * @event ScriptComponent#error
     * @param {import('../../script/script-type.js').ScriptType} scriptInstance - The instance of
     * the {@link ScriptType} that raised the exception.
     * @param {Error} err - Native JS Error object with details of an error.
     * @param {string} method - The method of the script instance that the exception originated from.
     * @example
     * entity.script.on('error', function (scriptInstance, err, method) {
     *     // script instance caught an exception
     * });
     */

    set enabled(value) {
        const oldValue = this._enabled;
        this._enabled = value;
        this.fire('set', 'enabled', oldValue, value);
    }

    get enabled() {
        return this._enabled;
    }

    onEnable() {
        this._beingEnabled = true;
        this._checkState();

        if (!this.entity._beingEnabled) {
            this.onPostStateChange();
        }

        this._beingEnabled = false;
    }

    onDisable() {
        this._checkState();
    }

    onPostStateChange() {
        // const wasLooping = this._beginLooping();

        // for (let i = 0, len = this.scripts.length; i < len; i++) {
        //     const script = this.scripts[i];

        //     if (script._initialized && !script._postInitialized && script.enabled) {
        //         script._postInitialized = true;

        //         if (script.postInitialize)
        //             this._scriptMethod(script, SCRIPT_POST_INITIALIZE);
        //     }
        // }

        // this._endLooping(wasLooping);
    }

    // We also need this handler because it is fired
    // when value === old instead of onEnable and onDisable
    // which are only fired when value !== old
    _onSetEnabled(prop, old, value) {
        // this._beingEnabled = true;
        // this._checkState();
        // this._beingEnabled = false;
    }

    _checkState() {
        // const state = this.enabled && this.entity.enabled;
        // if (state === this._oldState)
        //     return;

        // this._oldState = state;

        // this.fire(state ? 'enable' : 'disable');
        // this.fire('state', state);

        // if (state) {
        //     this.system._addComponentToEnabled(this);
        // } else {
        //     this.system._removeComponentFromEnabled(this);
        // }

        // const wasLooping = this._beginLooping();

        // for (let i = 0, len = this.scripts.length; i < len; i++) {
        //     const script = this.scripts[i];
        //     script.enabled = script._enabled;
        // }

        // this._endLooping(wasLooping);
    }

    _onBeforeRemove() {
        this.fire('remove');

        // const wasLooping = this._beginLooping();

        // // destroy all scripts
        // for (let i = 0; i < this.scripts.length; i++) {
        //     const script = this.scripts[i];
        //     if (!script) continue;

        //     this.destroy(script.__scriptType.__name);
        // }

        // this._endLooping(wasLooping);
    }

    _removeDestroyedScripts() {
        // const len = this._destroyedScripts.length;
        // if (!len) return;

        // for (let i = 0; i < len; i++) {
        //     const script = this._destroyedScripts[i];
        //     this._removeScriptInstance(script);
        // }

        // this._destroyedScripts.length = 0;

        // // update execution order for scripts
        // this._resetExecutionOrder(0, this._scripts.length);
    }

    _onInitializeAttributes() {
        // for (let i = 0, len = this.scripts.length; i < len; i++)
        //     this.scripts[i].__initializeAttributes();
    }


    _onInitialize() {
        console.log('onInit')
        // const scripts = this._scripts;

        // const wasLooping = this._beginLooping();

        // for (let i = 0, len = scripts.length; i < len; i++) {
        //     const script = scripts[i];
        //     if (!script._initialized && script.enabled) {
        //         script._initialized = true;
        //         if (script.initialize)
        //             this._scriptMethod(script, SCRIPT_INITIALIZE);
        //     }
        // }

        // this._endLooping(wasLooping);
    }

    _onPostInitialize() {
        // this.onPostStateChange();
    }

    _onUpdate(dt) {
        this.modules.forEach((module) => {
            module.update(dt);
        });
    }

    _onPostUpdate(dt) {
        // Is this needed?
    }

    _resolveEntityScriptAttribute(attribute, attributeName, oldValue, useGuid, newAttributes, duplicatedIdsMap) {
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

            newAttributes[attributeName] = newGuidArray;
        } else {
            // handle regular entity attribute
            if (oldValue instanceof Entity) {
                oldValue = oldValue.getGuid();
            } else if (typeof oldValue !== 'string') {
                return;
            }

            if (duplicatedIdsMap[oldValue]) {
                newAttributes[attributeName] = duplicatedIdsMap[oldValue];
            }
        }
    }

    /**
     * Detect if script is attached to an entity.
     *
     * @param {string} moduleSpecifier - The
     * name or type of {@link ScriptType}.
     * @returns {boolean} If script is attached to an entity.
     * @example
     * if (entity.module.has('module')) {
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
     * @param {string} moduleSpecifier - The
     * name or type of {@link ScriptType}.
     * @param {object} [args] - Object with arguments for a script.
     * @param {boolean} [args.enabled] - If script instance is enabled after creation. Defaults to
     * true.
     * @param {object} [args.attributes] - Object with values for attributes (if any), where key is
     * name of an attribute.
     * @param {boolean} [args.preloading] - If script instance is created during preload. If true,
     * script and attributes must be initialized manually. Defaults to false.
     * @param {number} [args.ind] - The index where to insert the script instance at. Defaults to
     * -1, which means append it at the end.
     * @returns {import('../../script/script-type.js').ScriptType|null} Returns an instance of a
     * {@link ScriptType} if successfully attached to an entity, or null if it failed because a
     * script with a same name has already been added or if the {@link ScriptType} cannot be found
     * by name in the {@link ScriptRegistry}.
     * @example
     * entity.script.create('moduleSpecifier', {
     *     attributes: {
     *         speed: 4
     *     }
     * });
     */
    create(moduleSpecifier, args = {}) {

        if (this.modules.has(moduleSpecifier)) {
            Debug.warn(`Module '${moduleSpecifier}' is already added to entity '${this.entity.name}'`);

            const module = this.modules.get(moduleSpecifier);
            module.destroy();
        }

        // TODO: Remove window ref
        import(window.location.origin + moduleSpecifier).then((Module) => {

            const { default: EsModuleClass, attributes} = Module;

            if (!EsModuleClass) throw new Error(`Please check your exports. The module '${moduleSpecifier}' does not export a default object`)
            if (typeof EsModuleClass !== 'function') throw new Error(`The module '${moduleSpecifier}' does not export a class or a function`)

            if (!attributes) Debug.warn(`The module '${moduleSpecifier}' does not export any attributes`);
            const module = new EsModuleClass(this.entity, args.attributes);

            this.modules.set(moduleSpecifier, module);
            this.moduleAttributes.set(moduleSpecifier, args.attributes);

            this.fire('create', moduleSpecifier, module);
            this.fire('create:' + moduleSpecifier, module);

            return module;

        }).catch(() => {
            Debug.error(`module '${moduleSpecifier}' does not exist`);
            return null;
        });

    }

    /**
     * Destroy the script instance that is attached to an entity.
     *
     * @param {string|Class<import('../../script/script-type.js').ScriptType>} nameOrType - The
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
        }

    }

    /**
     * Move script instance to different position to alter update order of scripts within entity.
     *
     * @param {string|Class<import('../../script/script-type.js').ScriptType>} nameOrType - The
     * name or type of {@link ScriptType}.
     * @param {number} ind - New position index.
     * @returns {boolean} If it was successfully moved.
     * @example
     * entity.script.move('playerController', 0);
     */
    move(nameOrType, ind) {
        const len = this._scripts.length;
        if (ind >= len || ind < 0)
            return false;

        let scriptType = nameOrType;
        let scriptName = nameOrType;

        if (typeof scriptName !== 'string') {
            scriptName = nameOrType.__name;
        } else {
            scriptType = null;
        }

        const scriptData = this._scriptsIndex[scriptName];
        if (!scriptData || !scriptData.instance)
            return false;

        // if script type specified, make sure instance of said type
        const scriptInstance = scriptData.instance;
        if (scriptType && !(scriptInstance instanceof scriptType))
            return false;

        const indOld = this._scripts.indexOf(scriptInstance);
        if (indOld === -1 || indOld === ind)
            return false;

        // move script to another position
        this._scripts.splice(ind, 0, this._scripts.splice(indOld, 1)[0]);

        // reset execution order for scripts and re-sort update and postUpdate lists
        this._resetExecutionOrder(0, len);
        this._updateList.sort();
        this._postUpdateList.sort();

        this.fire('move', scriptName, scriptInstance, ind, indOld);
        this.fire('move:' + scriptName, scriptInstance, ind, indOld);

        return true;
    }
}

export { ESModuleComponent };
