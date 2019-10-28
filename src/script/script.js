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
                    return app.getEntityFromIndex(value);
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
     * @classdesc Container of Script Attribute definitions. Implements an interface to add/remove attributes and store their definition for a {@link pc.ScriptType}.
     * Note: An instance of pc.ScriptAttributes is created automatically by each {@link pc.ScriptType}.
     * @param {pc.ScriptType} scriptType Script Type that attributes relate to.
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
     * @param {*} [args.default] Default attribute value
     * @param {String} [args.title] Title for Editor's for field UI
     * @param {String} [args.description] Description for Editor's for field UI
     * @param {String|String[]} [args.placeholder] Placeholder for Editor's for field UI.
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
     * @description Method to create named {@link pc.ScriptType}.
     * It returns new function (class) "Script Type", which is auto-registered to {@link pc.ScriptRegistry} using it's name.
     * This is the main interface to create Script Types, to define custom logic using JavaScript, that is used to create interaction for entities.
     * @param {String} name unique Name of a Script Type.
     * If a Script Type with the same name has already been registered and the new one has a `swap` method defined in its prototype,
     * then it will perform hot swapping of existing Script Instances on entities using this new Script Type.
     * Note: There is a reserved list of names that cannot be used, such as list below as well as some starting from `_` (underscore):
     * system, entity, create, destroy, swap, move, scripts, onEnable, onDisable, onPostStateChange, has, on, off, fire, once, hasEvent
     * @param {pc.Application} [app] Optional application handler, to choose which {@link pc.ScriptRegistry} to add a script to.
     * By default it will use `pc.Application.getApplication()` to get current {@link pc.Application}.
     * @returns {pc.ScriptType} The constructor of a {@link pc.ScriptType}, which the developer is meant to extend by adding attributes and prototype methods.
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

        var script = function (args) {
            pc.ScriptType.call(this, args);
        };

        script.prototype = Object.create(pc.ScriptType.prototype);

        script.__name = name;

        script.attributes = new ScriptAttributes(script);

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
