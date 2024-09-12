import { Debug } from '../..//core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { SCRIPT_INITIALIZE, SCRIPT_POST_INITIALIZE } from './constants.js';

/**
 * The `Script` class is the fundamental base class for all scripts within PlayCanvas. It provides
 * the minimal interface required for a script to be compatible with both the Engine and the
 * Editor.
 *
 * At its core, a script is simply a collection of methods that are called at various points in the Engine's lifecycle. These methods are:
 *
 * {@link Script#initialize} - Called once when the script is initialized
 * {@link Script#postInitialize} - Called once after all scripts have been initialized
 * {@link Script#update} - Called every frame, if the script is enabled
 * {@link Script#postUpdate} - Called every frame, after all scripts have been updated
 * {@link Script#swap} - Called when a script is redefined
 *
 * These methods are entirely optional, but provide a useful way to manage the lifecycle of a script and perform any necessary setup and cleanup.
 *
 * Below is a simple example of a script that rotates an entity every frame.
 * @example
 * ```javascript
 * class EntityRotator extends Script {
 *     update() {
 *         this.entity.rotateLocal(0, 1, 0);
 *     }
 * }
 * ```
 *
 * When this script is attached to an entity, the update will be called every frame, slowly rotating the entity around the Y-axis.
 *
 * For more information on how to create scripts, see the [Scripting Overview](https://developer.playcanvas.com/user-manual/scripting/).
 *
 * @category Script
 */
export class Script extends EventHandler {
    /**
     * Fired when a script instance becomes enabled.
     *
     * @event
     * @example
     * export class PlayerController extends Script {
     *     initialize() {
     *         this.on('enable', () => {
     *             // Script Instance is now enabled
     *         });
     *     }
     * };
     */
    static EVENT_ENABLE = 'enable';

    /**
     * Fired when a script instance becomes disabled.
     *
     * @event
     * @example
     * export class PlayerController extends Script {
     *     initialize() {
     *         this.on('disable', () => {
     *             // Script Instance is now disabled
     *         });
     *     }
     * };
     */
    static EVENT_DISABLE = 'disable';

    /**
     * Fired when a script instance changes state to enabled or disabled. The handler is passed a
     * boolean parameter that states whether the script instance is now enabled or disabled.
     *
     * @event
     * @example
     * export class PlayerController extends Script {
     *     initialize() {
     *         this.on('state', (enabled) => {
     *             console.log(`Script Instance is now ${enabled ? 'enabled' : 'disabled'}`);
     *         });
     *     }
     * };
     */
    static EVENT_STATE = 'state';

    /**
     * Fired when a script instance is destroyed and removed from component.
     *
     * @event
     * @example
     * export class PlayerController extends Script {
     *     initialize() {
     *         this.on('destroy', () => {
     *             // no longer part of the entity
     *             // this is a good place to clean up allocated resources used by the script
     *         });
     *     }
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
     * export class PlayerController extends Script {
     *     initialize() {
     *         this.on('attr', (name, newValue, oldValue) => {
     *             console.log(`Attribute '${name}' changed from '${oldValue}' to '${newValue}'`);
     *         });
     *     }
     * };
     * @example
     * export class PlayerController extends Script {
     *     initialize() {
     *         this.on('attr:speed', (newValue, oldValue) => {
     *             console.log(`Attribute 'speed' changed from '${oldValue}' to '${newValue}'`);
     *         });
     *     }
     * };
     */
    static EVENT_ATTR = 'attr';

    /**
     * Fired when a script instance had an exception. The script instance will be automatically
     * disabled. The handler is passed an Error object containing the details of the
     * exception and the name of the method that threw the exception.
     *
     * @event
     * @example
     * export class PlayerController extends Script {
     *     initialize() {
     *         this.on('error', (err, method) => {
     *             // caught an exception
     *             console.log(err.stack);
     *         });
     *     }
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
     * @typedef {object} ScriptInitializationArgs
     * @property {boolean} [enabled] - True if the script instance is in running state.
     * @property {import('../app-base.js').AppBase} app - The {@link AppBase} that is running the script.
     * @property {import('../entity.js').Entity} entity - The {@link Entity} that the script is attached to.
     */

    /**
     * @param {ScriptInitializationArgs} args - The input arguments object.
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
     * @description Called when a Script that already exists in the registry gets redefined. If the
     * new Script has a `swap` method, then it will be executed to perform hot-reload at runtime.
     * @param {Script} old - Old instance of the scriptType to copy data to the new instance.
     */
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
