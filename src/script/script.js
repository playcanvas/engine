import { ScriptHandler } from '../resources/script.js';

import { script } from '../framework/script.js';
import { Application } from '../framework/application.js';

import { ScriptAttributes } from './script-attributes.js';
import { ScriptType } from './script-type.js';

const reservedScriptNames = new Set([
    'system', 'entity', 'create', 'destroy', 'swap', 'move',
    'scripts', '_scripts', '_scriptsIndex', '_scriptsData',
    'enabled', '_oldState', 'onEnable', 'onDisable', 'onPostStateChange',
    '_onSetEnabled', '_checkState', '_onBeforeRemove',
    '_onInitializeAttributes', '_onInitialize', '_onPostInitialize',
    '_onUpdate', '_onPostUpdate',
    '_callbacks', 'has', 'get', 'on', 'off', 'fire', 'once', 'hasEvent'
]);

/* eslint-disable jsdoc/no-undefined-types */
/**
 * @static
 * @function
 * @name createScript
 * @description Create and register a new {@link pc.ScriptType}.
 * It returns new class type (constructor function), which is auto-registered to {@link pc.ScriptRegistry} using it's name.
 * This is the main interface to create Script Types, to define custom logic using JavaScript, that is used to create interaction for entities.
 * @param {string} name - Unique Name of a Script Type.
 * If a Script Type with the same name has already been registered and the new one has a `swap` method defined in its prototype,
 * then it will perform hot swapping of existing Script Instances on entities using this new Script Type.
 * Note: There is a reserved list of names that cannot be used, such as list below as well as some starting from `_` (underscore):
 * system, entity, create, destroy, swap, move, scripts, onEnable, onDisable, onPostStateChange, has, on, off, fire, once, hasEvent.
 * @param {pc.Application} [app] - Optional application handler, to choose which {@link pc.ScriptRegistry} to add a script to.
 * By default it will use `pc.Application.getApplication()` to get current {@link pc.Application}.
 * @returns {Class<pc.ScriptType>} A class type (constructor function) that inherits {@link pc.ScriptType},
 * which the developer is meant to further extend by adding attributes and prototype methods.
 * @example
 * var Turning = pc.createScript('turn');
 *
 * // define `speed` attribute that is available in Editor UI
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
 */
/* eslint-enable jsdoc/no-undefined-types */
function createScript(name, app) {
    if (script.legacy) {
        // #ifdef DEBUG
        console.error("This project is using the legacy script system. You cannot call pc.createScript(). See: http://developer.playcanvas.com/en/user-manual/scripting/legacy/");
        // #endif
        return null;
    }

    if (reservedScriptNames.has(name))
        throw new Error('script name: \'' + name + '\' is reserved, please change script name');

    var scriptType = function (args) {
        ScriptType.call(this, args);
    };

    scriptType.prototype = Object.create(ScriptType.prototype);
    scriptType.prototype.constructor = scriptType;

    scriptType.extend = ScriptType.extend;
    scriptType.attributes = new ScriptAttributes(scriptType);

    registerScript(scriptType, name, app);
    return scriptType;
}

// Editor uses this - migrate to ScriptAttributes.reservedNames and delete this
var reservedAttributes = {};
ScriptAttributes.reservedNames.forEach((value, value2, set) => {
    reservedAttributes[value] = 1;
});
createScript.reservedAttributes = reservedAttributes;


/* eslint-disable jsdoc/no-undefined-types */
/* eslint-disable jsdoc/check-examples */
/**
 * @static
 * @function
 * @name registerScript
 * @description Register a existing class type as a Script Type to {@link pc.ScriptRegistry}.
 * Useful when defining a ES6 script class that extends {@link pc.ScriptType} (see example).
 * @param {Class<pc.ScriptType>} script - The existing class type (constructor function) to be registered as a Script Type.
 * Class must extend {@link pc.ScriptType} (see example). Please note: A class created using {@link pc.createScript} is auto-registered,
 * and should therefore not be pass into {@link pc.registerScript} (which would result in swapping out all related script instances).
 * @param {string} [name] - Optional unique name of the Script Type. By default it will use the same name as the existing class.
 * If a Script Type with the same name has already been registered and the new one has a `swap` method defined in its prototype,
 * then it will perform hot swapping of existing Script Instances on entities using this new Script Type.
 * Note: There is a reserved list of names that cannot be used, such as list below as well as some starting from `_` (underscore):
 * system, entity, create, destroy, swap, move, scripts, onEnable, onDisable, onPostStateChange, has, on, off, fire, once, hasEvent.
 * @param {pc.Application} [app] - Optional application handler, to choose which {@link pc.ScriptRegistry} to register the script type to.
 * By default it will use `pc.Application.getApplication()` to get current {@link pc.Application}.
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
 */
/* eslint-enable jsdoc/check-examples */
/* eslint-enable jsdoc/no-undefined-types */
function registerScript(script, name, app) {
    if (script.legacy) {
        // #ifdef DEBUG
        console.error("This project is using the legacy script system. You cannot call pc.registerScript(). See: http://developer.playcanvas.com/en/user-manual/scripting/legacy/");
        // #endif
        return;
    }

    if (typeof script !== 'function')
        throw new Error('script class: \'' + script + '\' must be a constructor function (i.e. class).');

    if (!(script.prototype instanceof ScriptType))
        throw new Error('script class: \'' + ScriptType.__getScriptName(script) + '\' does not extend pc.ScriptType.');

    name = name || script.__name || ScriptType.__getScriptName(script);

    if (reservedScriptNames.has(name))
        throw new Error('script name: \'' + name + '\' is reserved, please change script name');

    script.__name = name;

    // add to scripts registry
    var registry = app ? app.scripts : Application.getApplication().scripts;
    registry.add(script);

    ScriptHandler._push(script);
}

export { createScript, registerScript };
