import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';

import { SCRIPT_INITIALIZE, SCRIPT_POST_INITIALIZE } from './constants.js';
import { ScriptAttributes } from './script-attributes.js';

const funcNameRegex = new RegExp('^\\s*function(?:\\s|\\s*\\/\\*.*\\*\\/\\s*)+([^\\(\\s\\/]*)\\s*');

/**
 * The Script class is a base class that you must extend to receive
 * {@link https://developer.playcanvas.com/user-manual/scripting/anatomy/ various lifecycle updates}
 * from the engine.
 *
 * You can create a Script using either {@link createScript} or by extending the class directly.
 *
 * ```javascript
 * import { Script } from 'playcanvas';
 * class Rotator extends Script {
 *     update() {
 *         this.entity.rotate(0, 0.1, 0);
 *     }
 * }
 * ```
 * The following methods are called if they exist on the Script instance:
 *
 * - `initialize`
 * - `postInitialize`
 * - `update`
 * - `postUpdate`
 * - `swap`
 *
 * `initialize` and `postInitialize` - are called (if defined) when a script is about to run for
 * the first time - `postInitialize` will run after all `initialize` methods are executed in the
 * same tick or enabling chain of actions.
 *
 * `update` and `postUpdate` - are called (if defined) for enabled (running state) scripts on each
 * tick.
 *
 * `swap` - is called when a Script that already exists in the registry gets redefined. If the
 * new Script has a `swap` method in its prototype, then it will be executed to perform hot-
 * reload at runtime.
 *
 * @see {@link https://developer.playcanvas.com/user-manual/scripting/anatomy/} for more information.
 * @category Script
 */
class Script extends EventHandler {
    /**
     * Fired when a script instance becomes enabled.
     *
     * @event
     * @example
     * PlayerController.prototype.initialize = function () {
     *     this.on('enable', () => {
     *         // Script Instance is now enabled
     *     });
     * };
     */
    static EVENT_ENABLE = 'enable';

    /**
     * Fired when a script instance becomes disabled.
     *
     * @event
     * @example
     * PlayerController.prototype.initialize = function () {
     *     this.on('disable', () => {
     *         // Script Instance is now disabled
     *     });
     * };
     */
    static EVENT_DISABLE = 'disable';

    /**
     * Fired when a script instance changes state to enabled or disabled. The handler is passed a
     * boolean parameter that states whether the script instance is now enabled or disabled.
     *
     * @event
     * @example
     * PlayerController.prototype.initialize = function () {
     *     this.on('state', (enabled) => {
     *         console.log(`Script Instance is now ${enabled ? 'enabled' : 'disabled'}`);
     *     });
     * };
     */
    static EVENT_STATE = 'state';

    /**
     * Fired when a script instance is destroyed and removed from component.
     *
     * @event
     * @example
     * PlayerController.prototype.initialize = function () {
     *     this.on('destroy', () => {
     *         // no longer part of the entity
     *         // this is a good place to clean up allocated resources used by the script
     *     });
     * };
     */
    static EVENT_DESTROY = 'destroy';

    /**
     * Fired when script attributes have changed. This event is available in two forms. They are as follows:
     *
     * 1. `attr` - Fired for any attribute change. The handler is passed the name of the attribute
     * that changed, the value of the attribute before the change and the value of the attribute
     * after the change.
     * 2. `attr:[name]` - Fired for a specific attribute change. The handler is passed the value of
     * the attribute before the change and the value of the attribute after the change.
     *
     * @event
     * @example
     * PlayerController.prototype.initialize = function () {
     *     this.on('attr', (name, newValue, oldValue) => {
     *         console.log(`Attribute '${name}' changed from '${oldValue}' to '${newValue}'`);
     *     });
     * };
     * @example
     * PlayerController.prototype.initialize = function () {
     *     this.on('attr:speed', (newValue, oldValue) => {
     *         console.log(`Attribute 'speed' changed from '${oldValue}' to '${newValue}'`);
     *     });
     * };
     */
    static EVENT_ATTR = 'attr';

    /**
     * Fired when a script instance had an exception. The script instance will be automatically
     * disabled. The handler is passed an {@link Error} object containing the details of the
     * exception and the name of the method that threw the exception.
     *
     * @event
     * @example
     * PlayerController.prototype.initialize = function () {
     *     this.on('error', (err, method) => {
     *         // caught an exception
     *         console.log(err.stack);
     *     });
     * };
     */
    static EVENT_ERROR = 'error';

    /**
     * The {@link AppBase} that the instance of this type belongs to.
     *
     * @type {import('../app-base.js').AppBase}
     */
    app;

    /**
     * The {@link Entity} that the instance of this type belongs to.
     *
     * @type {import('../entity.js').Entity}
     */
    entity;

    /** @private */
    _enabled;

