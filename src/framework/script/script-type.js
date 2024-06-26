import { ScriptAttributes } from './script-attributes.js';
import { Script } from './script.js';

/**
 * This is the legacy format for creating PlayCanvas script returned when calling `pc.createScript()`.
 * You should not use this inherit from this class directly.
 *
 * @deprecated Use {@link Script} instead.
 * @category Script
 */
class ScriptType extends Script {
    /** @private */
    __attributes;

    /** @private */
    __attributesRaw;

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
     * @param {*} args - initialization arguments
     * @protected
     */
    initScript(args) {
        // super does not exist due to the way the class is instantiated
        Script.prototype.initScript.call(this, args);
        this.__attributes = { };
        this.__attributesRaw = args.attributes || { }; // need at least an empty object to make sure default attributes are initialized
    }

    /**
     * Expose initScript as initScriptType for backwards compatibility
     * @param {*} args - Initialization arguments
     * @protected
     */
    initScriptType(args) {
        this.initScript(args);
    }

    /**
     * @param {boolean} [force] - Set to true to force initialization of the attributes.
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
}

export { ScriptType };
