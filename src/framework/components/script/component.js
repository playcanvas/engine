import { Debug } from '../../../core/debug.js';
import { SortedLoopArray } from '../../../core/sorted-loop-array.js';

import { ScriptAttributes, assignAttributesToScript } from '../../script/script-attributes.js';
import {
    SCRIPT_INITIALIZE, SCRIPT_POST_INITIALIZE, SCRIPT_UPDATE,
    SCRIPT_POST_UPDATE, SCRIPT_SWAP
} from '../../script/constants.js';

import { Component } from '../component.js';
import { Entity } from '../../entity.js';
import { ScriptType } from '../../script/script-type.js';
import { getScriptName } from '../../script/script.js';

const toLowerCamelCase = str => str[0].toLowerCase() + str.substring(1);

/**
 * The ScriptComponent allows you to extend the functionality of an Entity by attaching your own
 * Script Types defined in JavaScript files to be executed with access to the Entity. For more
 * details on scripting see [Scripting](https://developer.playcanvas.com/user-manual/scripting/).
 *
 * @category Script
 */
class ScriptComponent extends Component {
    /**
     * A map of script name to initial component data.
     *
     * @type {Map<string, object>}
     * @private
     */
    _attributeDataMap = new Map();

    /**
     * Fired when a {@link ScriptType} instance is created and attached to the script component.
     * This event is available in two forms. They are as follows:
     *
     * 1. `create` - Fired when a script instance is created. The name of the script type and the
     * script type instance are passed as arguments.
     * 2. `create:[name]` - Fired when a script instance is created that has the specified script
     * type name. The script instance is passed as an argument to the handler.
     *
     * @event
     * @example
     * entity.script.on('create', (name, scriptInstance) => {
     *     console.log(`Instance of script '${name}' created`);
     * });
     * @example
     * entity.script.on('create:player', (scriptInstance) => {
     *     console.log(`Instance of script 'player' created`);
     * });
     */
    static EVENT_CREATE = 'create';

    /**
     * Fired when a {@link ScriptType} instance is destroyed and removed from the script component.
     * This event is available in two forms. They are as follows:
     *
     * 1. `destroy` - Fired when a script instance is destroyed. The name of the script type and
     * the script type instance are passed as arguments.
     * 2. `destroy:[name]` - Fired when a script instance is destroyed that has the specified
     * script type name. The script instance is passed as an argument.
     *
     * @event
     * @example
     * entity.script.on('destroy', (name, scriptInstance) => {
     *     console.log(`Instance of script '${name}' destroyed`);
     * });
     * @example
     * entity.script.on('destroy:player', (scriptInstance) => {
     *     console.log(`Instance of script 'player' destroyed`);
     * });
     */
    static EVENT_DESTROY = 'destroy';

    /**
     * Fired when the script component becomes enabled. This event does not take into account the
     * enabled state of the entity or any of its ancestors.
     *
     * @event
     * @example
     * entity.script.on('enable', () => {
     *     console.log(`Script component of entity '${entity.name}' has been enabled`);
     * });
     */
    static EVENT_ENABLE = 'enable';

    /**
     * Fired when the script component becomes disabled. This event does not take into account the
     * enabled state of the entity or any of its ancestors.
     *
     * @event
     * @example
     * entity.script.on('disable', () => {
     *     console.log(`Script component of entity '${entity.name}' has been disabled`);
     * });
     */
    static EVENT_DISABLE = 'disable';

    /**
     * Fired when the script component has been removed from its entity.
     *
     * @event
     * @example
     * entity.script.on('remove', () => {
     *     console.log(`Script component removed from entity '${entity.name}'`);
     * });
     */
    static EVENT_REMOVE = 'remove';

    /**
     * Fired when the script component changes state to enabled or disabled. The handler is passed
     * the new boolean enabled state of the script component. This event does not take into account
     * the enabled state of the entity or any of its ancestors.
     *
     * @event
     * @example
     * entity.script.on('state', (enabled) => {
     *     console.log(`Script component of entity '${entity.name}' changed state to '${enabled}'`);
     * });
     */
    static EVENT_STATE = 'state';

