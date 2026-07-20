import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { AppBase } from '../app-base.js';
import { ScriptAttributes } from './script-attributes.js';
import { ScriptType } from './script-type.js';
import { ScriptTypes } from './script-types.js';
import { reservedScriptNames } from './constants.js';
import { Script, getScriptName } from './script.js';

function getReservedScriptNames() {
    return reservedScriptNames;
}

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
 * onDisable, onPostStateChange, has, on, off, fire, once, hasEvent, worker.
 * @param {AppBase} [app] - Optional application handler, to choose which {@link ScriptRegistry}
 * to add a script to. By default it will use `Application.getApplication()` to get current
 * {@link AppBase}.
 * @returns {typeof ScriptType|null} A class type (constructor function) that inherits {@link ScriptType},
 * which the developer is meant to further extend by adding attributes and prototype methods.
 * Returns null if there was an error.
 * @example
 * var Turning = createScript('turn');
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
    if (reservedScriptNames.has(name)) {
        throw new Error(`Script name '${name}' is reserved, please rename the script`);
    }

    const scriptType = function (args) {
        EventHandler.prototype.initEventHandler.call(this);
        ScriptType.prototype.initScriptType.call(this, args);
    };

    scriptType.prototype = Object.create(ScriptType.prototype);
    scriptType.prototype.constructor = scriptType;

    scriptType.extend = ScriptType.extend;
    scriptType.attributes = new ScriptAttributes(scriptType);

    registerScript(scriptType, name, app);
    return scriptType;
}

// Editor uses this - migrate to ScriptAttributes.reservedNames and delete this
const reservedAttributes = {};
ScriptAttributes.reservedNames.forEach((value, value2, set) => {
    reservedAttributes[value] = 1;
});
createScript.reservedAttributes = reservedAttributes;

/**
 * Register an existing class type as a Script Type with {@link ScriptRegistry}. Useful when defining
 * an ES6 script class that extends {@link ScriptType} (see example).
 *
 * @param {typeof ScriptType} script - The existing class type (constructor function) to be
 * registered as a Script Type. Class must extend {@link ScriptType} (see example). Please note: A
 * class created using {@link createScript} is auto-registered, and should therefore not be passed
 * into {@link registerScript} (which would result in swapping out all related script instances).
 * @param {string} [name] - Optional unique name of the Script Type. By default it will use the
 * same name as the existing class. If a Script Type with the same name has already been registered
 * and the new one has a `swap` method defined in its prototype, then it will perform hot swapping
 * of existing Script Instances on entities using this new Script Type. Note: There is a reserved
 * list of names that cannot be used, such as list below as well as some starting from `_`
 * (underscore): system, entity, create, destroy, swap, move, scripts, onEnable, onDisable,
 * onPostStateChange, has, on, off, fire, once, hasEvent.
 * @param {AppBase} [app] - Optional application handler, to choose which {@link ScriptRegistry}
 * to register the script type with. By default it will use `Application.getApplication()` to get
 * the current {@link AppBase}.
 * @example
 * // define an ES6 script class
 * class PlayerController extends ScriptType {
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
 * registerScript(PlayerController);
 *
 * // declare script attributes (Must be after registerScript())
 * PlayerController.attributes.add('attribute1', {type: 'number'});
 * @category Script
 */
function registerScript(script, name, app) {
    if (typeof script !== 'function') {
        throw new Error(`script class: '${script}' must be a constructor function (i.e. class).`);
    }

    if (!(script.prototype instanceof Script)) {
        throw new Error(`script class: '${ScriptType.__getScriptName(script)}' does not extend pc.Script.`);
    }

    // Resolve the name: an explicit `name` argument wins, otherwise the name is derived from the
    // class itself - its own `__name`, its own `scriptName`, or, as a fallback, its verbatim class
    // name. Only own properties are considered, so a subclass never inherits (and overwrites) its
    // base's name. The verbatim class-name fallback (rather than the lowerCamelCase form used by
    // `ScriptComponent.create` and the asset loader) preserves the pre-2.19.3 registration name, so
    // projects that register ES6 classes via `registerScript(Class)` and reference them by their
    // class name keep working.
    name = name ||
        (Object.prototype.hasOwnProperty.call(script, '__name') && script.__name) ||
        getScriptName(script);

    if (!name) {
        Debug.error(`script class '${script.name || script}' has no name and cannot be registered. Add a static "scriptName" property or pass an explicit name.`);
        return;
    }

    if (reservedScriptNames.has(name)) {
        throw new Error(`script name: '${name}' is reserved, please change script name`);
    }

    script.__name = name;

    // add to scripts registry
    const registry = app ? app.scripts : AppBase.getApplication().scripts;
    registry.add(script);

    ScriptTypes.push(script);
}

export { createScript, registerScript, getReservedScriptNames };
