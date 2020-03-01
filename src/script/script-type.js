Object.assign(pc, function () {
    /**
     * @class
     * @name pc.ScriptType
     * @augments pc.EventHandler
     * @classdesc Represents the type of a script. It is returned by {@link pc.createScript}.
     * Also referred to as Script Type.
     *
     * The type is to be extended using its JavaScript prototype. There is a **list of methods**
     * that will be executed by the engine on instances of this type, such as:
     *
     * * initialize
     * * postInitialize
     * * update
     * * postUpdate
     * * swap
     *
     * **initialize** and **postInitialize** - are called if defined when script is about to run
     * for the first time - postInitialize will run after all initialize methods are executed in
     * the same tick or enabling chain of actions.
     *
     * **update** and **postUpdate** - methods are called if defined for enabled (running state)
     * scripts on each tick.
     *
     * **swap** - This method will be called when a {@link pc.ScriptType} that already exists in
     * the registry gets redefined. If the new {@link pc.ScriptType} has a `swap` method in its
     * prototype, then it will be executed to perform hot-reload at runtime.
     * @property {pc.Application} app The {@link pc.Application} that the instance of this type
     * belongs to.
     * @property {pc.Entity} entity The {@link pc.Entity} that the instance of this type belongs to.
     * @property {boolean} enabled True if the instance of this type is in running state. False
     * when script is not running, because the Entity or any of its parents are disabled or the
     * Script Component is disabled or the Script Instance is disabled. When disabled no update
     * methods will be called on each tick. initialize and postInitialize methods will run once
     * when the script instance is in `enabled` state during app tick.
     * @param {object} args - The input arguments object
     * @param {pc.Application} args.app - The {@link pc.Application} that is running the script
     * @param {pc.Entity} args.entity - The {@link pc.Entity} that the script is attached to
     *
     */
    var ScriptType = function (args) {
        pc.EventHandler.call(this);

        // #ifdef DEBUG
        if (!args || !args.app || !args.entity) {
            console.warn('script \'' + name + '\' has missing arguments in constructor');
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
    };
    ScriptType.prototype = Object.create(pc.EventHandler.prototype);
    ScriptType.prototype.constructor = ScriptType;

    /**
     * @private
     * @readonly
     * @static
     * @name pc.ScriptType.__name
     * @type {string}
     * @description Name of a Script Type.
     */
    ScriptType.__name = name;

    /**
     * @field
     * @static
     * @readonly
     * @name pc.ScriptType#attributes
     * @type {pc.ScriptAttributes}
     * @description The interface to define attributes for Script Types. Refer to {@link pc.ScriptAttributes}.
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
    ScriptType.attributes = new pc.ScriptAttributes(ScriptType);

    // initialize attributes
    ScriptType.prototype.__initializeAttributes = function (force) {
        if (!force && !this.__attributesRaw)
            return;

        // set attributes values
        for (var key in ScriptType.attributes.index) {
            if (this.__attributesRaw && this.__attributesRaw.hasOwnProperty(key)) {
                this[key] = this.__attributesRaw[key];
            } else if (!this.__attributes.hasOwnProperty(key)) {
                if (ScriptType.attributes.index[key].hasOwnProperty('default')) {
                    this[key] = ScriptType.attributes.index[key].default;
                } else {
                    this[key] = null;
                }
            }
        }

        this.__attributesRaw = null;
    };

    /**
     * @readonly
     * @static
     * @function
     * @name pc.ScriptType.extend
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
    ScriptType.extend = function (methods) {
        for (var key in methods) {
            if (!methods.hasOwnProperty(key))
                continue;

            ScriptType.prototype[key] = methods[key];
        }
    };

    /**
     * @function
     * @name pc.ScriptType#[initialize]
     * @description Called when script is about to run for the first time.
     */

    /**
     * @function
     * @name pc.ScriptType#[postInitialize]
     * @description Called after all initialize methods are executed in the same tick or enabling chain of actions.
     */

    /**
     * @function
     * @name pc.ScriptType#[update]
     * @description Called for enabled (running state) scripts on each tick.
     * @param {number} dt - The delta time in seconds since the last frame.
     */

    /**
     * @function
     * @name pc.ScriptType#[postUpdate]
     * @description Called for enabled (running state) scripts on each tick, after update.
     * @param {number} dt - The delta time in seconds since the last frame.
     */

    /**
     * @function
     * @name pc.ScriptType#[swap]
     * @description Called when a ScriptType that already exists in the registry
     * gets redefined. If the new ScriptType has a `swap` method in its prototype,
     * then it will be executed to perform hot-reload at runtime.
     */

    /**
     * @event
     * @name pc.ScriptType#enable
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
     * @name pc.ScriptType#disable
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
     * @name pc.ScriptType#state
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
     * @name pc.ScriptType#destroy
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
     * @name pc.ScriptType#attr
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
     * @name pc.ScriptType#attr:[name]
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
     * @name pc.ScriptType#error
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

    Object.defineProperty(ScriptType.prototype, 'enabled', {
        get: function () {
            return this._enabled && !this._destroyed && this.entity.script.enabled && this.entity.enabled;
        },
        set: function (value) {
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
                    this.entity.script._scriptMethod(this, pc.ScriptComponent.scriptMethods.initialize);
            }

            // post initialize script if not post initialized yet and still enabled
            // (initilize might have disabled the script so check this.enabled again)
            // Warning: Do not do this if the script component is currently being enabled
            // because in this case post initialize must be called after all the scripts
            // in the script component have been initialized first
            if (this._initialized && !this._postInitialized && this.enabled && !this.entity.script._beingEnabled) {
                this._postInitialized = true;

                if (this.postInitialize)
                    this.entity.script._scriptMethod(this, pc.ScriptComponent.scriptMethods.postInitialize);
            }
        }
    });

    return {
        ScriptType: ScriptType
    };
}());
