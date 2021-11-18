import { EventHandler } from '../core/event-handler.js';

import { ScriptComponent } from '../framework/components/script/component.js';

import { ScriptAttributes } from './script-attributes.js';

const funcNameRegex = new RegExp('^\\s*function(?:\\s|\\s*\\/\\*.*\\*\\/\\s*)+([^\\(\\s\\/]*)\\s*');

/**
 * @class
 * @name ScriptType
 * @augments EventHandler
 * @classdesc Represents the type of a script. It is returned by {@link createScript}.
 * Also referred to as Script Type.
 *
 * The type is to be extended using its JavaScript prototype. There is a list of methods
 * that will be executed by the engine on instances of this type, such as:
 *
 * - `initialize`
 * - `postInitialize`
 * - `update`
 * - `postUpdate`
 * - `swap`
 *
 * `initialize` and `postInitialize` - are called (if defined) when a script is about to run
 * for the first time - `postInitialize` will run after all `initialize` methods are executed
 * in the same tick or enabling chain of actions.
 *
 * `update` and `postUpdate` - are called (if defined) for enabled (running state) scripts
 * on each tick.
 *
 * `swap` - is called when a ScriptType that already exists in the registry gets redefined.
 * If the new ScriptType has a `swap` method in its prototype, then it will be executed to
 * perform hot-reload at runtime.
 * @property {Application} app The {@link Application} that the instance of this type
 * belongs to.
 * @property {Entity} entity The {@link Entity} that the instance of this type belongs to.
 * @property {boolean} enabled True if the instance of this type is in running state. False
 * when script is not running, because the Entity or any of its parents are disabled or the
 * Script Component is disabled or the Script Instance is disabled. When disabled no update
 * methods will be called on each tick. initialize and postInitialize methods will run once
 * when the script instance is in `enabled` state during app tick.
 * @param {object} args - The input arguments object
 * @param {Application} args.app - The {@link Application} that is running the script
 * @param {Entity} args.entity - The {@link Entity} that the script is attached to
 *
 */
class ScriptType extends EventHandler {
    constructor(args) {
        super();
        this.initScriptType(args);
    }

    initScriptType(args) {
        const script = this.constructor; // get script type, i.e. function (class)

        // #if _DEBUG
        if (!args || !args.app || !args.entity) {
            console.warn('script \'' + script.__name + '\' has missing arguments in constructor');
        }
        // #endif

        this.app = args.app;
        this.entity = args.entity;
        this._enabled = typeof args.enabled === 'boolean' ? args.enabled : true;
        this._enabledOld = this.enabled;
        this.__destroyed = false;
        this.__attributes = { };
        this.__attributesRaw = args.attributes || { }; // need at least an empty object to make sure default attributes are initialized
        this.__scriptType = script;

        // the order in the script component that the
        // methods of this script instance will run relative to
        // other script instances in the component
        this.__executionOrder = -1;
    }

    /**
     * @private
     * @readonly
     * @static
     * @name ScriptType.__name
     * @type {string}
     * @description Name of a Script Type.
     */
    static __name = null; // Will be assigned when calling createScript or registerScript.

    static __getScriptName(constructorFn) {
        if (typeof constructorFn !== 'function') return undefined;
        if ('name' in Function.prototype) return constructorFn.name;
        if (constructorFn === Function || constructorFn === Function.prototype.constructor) return 'Function';
        const match = ("" + constructorFn).match(funcNameRegex);
        return match ? match[1] : undefined;
    }

    /**
     * @field
     * @static
     * @readonly
     * @name ScriptType.scriptName
     * @type {string|null}
     * @description Name of a Script Type.
     */
    static get scriptName() {
        return this.__name;
    }

    /**
     * @field
     * @static
     * @readonly
     * @name ScriptType.attributes
     * @type {ScriptAttributes}
     * @description The interface to define attributes for Script Types. Refer to {@link ScriptAttributes}.
     * @example
     * var PlayerController = pc.createScript('playerController');
     *
     * PlayerController.attributes.add('speed', {
     *     type: 'number',
     *     title: 'Speed',
     *     placeholder: 'km/h',
     *     default: 22.2
     * });
     */
    static get attributes() {
        if (!this.hasOwnProperty('__attributes')) this.__attributes = new ScriptAttributes(this);
        return this.__attributes;
    }

    // initialize attributes
    __initializeAttributes(force) {
        if (!force && !this.__attributesRaw)
            return;

        // set attributes values
        for (const key in this.__scriptType.attributes.index) {
            if (this.__attributesRaw && this.__attributesRaw.hasOwnProperty(key)) {
                this[key] = this.__attributesRaw[key];
            } else if (!this.__attributes.hasOwnProperty(key)) {
                if (this.__scriptType.attributes.index[key].hasOwnProperty('default')) {
                    this[key] = this.__scriptType.attributes.index[key].default;
                } else {
                    this[key] = null;
                }
            }
        }

        this.__attributesRaw = null;
    }