    /** @private */
    _enabledOld;

    /** @private */
    _initialized;

    /** @private */
    _postInitialized;

    /** @private */
    __destroyed;

    /** @private */
    __attributes;

    /** @private */
    __attributesRaw;

    /** @private */
    __scriptType;

    /**
     * The order in the script component that the methods of this script instance will run
     * relative to other script instances in the component.
     *
     * @type {number}
     * @private
     */
    __executionOrder;

    /**
     * Create a new Script instance.
     *
     * @param {object} args - The input arguments object.
     * @param {import('../app-base.js').AppBase} args.app - The {@link AppBase} that is running the
     * script.
     * @param {import('../entity.js').Entity} args.entity - The {@link Entity} that the script is
     * attached to.
     */
    constructor(args) {
        super();
        this.initScriptType(args);
    }

    /**
     * True if the instance of this type is in running state. False when script is not running,
     * because the Entity or any of its parents are disabled or the {@link ScriptComponent} is
     * disabled or the Script Instance is disabled. When disabled no update methods will be called
     * on each tick. initialize and postInitialize methods will run once when the script instance
     * is in `enabled` state during app tick.
     *
     * @type {boolean}
     */
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
                this.entity.script._scriptMethod(this, SCRIPT_INITIALIZE);
        }

        // post initialize script if not post initialized yet and still enabled
        // (initialize might have disabled the script so check this.enabled again)
        // Warning: Do not do this if the script component is currently being enabled
        // because in this case post initialize must be called after all the scripts
        // in the script component have been initialized first
        if (this._initialized && !this._postInitialized && this.enabled && !this.entity.script._beingEnabled) {
            this._postInitialized = true;

            if (this.postInitialize)
                this.entity.script._scriptMethod(this, SCRIPT_POST_INITIALIZE);
        }
    }

    get enabled() {
        return this._enabled && !this._destroyed && this.entity.script.enabled && this.entity.enabled;
    }

    /**
     * @param {{entity: import('../entity.js').Entity, app: import('../app-base.js').AppBase}} args -
     * The entity and app.
     * @private
     */
    initScriptType(args) {
        const script = this.constructor; // get script type, i.e. function (class)
        Debug.assert(args && args.app && args.entity, `script [${script.__name}] has missing arguments in constructor`);

        this.app = args.app;
        this.entity = args.entity;

        this._enabled = typeof args.enabled === 'boolean' ? args.enabled : true;
        this._enabledOld = this.enabled;

        this.__destroyed = false;
        this.__attributes = { };
        this.__attributesRaw = args.attributes || { }; // need at least an empty object to make sure default attributes are initialized
        this.__scriptType = script;
        this.__executionOrder = -1;
    }

    /**
     * Name of a Script.
     *
     * @type {string}
     * @private
     */
    static __name = null; // Will be assigned when calling createScript or registerScript.

    /**
     * @param {*} constructorFn - The constructor function of the script type.
     * @returns {string} The script name.
     * @private
     */
    static __getScriptName(constructorFn) {
        if (typeof constructorFn !== 'function') return undefined;
        if ('name' in Function.prototype) return constructorFn.name;
        if (constructorFn === Function || constructorFn === Function.prototype.constructor) return 'Function';
        const match = ('' + constructorFn).match(funcNameRegex);
        return match ? match[1] : undefined;
    }

    /**
     * Name of a Script Type.
     *
     * @type {string|null}
     */
    static get scriptName() {
        return this.__name;
    }

    /**
     * The interface to define attributes for Script Types. Refer to {@link ScriptAttributes}.
     *
     * @type {ScriptAttributes}
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

    /**
     * @param {boolean} [force] - Set to true to force initialization of the attributes.
     * @private
     */
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
     * Shorthand function to extend Script Type prototype with list of methods.
     *
     * @param {object} methods - Object with methods, where key - is name of method, and value - is function.
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
     * @name Script#[initialize]
     * @description Called when script is about to run for the first time.
     */

    /**
     * @function
     * @name Script#[postInitialize]
     * @description Called after all initialize methods are executed in the same tick or enabling chain of actions.
     */

    /**
     * @function
     * @name Script#[update]
     * @description Called for enabled (running state) scripts on each tick.
     * @param {number} dt - The delta time in seconds since the last frame.
     */

    /**
     * @function
     * @name Script#[postUpdate]
     * @description Called for enabled (running state) scripts on each tick, after update.
     * @param {number} dt - The delta time in seconds since the last frame.
     */

    /**
     * @function
     * @name Script#[swap]
     * @description Called when a Script that already exists in the registry
     * gets redefined. If the new Script has a `swap` method in its prototype,
     * then it will be executed to perform hot-reload at runtime.
     * @param {Script} old - Old instance of the script to copy data to the new instance.
     */
}

export { Script };