    /**
     * Fired when the index of a {@link ScriptType} instance is changed in the script component.
     * This event is available in two forms. They are as follows:
     *
     * 1. `move` - Fired when a script instance is moved. The name of the script type, the script
     * type instance, the new index and the old index are passed as arguments.
     * 2. `move:[name]` - Fired when a specifically named script instance is moved. The script
     * instance, the new index and the old index are passed as arguments.
     *
     * @event
     * @example
     * entity.script.on('move', (name, scriptInstance, newIndex, oldIndex) => {
     *     console.log(`Script '${name}' moved from index '${oldIndex}' to '${newIndex}'`);
     * });
     * @example
     * entity.script.on('move:player', (scriptInstance, newIndex, oldIndex) => {
     *     console.log(`Script 'player' moved from index '${oldIndex}' to '${newIndex}'`);
     * });
     */
    static EVENT_MOVE = 'move';

    /**
     * Fired when a {@link ScriptType} instance had an exception. The handler is passed the script
     * instance, the exception and the method name that the exception originated from.
     *
     * @event
     * @example
     * entity.script.on('error', (scriptInstance, exception, methodName) => {
     *     console.log(`Script error: ${exception} in method '${methodName}'`);
     * });
     */
    static EVENT_ERROR = 'error';

    /**
     * Create a new ScriptComponent instance.
     *
     * @param {import('./system.js').ScriptComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) {
        super(system, entity);

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
     * Sets the array of all script instances attached to an entity. This array is read-only and
     * should not be modified by developer.
     *
     * @type {import('../../script/script.js').Script[]}
     */
    set scripts(value) {
        this._scriptsData = value;

        for (const key in value) {
            if (!value.hasOwnProperty(key))
                continue;

            const script = this._scriptsIndex[key];
            if (script) {
                // existing script

                // enabled
                if (typeof value[key].enabled === 'boolean') {

                    // Before a script is initialized, initialize any attributes
                    script.once('preInitialize', () => {
                        this.initializeAttributes(script);
                    });
                    script.enabled = !!value[key].enabled;
                }

                // attributes
                if (typeof value[key].attributes === 'object') {
                    for (const attr in value[key].attributes) {
                        if (ScriptAttributes.reservedNames.has(attr))
                            continue;

                        if (!script.__attributes.hasOwnProperty(attr)) {
                            // new attribute
                            const scriptType = this.system.app.scripts.get(key);
                            if (scriptType)
                                scriptType.attributes.add(attr, { });
                        }

                        // update attribute
                        script[attr] = value[key].attributes[attr];
                    }
                }
            } else {
                // TODO scripts2
                // new script
                console.log(this.order);
            }
        }
    }

    /**
     * Gets the array of all script instances attached to an entity.
     *
     * @type {import('../../script/script-type.js').ScriptType[]}
     */
    get scripts() {
        return this._scripts;
    }

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
        const wasLooping = this._beginLooping();

        for (let i = 0, len = this.scripts.length; i < len; i++) {
            const script = this.scripts[i];

            if (script._initialized && !script._postInitialized && script.enabled) {
                script._postInitialized = true;

                if (script.postInitialize)
                    this._scriptMethod(script, SCRIPT_POST_INITIALIZE);
            }
        }

