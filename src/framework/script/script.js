import { EventHandler } from '../../core/event-handler.js';
import { SCRIPT_INITIALIZE, SCRIPT_POST_INITIALIZE } from './constants.js';

<<<<<<< HEAD
export class Script extends EventHandler {
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
=======
import { AppBase } from '../app-base.js';
>>>>>>> 7f3f8d7de ([BREAKING] Remove support for legacy scripts (#6584))

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

<<<<<<< HEAD
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
        this.initScript(args);
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
=======
/**
 * Create and register a new {@link ScriptType}. It returns new class type (constructor function),
 * which is auto-registered to {@link ScriptRegistry} using its name. This is the main interface to
 * create Script Types, to define custom logic using JavaScript, that is used to create interaction
 * for entities.
 *
 * @param {string} name - Unique Name of a Script Type. If a Script Type with the same name has
 * already been registered and the new one has a `swap` method defined in its prototype, then it
 * will perform hot swapping of existing Script Instances on entities using this new Script Type.
 * Note: There is a reserved list of names that cannot be used, such as list below as well as some
 * starting from `_` (underscore): system, entity, create, destroy, swap, move, scripts, onEnable,
 * onDisable, onPostStateChange, has, on, off, fire, once, hasEvent.
 * @param {AppBase} [app] - Optional application handler, to choose which {@link ScriptRegistry}
 * to add a script to. By default it will use `Application.getApplication()` to get current
 * {@link AppBase}.
 * @returns {typeof ScriptType|null} A class type (constructor function) that inherits {@link ScriptType},
 * which the developer is meant to further extend by adding attributes and prototype methods.
 * Returns null if there was an error.
 * @example
 * var Turning = pc.createScript('turn');
 *
 * // define 'speed' attribute that is available in Editor UI
 * Turning.attributes.add('speed', {
 *     type: 'number',
 *     default: 180,
 *     placeholder: 'deg/s'
 * });
 *
 * // runs every tick
 * Turning.prototype.update = function (dt) {
 *     this.entity.rotate(0, this.speed * dt, 0);
 * };
 * @category Script
 */
function createScript(name, app) {
    if (reservedScriptNames.has(name))
        throw new Error(`Script name '${name}' is reserved, please rename the script`);
>>>>>>> 7f3f8d7de ([BREAKING] Remove support for legacy scripts (#6584))

        if (this.enabled === this._enabledOld) return;

        this._enabledOld = this.enabled;
        this.fire(this.enabled ? 'enable' : 'disable');
        this.fire('state', this.enabled);

        // initialize script if not initialized yet and script is enabled
        if (!this._initialized && this.enabled) {
            this._initialized = true;

            this.fire('preInitialize');

            if (this.initialize)
                this.entity.script._scriptMethod(this, SCRIPT_INITIALIZE);
        }

<<<<<<< HEAD
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
=======
/* eslint-disable jsdoc/check-examples */
/**
 * Register a existing class type as a Script Type to {@link ScriptRegistry}. Useful when defining
 * a ES6 script class that extends {@link ScriptType} (see example).
 *
 * @param {typeof ScriptType} script - The existing class type (constructor function) to be
 * registered as a Script Type. Class must extend {@link ScriptType} (see example). Please note: A
 * class created using {@link createScript} is auto-registered, and should therefore not be pass
 * into {@link registerScript} (which would result in swapping out all related script instances).
 * @param {string} [name] - Optional unique name of the Script Type. By default it will use the
 * same name as the existing class. If a Script Type with the same name has already been registered
 * and the new one has a `swap` method defined in its prototype, then it will perform hot swapping
 * of existing Script Instances on entities using this new Script Type. Note: There is a reserved
 * list of names that cannot be used, such as list below as well as some starting from `_`
 * (underscore): system, entity, create, destroy, swap, move, scripts, onEnable, onDisable,
 * onPostStateChange, has, on, off, fire, once, hasEvent.
 * @param {AppBase} [app] - Optional application handler, to choose which {@link ScriptRegistry}
 * to register the script type to. By default it will use `Application.getApplication()` to get
 * current {@link AppBase}.
 * @example
 * // define a ES6 script class
 * class PlayerController extends pc.ScriptType {
 *
 *     initialize() {
 *         // called once on initialize
 *     }
 *
 *     update(dt) {
 *         // called each tick
 *     }
 * }
 *
 * // register the class as a script
 * pc.registerScript(PlayerController);
 *
 * // declare script attributes (Must be after pc.registerScript())
 * PlayerController.attributes.add('attribute1', {type: 'number'});
 * @category Script
 */
function registerScript(script, name, app) {
    if (typeof script !== 'function')
        throw new Error(`script class: '${script}' must be a constructor function (i.e. class).`);
>>>>>>> 7f3f8d7de ([BREAKING] Remove support for legacy scripts (#6584))

    /**
     * @param {{entity: import('../entity.js').Entity, app: import('../app-base.js').AppBase}} args -
     * The entity and app.
     * @protected
     */
    initScript(args) {
        const script = this.constructor; // get script type, i.e. function (class)
        Debug.assert(args && args.app && args.entity, `script [${script.__name}] has missing arguments in constructor`);

        this.app = args.app;
        this.entity = args.entity;

        this._enabled = typeof args.enabled === 'boolean' ? args.enabled : true;
        this._enabledOld = this.enabled;

        this.__destroyed = false;

        this.__scriptType = script;
        this.__executionOrder = -1;
    }

<<<<<<< HEAD
    /**
     * Name of a Script Type.
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
    static __getScriptName = getScriptName;

    /**
     * Name of a Script Type.
     *
     * @type {string|null}
     */
    static get scriptName() {
        return this.__name;
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
     * @param {Script} old - Old instance of the scriptType to copy data to the new instance.
     */
=======
    ScriptTypes.push(script);
>>>>>>> 7f3f8d7de ([BREAKING] Remove support for legacy scripts (#6584))
}

const funcNameRegex = new RegExp('^\\s*function(?:\\s|\\s*\\/\\*.*\\*\\/\\s*)+([^\\(\\s\\/]*)\\s*');

/**
 * @param {Function} constructorFn - The constructor function of the script type.
 * @returns {string|undefined} The script name.
 */
export function getScriptName(constructorFn) {
    if (typeof constructorFn !== 'function') return undefined;
    if ('name' in Function.prototype) return constructorFn.name;
    if (constructorFn === Function || constructorFn === Function.prototype.constructor) return 'Function';
    const match = ('' + constructorFn).match(funcNameRegex);
    return match ? match[1] : undefined;
}
