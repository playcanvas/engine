import { ScriptAttributes } from './script-attributes.js';
import { Script, getScriptName } from './script.js';

/**
 * This is the legacy format for creating PlayCanvas script using the `pc.createScript` function.
 * It is recommended to use the ES6 class format for creating scripts and extend the {@link Script} class
 *
 * @category Script
 */
class ScriptType extends Script {
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

    /** @private */
    __attributes;

    /** @private */
    __attributesRaw;

    /**
     * @param {{entity: import('../entity.js').Entity, app: import('../app-base.js').AppBase}} args -
     * The entity and app.
     * @protected
     */
    initScriptType(args) {

        // list for 'enable' and initialize attributes if not already initialized
        const onFirstEnable = () => {
            if (!this._initialized && this.enabled) {
                this.off('enable', onFirstEnable);
                this.__initializeAttributes(true);
            }
        };

        this.on('enable', onFirstEnable);

        Script.prototype.initScript.call(this, args);
        this.__attributes = { };
        this.__attributesRaw = args.attributes || { }; // need at least an empty object to make sure default attributes are initialized
    }

    /**
     * Name of a Script Type.
     *
     * @type {string}
     * @private
     */
    static __name = null; // Will be assigned when calling createScript or registerScript.

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
     * @param {*} constructorFn - The constructor function of the script type.
     * @returns {string} The script name.
     * @private
     */
    static __getScriptName = getScriptName;
}

export { ScriptType };
