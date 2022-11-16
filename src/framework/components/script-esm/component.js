import { Component } from '../component.js';
import { METHOD_MAP } from './constants.js';

/** @typedef {import('./system.js').ScriptESMComponentSystem} ScriptESMComponentSystem */
/** @typedef {import('../../script/script-type.js').ScriptType} ScriptType */

/**
 * The ScriptESMComponent allows you to extend the functionality of an Entity by attaching your own
 * Script Types defined in JavaScript files to be executed with access to the Entity. For more
 * details on scripting see [Scripting](https://developer.playcanvas.com/user-manual/scripting/).
 *
 * @augments Component
 */
class ScriptESMComponent extends Component {
    /**
     * Create a new ScriptESMComponent instance.
     *
     * @param {ScriptESMComponentSystem} system - The ComponentSystem that created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        /**
         * Holds all script instances for this component.
         *
         * @type {any}
         * @private
         */
        this._scripts = {};
        // // holds all script instances with an update method
        // this._updateList = new SortedLoopArray({ sortBy: '__executionOrder' });
        // // holds all script instances with a postUpdate method
        // this._postUpdateList = new SortedLoopArray({ sortBy: '__executionOrder' });

        // this._scriptsIndex = {};
        // this._destroyedScripts = [];
        // this._destroyed = false;
        // this._scriptsData = null;
        // this._oldState = true;

        // override default 'enabled' property of base pc.Component
        // because this is faster
        this._enabled = true;

        // // whether this component is currently being enabled
        // this._beingEnabled = false;
        // // if true then we are currently looping through
        // // script instances. This is used to prevent a scripts array
        // // from being modified while a loop is being executed
        // this._isLoopingThroughScripts = false;

        // // the order that this component will be updated
        // // by the script system. This is set by the system itself.
        // this._executionOrder = -1;

        // this.on('set_enabled', this._onSetEnabled, this);
    }

    addScript(script) {
        this._scripts[script.constructor.name] = script;
    }

    createScript(scriptClass, attributes) {
        const script = new scriptClass({
            app: this.system.app,
            entity: this.entity
        }, attributes);
        this.addScript(script);
    }

    get(scriptName) {
        return this._scripts[scriptName];
    }

    has(scriptName) {
        return !!this._scripts[scriptName];
    }

    _callMethodForScripts(method, arg) {
        for (const script in this._scripts) {
            if (this._scripts[script][METHOD_MAP[method]]) {
                this._scripts[script][METHOD_MAP[method]](arg);
            }
        }
    }

    _onInitialize() {
    }

    _onUpdate(dt) {
        for (const script in this._scripts) {
            if (this._scripts[script].update) {
                this._scripts[script].update(dt);
            }
        }
    }
}

export { ScriptESMComponent };
