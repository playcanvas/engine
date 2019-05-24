Object.assign(pc, function () {
    var components = ['x', 'y', 'z', 'w'];

    var rawToValue = function (app, args, value, old) {
        var i;

        switch (args.type) {
            case 'boolean':
                return !!value;
            case 'number':
                if (typeof value === 'number') {
                    return value;
                } else if (typeof value === 'string') {
                    var v = parseInt(value, 10);
                    if (isNaN(v)) return null;
                    return v;
                } else if (typeof value === 'boolean') {
                    return 0 + value;
                }
                return null;
            case 'json':
                if (typeof value === 'object') {
                    return value;
                }
                try {
                    return JSON.parse(value);
                } catch (ex) {
                    return null;
                }
            case 'asset':
                if (value instanceof pc.Asset) {
                    return value;
                } else if (typeof value === 'number') {
                    return app.assets.get(value) || null;
                } else if (typeof value === 'string') {
                    return app.assets.get(parseInt(value, 10)) || null;
                }
                return null;
            case 'entity':
                if (value instanceof pc.GraphNode) {
                    return value;
                } else if (typeof value === 'string') {
                    return app.root.findByGuid(value);
                }
                return null;
            case 'rgb':
            case 'rgba':
                if (value instanceof pc.Color) {
                    if (old instanceof pc.Color) {
                        old.copy(value);
                        return old;
                    }
                    return value.clone();
                } else if (value instanceof Array && value.length >= 3 && value.length <= 4) {
                    for (i = 0; i < value.length; i++) {
                        if (typeof value[i] !== 'number')
                            return null;
                    }
                    if (!old) old = new pc.Color();

                    old.r = value[0];
                    old.g = value[1];
                    old.b = value[2];
                    old.a = (value.length === 3) ? 1 : value[3];

                    return old;
                } else if (typeof value === 'string' && /#([0-9abcdef]{2}){3,4}/i.test(value)) {
                    if (!old)
                        old = new pc.Color();

                    old.fromString(value);
                    return old;
                }
                return null;
            case 'vec2':
            case 'vec3':
            case 'vec4':
                var len = parseInt(args.type.slice(3), 10);

                if (value instanceof pc['Vec' + len]) {
                    if (old instanceof pc['Vec' + len]) {
                        old.copy(value);
                        return old;
                    }
                    return value.clone();
                } else if (value instanceof Array && value.length === len) {
                    for (i = 0; i < value.length; i++) {
                        if (typeof value[i] !== 'number')
                            return null;
                    }
                    if (!old) old = new pc['Vec' + len]();

                    for (i = 0; i < len; i++)
                        old[components[i]] = value[i];

                    return old;
                }
                return null;
            case 'curve':
                if (value) {
                    var curve;
                    if (value instanceof pc.Curve || value instanceof pc.CurveSet) {
                        curve = value.clone();
                    } else {
                        var CurveType = value.keys[0] instanceof Array ? pc.CurveSet : pc.Curve;
                        curve = new CurveType(value.keys);
                        curve.type = value.type;
                    }
                    return curve;
                }
                break;
        }

        return value;
    };


    /**
     * @constructor
     * @name pc.ScriptAttributes
     * @classdesc Container of Script Attribute definitions. Implements an interface to add/remove attributes and store their definition for a {@link ScriptType}.
     * Note: An instance of pc.ScriptAttributes is created automatically by each {@link ScriptType}.
     * @param {ScriptType} scriptType Script Type that attributes relate to.
     */
    var ScriptAttributes = function (scriptType) {
        this.scriptType = scriptType;
        this.index = { };
    };

    /**
     * @function
     * @name pc.ScriptAttributes#add
     * @description Add Attribute
     * @param {String} name Name of an attribute
     * @param {Object} args Object with Arguments for an attribute
     * @param {String} args.type Type of an attribute value, list of possible types:
     * boolean, number, string, json, asset, entity, rgb, rgba, vec2, vec3, vec4, curve
     * @param {?} [args.default] Default attribute value
     * @param {String} [args.title] Title for Editor's for field UI
     * @param {String} [args.description] Description for Editor's for field UI
     * @param {(String|String[])} [args.placeholder] Placeholder for Editor's for field UI.
     * For multi-field types, such as vec2, vec3, and others use array of strings.
     * @param {Boolean} [args.array] If attribute can hold single or multiple values
     * @param {Number} [args.size] If attribute is array, maximum number of values can be set
     * @param {Number} [args.min] Minimum value for type 'number', if max and min defined, slider will be rendered in Editor's UI
     * @param {Number} [args.max] Maximum value for type 'number', if max and min defined, slider will be rendered in Editor's UI
     * @param {Number} [args.precision] Level of precision for field type 'number' with floating values
     * @param {Number} [args.step] Step value for type 'number'. The amount used to increment the value when using the arrow keys in the Editor's UI.
     * @param {String} [args.assetType] Name of asset type to be used in 'asset' type attribute picker in Editor's UI, defaults to '*' (all)
     * @param {String[]} [args.curves] List of names for Curves for field type 'curve'
     * @param {String} [args.color] String of color channels for Curves for field type 'curve', can be any combination of `rgba` characters.
     * Defining this property will render Gradient in Editor's field UI
     * @param {Object[]} [args.enum] List of fixed choices for field, defined as array of objects, where key in object is a title of an option
     * @example
     * PlayerController.attributes.add('fullName', {
     *     type: 'string',
     * });
     * @example
     * PlayerController.attributes.add('speed', {
     *     type: 'number',
     *     title: 'Speed',
     *     placeholder: 'km/h',
     *     default: 22.2
     * });
     * @example
     * PlayerController.attributes.add('resolution', {
     *     type: 'number',
     *     default: 32,
     *     enum: [
     *        { '32x32': 32 },
     *        { '64x64': 64 },
     *        { '128x128': 128 }
     *     ]
     * });
     */
    ScriptAttributes.prototype.add = function (name, args) {
        if (this.index[name]) {
            // #ifdef DEBUG
            console.warn('attribute \'' + name + '\' is already defined for script type \'' + this.scriptType.name + '\'');
            // #endif
            return;
        } else if (pc.createScript.reservedAttributes[name]) {
            // #ifdef DEBUG
            console.warn('attribute \'' + name + '\' is a reserved attribute name');
            // #endif
            return;
        }

        this.index[name] = args;

        Object.defineProperty(this.scriptType.prototype, name, {
            get: function () {
                return this.__attributes[name];
            },
            set: function (raw) {
                var old = this.__attributes[name];

                // convert to appropriate type
                if (args.array) {
                    this.__attributes[name] = [];
                    if (raw) {
                        var i;
                        var len;
                        for (i = 0, len = raw.length; i < len; i++) {
                            this.__attributes[name].push(rawToValue(this.app, args, raw[i], old ? old[i] : null));
                        }
                    }
                } else {
                    this.__attributes[name] = rawToValue(this.app, args, raw, old);
                }

                this.fire('attr', name, this.__attributes[name], old);
                this.fire('attr:' + name, this.__attributes[name], old);
            }
        });
    };

    /**
     * @function
     * @name pc.ScriptAttributes#remove
     * @description Remove Attribute.
     * @param {String} name Name of an attribute
     * @returns {Boolean} True if removed or false if not defined
     * @example
     * PlayerController.attributes.remove('fullName');
     */
    ScriptAttributes.prototype.remove = function (name) {
        if (!this.index[name])
            return false;

        delete this.index[name];
        delete this.scriptType.prototype[name];
        return true;
    };

    /**
     * @function
     * @name pc.ScriptAttributes#has
     * @description Detect if Attribute is added.
     * @param {String} name Name of an attribute
     * @returns {Boolean} True if Attribute is defined
     * @example
     * if (PlayerController.attributes.has('fullName')) {
     *     // attribute `fullName` is defined
     * });
     */
    ScriptAttributes.prototype.has = function (name) {
        return !!this.index[name];
    };

    /**
     * @function
     * @name pc.ScriptAttributes#get
     * @description Get object with attribute arguments.
     * Note: Changing argument properties will not affect existing Script Instances.
     * @param {String} name Name of an attribute
     * @returns {?Object} Arguments with attribute properties
     * @example
     * // changing default value for an attribute 'fullName'
     * var attr = PlayerController.attributes.get('fullName');
     * if (attr) attr.default = 'Unknown';
     */
    ScriptAttributes.prototype.get = function (name) {
        return this.index[name] || null;
    };


    /**
     * @static
     * @function
     * @name pc.createScript
     * @description Method to create named {@link ScriptType}.
     * It returns new function (class) "Script Type", which is auto-registered to {@link pc.ScriptRegistry} using it's name.
     * This is the main interface to create Script Types, to define custom logic using JavaScript, that is used to create interaction for entities.
     * @param {String} name unique Name of a Script Type.
     * If a Script Type with the same name has already been registered and the new one has a `swap` method defined in its prototype,
     * then it will perform hot swapping of existing Script Instances on entities using this new Script Type.
     * Note: There is a reserved list of names that cannot be used, such as list below as well as some starting from `_` (underscore):
     * system, entity, create, destroy, swap, move, scripts, onEnable, onDisable, onPostStateChange, has, on, off, fire, once, hasEvent
     * @param {pc.Application} [app] Optional application handler, to choose which {@link pc.ScriptRegistry} to add a script to.
     * By default it will use `pc.Application.getApplication()` to get current {@link pc.Application}.
     * @returns {Function} The constructor of a {@link ScriptType}, which the developer is meant to extend by adding attributes and prototype methods.
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
     * Turning.prototype.update = function(dt) {
     *     this.entity.rotate(0, this.speed * dt, 0);
     * };
     */
    var createScript = function (name, app) {
        if (pc.script.legacy) {
            // #ifdef DEBUG
            console.error("This project is using the legacy script system. You cannot call pc.createScript(). See: http://developer.playcanvas.com/en/user-manual/scripting/legacy/");
            // #endif
            return null;
        }

        if (createScript.reservedScripts[name])
            throw new Error('script name: \'' + name + '\' is reserved, please change script name');

        /**
         * @constructor
         * @name ScriptType
         * @classdesc Represents the type of a script. It is returned by {@link pc.createScript}. Also referred to as Script Type.<br />
         * The type is to be extended using its JavaScript prototype. There is a <strong>list of methods</strong>
         * that will be executed by the engine on instances of this type, such as: <ul><li>initialize</li><li>postInitialize</li><li>update</li><li>postUpdate</li><li>swap</li></ul>
         * <strong>initialize</strong> and <strong>postInitialize</strong> - are called if defined when script is about to run for the first time - postInitialize will run after all initialize methods are executed in the same tick or enabling chain of actions.<br />
         * <strong>update</strong> and <strong>postUpdate</strong> - methods are called if defined for enabled (running state) scripts on each tick.<br />
         * <strong>swap</strong> - This method will be called when a {@link ScriptType} that already exists in the registry gets redefined.
         * If the new {@link ScriptType} has a `swap` method in its prototype, then it will be executed to perform hot-reload at runtime.
         * @property {pc.Application} app The {@link pc.Application} that the instance of this type belongs to.
         * @property {pc.Entity} entity The {@link pc.Entity} that the instance of this type belongs to.
         * @property {Boolean} enabled True if the instance of this type is in running state. False when script is not running,
         * because the Entity or any of its parents are disabled or the Script Component is disabled or the Script Instance is disabled.
         * When disabled no update methods will be called on each tick.
         * initialize and postInitialize methods will run once when the script instance is in `enabled` state during app tick.
         * @param {Object} args The input arguments object
         * @param {Object} args.app The {@link pc.Application} that is running the script
         * @param {Object} args.entity The {@link pc.Entity} that the script is attached to
         *
         */
        var script = function (args) {
            // #ifdef DEBUG
            if (!args || !args.app || !args.entity) {
                console.warn('script \'' + name + '\' has missing arguments in constructor');
            }
            // #endif

            pc.events.attach(this);

            this.app = args.app;
            this.entity = args.entity;
            this._enabled = typeof args.enabled === 'boolean' ? args.enabled : true;
            this._enabledOld = this.enabled;
            this.__destroyed = false;
            this.__attributes = { };
            this.__attributesRaw = args.attributes || null;
            this.__scriptType = script;

            // the order in the script component that the
            // methods of this script instance will run relative to
            // other script instances in the component
            this.__executionOrder = -1;
        };

        /**
         * @private
         * @readonly
         * @static
         * @name ScriptType.__name
         * @type String
         * @description Name of a Script Type.
         */
        script.__name = name;

        /**
         * @field
         * @static
         * @readonly
         * @type pc.ScriptAttributes
         * @name ScriptType.attributes
         * @description The interface to define attributes for Script Types. Refer to {@link pc.ScriptAttributes}
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
        script.attributes = new ScriptAttributes(script);

        // initialize attributes
        script.prototype.__initializeAttributes = function (force) {
            if (!force && !this.__attributesRaw)
                return;

            // set attributes values
            for (var key in script.attributes.index) {
                if (this.__attributesRaw && this.__attributesRaw.hasOwnProperty(key)) {
                    this[key] = this.__attributesRaw[key];
                } else if (!this.__attributes.hasOwnProperty(key)) {
                    if (script.attributes.index[key].hasOwnProperty('default')) {
                        this[key] = script.attributes.index[key].default;
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
         * @name ScriptType.extend
         * @param {Object} methods Object with methods, where key - is name of method, and value - is function.
         * @description Shorthand function to extend Script Type prototype with list of methods.
         * @example
         * var PlayerController = pc.createScript('playerController');
         *
         * PlayerController.extend({
         *     initialize: function() {
         *         // called once on initialize
         *     },
         *     update: function(dt) {
         *         // called each tick
         *     }
         * })
         */
        script.extend = function (methods) {
            for (var key in methods) {
                if (!methods.hasOwnProperty(key))
                    continue;

                script.prototype[key] = methods[key];
            }
        };

        /**
         * @event
         * @name ScriptType#enable
         * @description Fired when a script instance becomes enabled
         * @example
         * PlayerController.prototype.initialize = function() {
         *     this.on('enable', function() {
         *         // Script Instance is now enabled
         *     });
         * };
         */

        /**
         * @event
         * @name ScriptType#disable
         * @description Fired when a script instance becomes disabled
         * @example
         * PlayerController.prototype.initialize = function() {
         *     this.on('disable', function() {
         *         // Script Instance is now disabled
         *     });
         * };
         */

        /**
         * @event
         * @name ScriptType#state
         * @description Fired when a script instance changes state to enabled or disabled
         * @param {Boolean} enabled True if now enabled, False if disabled
         * @example
         * PlayerController.prototype.initialize = function() {
         *     this.on('state', function(enabled) {
         *         console.log('Script Instance is now ' + (enabled ? 'enabled' : 'disabled'));
         *     });
         * };
         */

        /**
         * @event
         * @name ScriptType#destroy
         * @description Fired when a script instance is destroyed and removed from component
         * @example
         * PlayerController.prototype.initialize = function() {
         *     this.on('destroy', function() {
         *         // no more part of an entity
         *         // good place to cleanup entity from destroyed script
         *     });
         * };
         */

        /**
         * @event
         * @name ScriptType#attr
         * @description Fired when any script attribute has been changed
         * @param {String} name Name of attribute
         * @param {Object} value New value
         * @param {Object} valueOld Old value
         * @example
         * PlayerController.prototype.initialize = function() {
         *     this.on('attr', function(name, value, valueOld) {
         *         console.log(name + ' been changed from ' + valueOld + ' to ' + value);
         *     });
         * };
         */

        /**
         * @event
         * @name ScriptType#attr:[name]
         * @description Fired when a specific script attribute has been changed
         * @param {Object} value New value
         * @param {Object} valueOld Old value
         * @example
         * PlayerController.prototype.initialize = function() {
         *     this.on('attr:speed', function(value, valueOld) {
         *         console.log('speed been changed from ' + valueOld + ' to ' + value);
         *     });
         * };
         */

        /**
         * @event
         * @name ScriptType#error
         * @description Fired when a script instance had an exception. The script instance will be automatically disabled.
         * @param {Error} err Native JavaScript Error object with details of error
         * @param {String} method The method of the script instance that the exception originated from.
         * @example
         * PlayerController.prototype.initialize = function() {
         *     this.on('error', function(err, method) {
         *         // caught an exception
         *         console.log(err.stack);
         *     });
         * };
         */

        Object.defineProperty(script.prototype, 'enabled', {
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

        // add to scripts registry
        var registry = app ? app.scripts : pc.Application.getApplication().scripts;
        registry.add(script);

        pc.ScriptHandler._push(script);

        return script;
    };

    // reserved scripts
    createScript.reservedScripts = [
        'system', 'entity', 'create', 'destroy', 'swap', 'move',
        'scripts', '_scripts', '_scriptsIndex', '_scriptsData',
        'enabled', '_oldState', 'onEnable', 'onDisable', 'onPostStateChange',
        '_onSetEnabled', '_checkState', '_onBeforeRemove',
        '_onInitializeAttributes', '_onInitialize', '_onPostInitialize',
        '_onUpdate', '_onPostUpdate',
        '_callbacks', 'has', 'on', 'off', 'fire', 'once', 'hasEvent'
    ];
    var reservedScripts = { };
    var i;
    for (i = 0; i < createScript.reservedScripts.length; i++)
        reservedScripts[createScript.reservedScripts[i]] = 1;
    createScript.reservedScripts = reservedScripts;


    // reserved script attribute names
    createScript.reservedAttributes = [
        'app', 'entity', 'enabled', '_enabled', '_enabledOld', '_destroyed',
        '__attributes', '__attributesRaw', '__scriptType', '__executionOrder',
        '_callbacks', 'has', 'on', 'off', 'fire', 'once', 'hasEvent'
    ];
    var reservedAttributes = { };
    for (i = 0; i < createScript.reservedAttributes.length; i++)
        reservedAttributes[createScript.reservedAttributes[i]] = 1;
    createScript.reservedAttributes = reservedAttributes;


    return {
        createScript: createScript
    };
}());