    /**
     * @readonly
     * @static
     * @function
     * @name ScriptType.extend
     * @param {object} methods - Object with methods, where key - is name of method, and value - is function.
     * @description Shorthand function to extend Script Type prototype with list of methods.
     * @example
     * var PlayerController = pc.createScript('playerController');
     *
     * PlayerController.extend({
     *     initialize: function () {
     *         // called once on initialize
     *     },
     *     update: function (dt) {
     *         // called each tick
     *     }
     * });
     */
    static extend(methods) {
        for (const key in methods) {
            if (!methods.hasOwnProperty(key))
                continue;

            this.prototype[key] = methods[key];
        }
    }

    /**
     * @function
     * @name ScriptType#[initialize]
     * @description Called when script is about to run for the first time.
     */

    /**
     * @function
     * @name ScriptType#[postInitialize]
     * @description Called after all initialize methods are executed in the same tick or enabling chain of actions.
     */

    /**
     * @function
     * @name ScriptType#[update]
     * @description Called for enabled (running state) scripts on each tick.
     * @param {number} dt - The delta time in seconds since the last frame.
     */

    /**
     * @function
     * @name ScriptType#[postUpdate]
     * @description Called for enabled (running state) scripts on each tick, after update.
     * @param {number} dt - The delta time in seconds since the last frame.
     */

    /**
     * @function
     * @name ScriptType#[swap]
     * @description Called when a ScriptType that already exists in the registry
     * gets redefined. If the new ScriptType has a `swap` method in its prototype,
     * then it will be executed to perform hot-reload at runtime.
     * @param {ScriptType} old - Old instance of the scriptType to copy data to the new instance.
     */

    /**
     * @event
     * @name ScriptType#enable
     * @description Fired when a script instance becomes enabled.
     * @example
     * PlayerController.prototype.initialize = function () {
     *     this.on('enable', function () {
     *         // Script Instance is now enabled
     *     });
     * };
     */

    /**
     * @event
     * @name ScriptType#disable
     * @description Fired when a script instance becomes disabled.
     * @example
     * PlayerController.prototype.initialize = function () {
     *     this.on('disable', function () {
     *         // Script Instance is now disabled
     *     });
     * };
     */

    /**
     * @event
     * @name ScriptType#state
     * @description Fired when a script instance changes state to enabled or disabled.
     * @param {boolean} enabled - True if now enabled, False if disabled.
     * @example
     * PlayerController.prototype.initialize = function () {
     *     this.on('state', function (enabled) {
     *         console.log('Script Instance is now ' + (enabled ? 'enabled' : 'disabled'));
     *     });
     * };
     */

    /**
     * @event
     * @name ScriptType#destroy
     * @description Fired when a script instance is destroyed and removed from component.
     * @example
     * PlayerController.prototype.initialize = function () {
     *     this.on('destroy', function () {
     *         // no more part of an entity
     *         // good place to cleanup entity from destroyed script
     *     });
     * };
     */

    /**
     * @event
     * @name ScriptType#attr
     * @description Fired when any script attribute has been changed.
     * @param {string} name - Name of attribute.
     * @param {object} value - New value.
     * @param {object} valueOld - Old value.
     * @example
     * PlayerController.prototype.initialize = function () {
     *     this.on('attr', function (name, value, valueOld) {
     *         console.log(name + ' been changed from ' + valueOld + ' to ' + value);
     *     });
     * };
     */

    /**
     * @event
     * @name ScriptType#attr:[name]
     * @description Fired when a specific script attribute has been changed.
     * @param {object} value - New value.
     * @param {object} valueOld - Old value.
     * @example
     * PlayerController.prototype.initialize = function () {
     *     this.on('attr:speed', function (value, valueOld) {
     *         console.log('speed been changed from ' + valueOld + ' to ' + value);
     *     });
     * };
     */

    /**
     * @event
     * @name ScriptType#error
     * @description Fired when a script instance had an exception. The script instance will be automatically disabled.
     * @param {Error} err - Native JavaScript Error object with details of error.
     * @param {string} method - The method of the script instance that the exception originated from.
     * @example
     * PlayerController.prototype.initialize = function () {
     *     this.on('error', function (err, method) {
     *         // caught an exception
     *         console.log(err.stack);
     *     });
     * };
     */

    get enabled() {
        return this._enabled && !this._destroyed && this.entity.script.enabled && this.entity.enabled;
    }

    set enabled(value) {
        this._enabled = !!value;

        if (this.enabled === this._enabledOld) return;

        this._enabledOld = this.enabled;
        this.fire(this.enabled ? 'enable' : 'disable');
        this.fire('state', this.enabled);

        // initialize script if not initialized yet and script is enabled
        if (!this._initialized && this.enabled) {
            this._initialized = true;

            this.__initializeAttributes(true);

            if (this.initialize)
                this.entity.script._scriptMethod(this, ScriptComponent.scriptMethods.initialize);
        }

        // post initialize script if not post initialized yet and still enabled
        // (initialize might have disabled the script so check this.enabled again)
        // Warning: Do not do this if the script component is currently being enabled
        // because in this case post initialize must be called after all the scripts
        // in the script component have been initialized first
        if (this._initialized && !this._postInitialized && this.enabled && !this.entity.script._beingEnabled) {
            this._postInitialized = true;

            if (this.postInitialize)
                this.entity.script._scriptMethod(this, ScriptComponent.scriptMethods.postInitialize);
        }
    }
}

export { ScriptType };