        this._endLooping(wasLooping);
    }

    // Sets isLoopingThroughScripts to false and returns
    // its previous value
    _beginLooping() {
        const looping = this._isLoopingThroughScripts;
        this._isLoopingThroughScripts = true;
        return looping;
    }

    // Restores isLoopingThroughScripts to the specified parameter
    // If all loops are over then remove destroyed scripts form the _scripts array
    _endLooping(wasLoopingBefore) {
        this._isLoopingThroughScripts = wasLoopingBefore;
        if (!this._isLoopingThroughScripts) {
            this._removeDestroyedScripts();
        }
    }

    // We also need this handler because it is fired
    // when value === old instead of onEnable and onDisable
    // which are only fired when value !== old
    _onSetEnabled(prop, old, value) {
        this._beingEnabled = true;
        this._checkState();
        this._beingEnabled = false;
    }

    _checkState() {
        const state = this.enabled && this.entity.enabled;
        if (state === this._oldState)
            return;

        this._oldState = state;

        this.fire(state ? 'enable' : 'disable');
        this.fire('state', state);

        if (state) {
            this.system._addComponentToEnabled(this);
        } else {
            this.system._removeComponentFromEnabled(this);
        }

        const wasLooping = this._beginLooping();

        for (let i = 0, len = this.scripts.length; i < len; i++) {
            const script = this.scripts[i];
            script.once('preInitialize', () => {
                this.initializeAttributes(script);
            });
            script.enabled = script._enabled;
        }

        this._endLooping(wasLooping);
    }

    _onBeforeRemove() {
        this.fire('remove');

        const wasLooping = this._beginLooping();

        // destroy all scripts
        for (let i = 0; i < this.scripts.length; i++) {
            const script = this.scripts[i];
            if (!script) continue;

            this.destroy(script.__scriptType.__name);
        }

        this._endLooping(wasLooping);
    }

    _removeDestroyedScripts() {
        const len = this._destroyedScripts.length;
        if (!len) return;

        for (let i = 0; i < len; i++) {
            const script = this._destroyedScripts[i];
            this._removeScriptInstance(script);
        }

        this._destroyedScripts.length = 0;

        // update execution order for scripts
        this._resetExecutionOrder(0, this._scripts.length);
    }

    _onInitializeAttributes() {
        for (let i = 0, len = this.scripts.length; i < len; i++) {
            const script = this.scripts[i];
            this.initializeAttributes(script);
        }
    }

    initializeAttributes(script) {

        // if script has __initializeAttributes method assume it has a runtime schema
        if (script instanceof ScriptType) {

            script.__initializeAttributes();

        } else {

            // otherwise we need to manually initialize attributes from the schema
            const name = script.__scriptType.__name;
            const data = this._attributeDataMap.get(name);

            // If not data exists return early
            if (!data) {
                return;
            }

            // Fetch schema and warn if it doesn't exist
            const schema = this.system.app.scripts?.getSchema(name);
            if (!schema) {
                Debug.warnOnce(`No schema exists for the script '${name}'. A schema must exist for data to be instantiated on the script.`);
            }

            // Assign the attributes to the script instance based on the attribute schema
            assignAttributesToScript(this.system.app, schema.attributes, data, script);

        }
    }

    _scriptMethod(script, method, arg) {
        // #if _DEBUG
        try {
        // #endif
            script[method](arg);
        // #if _DEBUG
        } catch (ex) {
            // disable script if it fails to call method
            script.enabled = false;

            if (!script.hasEvent('error')) {
                console.warn(`unhandled exception while calling "${method}" for "${script.__scriptType.__name}" script: `, ex);
                console.error(ex);
            }

            script.fire('error', ex, method);
            this.fire('error', script, ex, method);
        }
        // #endif
    }

    _onInitialize() {
        const scripts = this._scripts;

        const wasLooping = this._beginLooping();

        for (let i = 0, len = scripts.length; i < len; i++) {
            const script = scripts[i];
            if (!script._initialized && script.enabled) {
                script._initialized = true;
                if (script.initialize)
                    this._scriptMethod(script, SCRIPT_INITIALIZE);
            }
        }

        this._endLooping(wasLooping);
    }

    _onPostInitialize() {
        this.onPostStateChange();
    }

    _onUpdate(dt) {
        const list = this._updateList;
        if (!list.length) return;

        const wasLooping = this._beginLooping();

        for (list.loopIndex = 0; list.loopIndex < list.length; list.loopIndex++) {
            const script = list.items[list.loopIndex];
            if (script.enabled) {
                this._scriptMethod(script, SCRIPT_UPDATE, dt);
            }
        }

        this._endLooping(wasLooping);
    }

    _onPostUpdate(dt) {
        const list = this._postUpdateList;
        if (!list.length) return;

        const wasLooping = this._beginLooping();

        for (list.loopIndex = 0; list.loopIndex < list.length; list.loopIndex++) {
            const script = list.items[list.loopIndex];
            if (script.enabled) {
                this._scriptMethod(script, SCRIPT_POST_UPDATE, dt);
            }
        }

        this._endLooping(wasLooping);
    }

    /**
     * Inserts script instance into the scripts array at the specified index. Also inserts the
     * script into the update list if it has an update method and the post update list if it has a
     * postUpdate method.
     *
     * @param {object} scriptInstance - The script instance.
     * @param {number} index - The index where to insert the script at. If -1, append it at the end.
     * @param {number} scriptsLength - The length of the scripts array.
     * @private
     */
    _insertScriptInstance(scriptInstance, index, scriptsLength) {
        if (index === -1) {
            // append script at the end and set execution order
            this._scripts.push(scriptInstance);
            scriptInstance.__executionOrder = scriptsLength;

            // append script to the update list if it has an update method
            if (scriptInstance.update) {
                this._updateList.append(scriptInstance);
            }

            // add script to the postUpdate list if it has a postUpdate method
            if (scriptInstance.postUpdate) {
                this._postUpdateList.append(scriptInstance);
            }
        } else {
            // insert script at index and set execution order
            this._scripts.splice(index, 0, scriptInstance);
            scriptInstance.__executionOrder = index;

            // now we also need to update the execution order of all
            // the script instances that come after this script
            this._resetExecutionOrder(index + 1, scriptsLength + 1);

            // insert script to the update list if it has an update method
            // in the right order
            if (scriptInstance.update) {
                this._updateList.insert(scriptInstance);
            }

            // insert script to the postUpdate list if it has a postUpdate method
            // in the right order
            if (scriptInstance.postUpdate) {
                this._postUpdateList.insert(scriptInstance);
            }
        }
    }

    _removeScriptInstance(scriptInstance) {
        const idx = this._scripts.indexOf(scriptInstance);
        if (idx === -1) return idx;

        this._scripts.splice(idx, 1);

        if (scriptInstance.update) {
            this._updateList.remove(scriptInstance);
        }

        if (scriptInstance.postUpdate) {
            this._postUpdateList.remove(scriptInstance);
        }

        return idx;
    }

    _resetExecutionOrder(startIndex, scriptsLength) {
        for (let i = startIndex; i < scriptsLength; i++) {
            this._scripts[i].__executionOrder = i;
        }
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
     * @param {string|typeof import('../../script/script-type.js').ScriptType} nameOrType - The
     * name or type of {@link ScriptType}.
     * @returns {boolean} If script is attached to an entity.
     * @example
     * if (entity.script.has('playerController')) {
     *     // entity has script
     * }
     */
    has(nameOrType) {
        if (typeof nameOrType === 'string') {
            return !!this._scriptsIndex[nameOrType];
        }

        if (!nameOrType) return false;
        const scriptType = nameOrType;
        const scriptName = scriptType.__name;
        const scriptData = this._scriptsIndex[scriptName];
        const scriptInstance = scriptData && scriptData.instance;
        return scriptInstance instanceof scriptType; // will return false if scriptInstance undefined
    }

    /**
     * Get a script instance (if attached).
     *
     * @param {string|typeof import('../../script/script-type.js').ScriptType} nameOrType - The
     * name or type of {@link ScriptType}.
     * @returns {import('../../script/script-type.js').ScriptType|null} If script is attached, the
     * instance is returned. Otherwise null is returned.
     * @example
     * const controller = entity.script.get('playerController');
     */
    get(nameOrType) {
        if (typeof nameOrType === 'string') {
            const data = this._scriptsIndex[nameOrType];
            return data ? data.instance : null;
        }

        if (!nameOrType) return null;
        const scriptType = nameOrType;
        const scriptName = scriptType.__name;
        const scriptData = this._scriptsIndex[scriptName];
        const scriptInstance = scriptData && scriptData.instance;
        return scriptInstance instanceof scriptType ? scriptInstance : null;
    }

    /**
     * Create a script instance and attach to an entity script component.
     *
     * @param {string|typeof import('../../script/script.js').Script} nameOrType - The
     * name or type of {@link Script}.
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
     * entity.script.create('playerController', {
     *     attributes: {
     *         speed: 4
     *     }
     * });
     */
    create(nameOrType, args = {}) {
        const self = this;

        let scriptType = nameOrType;
        let scriptName = nameOrType;

        // shorthand using script name
        if (typeof scriptType === 'string') {
            scriptType = this.system.app.scripts.get(scriptType);
        } else if (scriptType) {
            scriptName = scriptType.__name ?? toLowerCamelCase(getScriptName(scriptType));
        }

        if (scriptType) {
            if (!this._scriptsIndex[scriptName] || !this._scriptsIndex[scriptName].instance) {
                // create script instance
                const scriptInstance = new scriptType({
                    app: this.system.app,
                    entity: this.entity,
                    enabled: args.hasOwnProperty('enabled') ? args.enabled : true,
                    attributes: args.attributes
                });


                // If the script is not a ScriptType then we must store attribute data on the component
                if (!(scriptInstance instanceof ScriptType)) {

                    // Store the Attribute data
                    this._attributeDataMap.set(scriptName, args.attributes);

                }

                const len = this._scripts.length;
                let ind = -1;
                if (typeof args.ind === 'number' && args.ind !== -1 && len > args.ind)
                    ind = args.ind;

                this._insertScriptInstance(scriptInstance, ind, len);

                this._scriptsIndex[scriptName] = {
                    instance: scriptInstance,
                    onSwap: function () {
                        self.swap(scriptName);
                    }
                };

                this[scriptName] = scriptInstance;

                if (!args.preloading)
                    this.initializeAttributes(scriptInstance);

                this.fire('create', scriptName, scriptInstance);
                this.fire('create:' + scriptName, scriptInstance);

                this.system.app.scripts.on('swap:' + scriptName, this._scriptsIndex[scriptName].onSwap);

                if (!args.preloading) {

                    if (scriptInstance.enabled && !scriptInstance._initialized) {
                        scriptInstance._initialized = true;

                        if (scriptInstance.initialize)
                            this._scriptMethod(scriptInstance, SCRIPT_INITIALIZE);
                    }

                    if (scriptInstance.enabled && !scriptInstance._postInitialized) {
                        scriptInstance._postInitialized = true;
                        if (scriptInstance.postInitialize)
                            this._scriptMethod(scriptInstance, SCRIPT_POST_INITIALIZE);
                    }
                }


                return scriptInstance;
            }

            Debug.warn(`script '${scriptName}' is already added to entity '${this.entity.name}'`);
        } else {
            this._scriptsIndex[scriptName] = {
                awaiting: true,
                ind: this._scripts.length
            };

            Debug.warn(`script '${scriptName}' is not found, awaiting it to be added to registry`);
        }

        return null;
    }

    /**
     * Destroy the script instance that is attached to an entity.
     *
     * @param {string|typeof import('../../script/script-type.js').ScriptType} nameOrType - The
     * name or type of {@link ScriptType}.
     * @returns {boolean} If it was successfully destroyed.
     * @example
     * entity.script.destroy('playerController');
     */
    destroy(nameOrType) {
        let scriptName = nameOrType;
        let scriptType = nameOrType;

        // shorthand using script name
        if (typeof scriptType === 'string') {
            scriptType = this.system.app.scripts.get(scriptType);
        } else if (scriptType) {
            scriptName = scriptType.__name;
        }

        const scriptData = this._scriptsIndex[scriptName];
        delete this._scriptsIndex[scriptName];
        if (!scriptData) return false;

        this._attributeDataMap.delete(scriptName);

        const scriptInstance = scriptData.instance;
        if (scriptInstance && !scriptInstance._destroyed) {
            scriptInstance.enabled = false;
            scriptInstance._destroyed = true;

            // if we are not currently looping through our scripts
            // then it's safe to remove the script
            if (!this._isLoopingThroughScripts) {
                const ind = this._removeScriptInstance(scriptInstance);
                if (ind >= 0) {
                    this._resetExecutionOrder(ind, this._scripts.length);
                }
            } else {
                // otherwise push the script in _destroyedScripts and
                // remove it from _scripts when the loop is over
                this._destroyedScripts.push(scriptInstance);
            }
        }

        // remove swap event
        this.system.app.scripts.off('swap:' + scriptName, scriptData.onSwap);

        delete this[scriptName];

        this.fire('destroy', scriptName, scriptInstance || null);
        this.fire('destroy:' + scriptName, scriptInstance || null);

        if (scriptInstance)
            scriptInstance.fire('destroy');

        return true;
    }

    /**
     * Swap the script instance.
     *
     * @param {string|typeof import('../../script/script-type.js').ScriptType} nameOrType - The
     * name or type of {@link ScriptType}.
     * @returns {boolean} If it was successfully swapped.
     * @private
     */
    swap(nameOrType) {
        let scriptName = nameOrType;
        let scriptType = nameOrType;

        // shorthand using script name
        if (typeof scriptType === 'string') {
            scriptType = this.system.app.scripts.get(scriptType);
        } else if (scriptType) {
            scriptName = scriptType.__name;
        }

        const old = this._scriptsIndex[scriptName];
        if (!old || !old.instance) return false;

        const scriptInstanceOld = old.instance;
        const ind = this._scripts.indexOf(scriptInstanceOld);

        const scriptInstance = new scriptType({
            app: this.system.app,
            entity: this.entity,
            enabled: scriptInstanceOld.enabled,
            attributes: scriptInstanceOld.__attributes
        });

        if (!scriptInstance.swap)
            return false;

        this.initializeAttributes(scriptInstance);

        // add to component
        this._scripts[ind] = scriptInstance;
        this._scriptsIndex[scriptName].instance = scriptInstance;
        this[scriptName] = scriptInstance;

        // set execution order and make sure we update
        // our update and postUpdate lists
        scriptInstance.__executionOrder = ind;
        if (scriptInstanceOld.update) {
            this._updateList.remove(scriptInstanceOld);
        }
        if (scriptInstanceOld.postUpdate) {
            this._postUpdateList.remove(scriptInstanceOld);
        }

        if (scriptInstance.update) {
            this._updateList.insert(scriptInstance);
        }
        if (scriptInstance.postUpdate) {
            this._postUpdateList.insert(scriptInstance);
        }

        this._scriptMethod(scriptInstance, SCRIPT_SWAP, scriptInstanceOld);

        this.fire('swap', scriptName, scriptInstance);
        this.fire('swap:' + scriptName, scriptInstance);

        return true;
    }

    /**
     * When an entity is cloned and it has entity script attributes that point to other entities in
     * the same subtree that is cloned, then we want the new script attributes to point at the
     * cloned entities. This method remaps the script attributes for this entity and it assumes
     * that this entity is the result of the clone operation.
     *
     * @param {ScriptComponent} oldScriptComponent - The source script component that belongs to
     * the entity that was being cloned.
     * @param {object} duplicatedIdsMap - A dictionary with guid-entity values that contains the
     * entities that were cloned.
     * @private
     */
    resolveDuplicatedEntityReferenceProperties(oldScriptComponent, duplicatedIdsMap) {
        const newScriptComponent = this.entity.script;

        // for each script in the old component
        for (const scriptName in oldScriptComponent._scriptsIndex) {
            // get the script type from the script registry
            const scriptType = this.system.app.scripts.get(scriptName);
            if (!scriptType) {
                continue;
            }

            // get the script from the component's index
            const script = oldScriptComponent._scriptsIndex[scriptName];
            if (!script || !script.instance) {
                continue;
            }

            // if __attributesRaw exists then it means that the new entity
            // has not yet initialized its attributes so put the new guid in there,
            // otherwise it means that the attributes have already been initialized
            // so convert the new guid to an entity
            // and put it in the new attributes
            const newAttributesRaw = newScriptComponent[scriptName].__attributesRaw;
            const newAttributes = newScriptComponent[scriptName].__attributes;
            if (!newAttributesRaw && !newAttributes) {
                continue;
            }

            // if we are using attributesRaw then use the guid otherwise use the entity
            const useGuid = !!newAttributesRaw;

            // get the old script attributes from the instance
            const oldAttributes = script.instance.__attributes;
            for (const attributeName in oldAttributes) {
                if (!oldAttributes[attributeName]) {
                    continue;
                }

                // get the attribute definition from the script type
                const attribute = scriptType.attributes.get(attributeName);
                if (!attribute) {
                    continue;
                }

                if (attribute.type === 'entity') {
                    // entity attributes
                    this._resolveEntityScriptAttribute(
                        attribute,
                        attributeName,
                        oldAttributes[attributeName],
                        useGuid,
                        newAttributesRaw || newAttributes,
                        duplicatedIdsMap
                    );
                } else if (attribute.type === 'json' && Array.isArray(attribute.schema)) {
                    // json attributes
                    const oldValue = oldAttributes[attributeName];
                    const newJsonValue = (newAttributesRaw ? newAttributesRaw[attributeName] : newAttributes[attributeName]);

                    for (let i = 0; i < attribute.schema.length; i++) {
                        const field = attribute.schema[i];
                        if (field.type !== 'entity') {
                            continue;
                        }

                        if (attribute.array) {
                            for (let j = 0; j < oldValue.length; j++) {
                                this._resolveEntityScriptAttribute(
                                    field,
                                    field.name,
                                    oldValue[j][field.name],
                                    useGuid,
                                    newJsonValue[j],
                                    duplicatedIdsMap
                                );
                            }
                        } else {
                            this._resolveEntityScriptAttribute(
                                field,
                                field.name,
                                oldValue[field.name],
                                useGuid,
                                newJsonValue,
                                duplicatedIdsMap
                            );
                        }
                    }
                }
            }
        }
    }

    /**
     * Move script instance to different position to alter update order of scripts within entity.
     *
     * @param {string|typeof import('../../script/script-type.js').ScriptType} nameOrType - The
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

export { ScriptComponent };
