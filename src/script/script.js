pc.extend(pc, function () {
    var rawToValue = function(app, args, value, old) {
        // TODO scripts2
        // arrays
        switch(args.type) {
            case 'boolean':
                return !! value;
                break;
            case 'number':
                if (typeof(value) === 'number') {
                    return value;
                } else if (typeof(value) === 'string') {
                    var v = parseInt(value, 10);
                    if (isNaN(v)) return null;
                    return v;
                } else if (typeof(value) === 'boolean') {
                    return 0 + value;
                } else {
                    return null;
                }
                break;
            case 'json':
                if (typeof(value) === 'object') {
                    return value;
                } else {
                    try {
                        return JSON.parse(value);
                    } catch(ex) {
                        return null;
                    }
                }
                break;
            case 'asset':
                if (value instanceof pc.Asset) {
                    return value;
                } else if (typeof(value) === 'number') {
                    return app.assets.get(value) || null;
                } else if (typeof(value) === 'string') {
                    return app.assets.get(parseInt(value, 10)) || null;
                } else {
                    return null;
                }
                break;
            case 'entity':
                if (value instanceof pc.Entity) {
                    return value;
                } else if (typeof(value) === 'string') {
                    return app.root.findByGuid(value);
                } else {
                    return null;
                }
                break;
            case 'rgb':
            case 'rgba':
                if (value instanceof pc.Color) {
                    if (old instanceof pc.Color) {
                        old.copy(value);
                        return old;
                    } else {
                        return value;
                    }
                } else if (value instanceof Array && value.length >= 3 && value.length <= 4) {
                    for(var i = 0; i < value.length; i++) {
                        if (typeof(value[i]) !== 'number')
                            return null;
                    }
                    if (! old) old = new pc.Color();

                    for(var i = 0; i < 4; i++)
                        old.data[i] = (i === 4 && value.length === 3) ? 1 : value[i];

                    return old;
                } else if (typeof(value) === 'string' && /#([0-9abcdef]{2}){3,4}/i.test(value)) {
                    if (! old)
                        old = new pc.Color();

                    old.fromString(value);
                    return old;
                } else {
                    return null;
                }
                break;
            case 'vec2':
            case 'vec3':
            case 'vec4':
                var len = parseInt(args.type.slice(3), 10);

                if (value instanceof pc['Vec' + len]) {
                    if (old instanceof pc['Vec' + len]) {
                        old.copy(value);
                        return old;
                    } else {
                        return value;
                    }
                } else if (value instanceof Array && value.length === len) {
                    for(var i = 0; i < value.length; i++) {
                        if (typeof(value[i]) !== 'number')
                            return null;
                    }
                    if (! old) old = new pc['Vec' + len];

                    for(var i = 0; i < len; i++)
                        old.data[i] = value[i];

                    return old;
                } else {
                    return null;
                }
                break;
            case 'curve':
                // TODO scripts2
                // curves
                break;
        }

        return value;
    };


    /**
    * @name pc.ScriptAttributes
    * @class Container of Script Attributes definition
    * @description Implements an interface to add/remove attributes and store their definition for Script Object.
    * Note: This object is created automatically by each Script Object
    * @param {function} scriptObject Script Object that attributes relate to.
    */
    var ScriptAttributes = function(scriptObject) {
        this.scriptObject = scriptObject;
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
     * @param {String} [args.assetType] Name of asset type to be used in 'asset' type attribute picker in Editor's UI, defaults to '*' (all)
     * @param {Strings[]} [args.curves] List of names for Curves for field type 'curve'
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
    ScriptAttributes.prototype.add = function(name, args) {
        if (this.index[name]) {
            console.warn('attribute \'' + name + '\' is already defined for script object \'' + this.scriptObject.name + '\'');
            return;
        } else if (pc.Script.reservedAttributes[name]) {
            console.warn('attribute \'' + name + '\' is a reserved attribute name');
            return;
        }

        this.index[name] = args;

        Object.defineProperty(this.scriptObject.prototype, name, {
            get: function() {
                return this.__attributes[name];
            },
            set: function(raw) {
                var old = this.__attributes[name];

                // convert to appropriate type
                this.__attributes[name] = rawToValue(this.app, args, raw, old);

                this.fire('attr', name, this.__attributes[name], old);
                this.fire('attr:' + name, this.__attributes[name], old);
            }
        });
    };

    /**
     * @function
     * @name pc.ScriptAttributes#remove
     * @description Remove Attribute
     * @param {String} name Name of an attribute
     * @returns {Boolean} True if removed or false if not defined
     * @example
     * PlayerController.attributes.remove('fullName');
     */
    ScriptAttributes.prototype.remove = function(name) {
        if (! this.index[name])
            return false;

        delete this.index[name];
        delete this.scriptObject.prototype[name];
        return true;
    };

    /**
     * @function
     * @name pc.ScriptAttributes#has
     * @description Detect if Attribute is added
     * @param {String} name Name of an attribute
     * @returns {Boolean} True if Attribute is defined
     * @example
     * if (PlayerController.attributes.has('fullName')) {
     *     // attribute `fullName` is defined
     * });
     */
    ScriptAttributes.prototype.has = function(name) {
        return !! this.index[name];
    };

    /**
     * @function
     * @name pc.ScriptAttributes#get
     * @description Get object with attribute arguments.
     * Note: Changing argument properties will not affect existing Script Instances
     * @param {String} name Name of an attribute
     * @returns {?Object} Arguments with attribute properties
     * @example
     * // changing default value for an attribute 'fullName'
     * var attr = PlayerController.attributes.get('fullName');
     * if (attr) attr.default = 'Unknown';
     */
    ScriptAttributes.prototype.get = function(name) {
        return this.index[name] || null;
    };


    /**
    * @name pc.Script
    * @class Class to create named Script Objects.
    * It returns new class function "Script Object",
    * which is auto-registered to pc.ScriptRegistry using it's name.
    * @description This is main interface to create Script Objects,
    * to define custom logic using javascript, that is used to create interaction for entities
    * @param {String} name unique Name of a Script Object.
    * If same name will be used and Script Object has `swap` method defined in prototype,
    * then it will perform hot swapping of existing Script Instances on entities using this new Script Object
    * @param {pc.Application} [app] Optional application handler, to choose which pc.ScriptRegistry to add a script.
    * By default it will use `pc.Application.getApplication()` to get current pc.Application.
    * @returns {function} So called Script Object, that developer is meant to extend by adding attributes and prototype methods.
    */
    var Script = function (name, app) {
        /**
        * @name ScriptObject
        * @class Class that is returned by {@link pc.Script}. Also referred as Script Object
        * @description Script Object are the functions (classes) that are created using {@link pc.Script}.
        * And extended using attributes and prototype to define custom logic.
        * When instanced by engine, the object is referred as Script Instance.
        * Note: this class is created by using pc.Script.
        * Note: instances using this class are created by engine when script is added to {@link pc.ScriptComponent}
        */
        var script = function(args) {
            if (! args || ! args.app || ! args.entity)
                console.warn('script \'' + name + '\' has missing arguments in consructor');

            pc.events.attach(this);

            this.app = args.app;
            this.entity = args.entity;
            this._enabled = typeof(args.enabled) === 'boolean' ? args.enabled : true;
            this._enabledOld = this.enabled;
            this.__attributes = { };
            this.__attributesRaw = args.attributes || null;
        };

        /**
         * @readonly
         * @static
         * @name ScriptObject#name
         * @type String
         * @description Name of a Script Object.
         */
        Object.defineProperty(script, 'name', {
            value: name
        });

        /**
         * @readonly
         * @static
         * @name ScriptObject#attributes
         * @description The interface to define attributes for Script Objects.
         * Refer to {@link pc.ScriptAttributes}
         * @example
         * var PlayerController = new pc.Script('playerController');
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
        script.prototype.__initializeAttributes = function() {
            if (! this.__attributesRaw)
                return;

            // set attributes values
            for(var key in script.attributes.index) {
                if (this.__attributesRaw && this.__attributesRaw.hasOwnProperty(key)) {
                    this[key] = this.__attributesRaw[key];
                } else if (script.attributes.index[key].hasOwnProperty('default')) {
                    this[key] = script.attributes.index[key].default;
                } else {
                    // TODO scripts2
                    // set default value based on property type
                    this[key] = null;
                }
            }

            this.__attributesRaw = null;
        };

        /**
         * @readonly
         * @static
         * @function
         * @name ScriptObject#extend
         * @param {Object} methods Object with methods, where key - is name of method, and value - is function.
         * @description Shorthand function to extend Script Object prototype with list of methods.
         * @example
         * var PlayerController = new pc.Script('playerController');
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
        script.extend = function(methods) {
            for(var key in methods) {
                if (! methods.hasOwnProperty(key))
                    continue;

                script.prototype[key] = methods[key];
            }
        };

        /**
        * @name ScriptInstance
        * @class Instance of ScriptObject
        * @property {pc.Application} app Pointer to {@link pc.Application} that Script Instance belongs to.
        * @property {pc.Entity} entity Pointer to entity that Script Instance belongs to.
        * @property {Boolean} enabled True if Script Instance is in running state.
        * @description Script Instance is created by engine during script being created for {@link pc.ScriptComponent}
        */

        /**
        * @event
        * @name ScriptInstance#enabled
        * @description Fired when Script Instance becomes enabled
        * @example
        * PlayerController.prototype.initialize = function() {
        *     this.on('enabled', function() {
        *         // Script Instance is now enabled
        *     });
        * };
        */

        /**
        * @event
        * @name ScriptInstance#disabled
        * @description Fired when Script Instance becomes disabled
        * @example
        * PlayerController.prototype.initialize = function() {
        *     this.on('disabled', function() {
        *         // Script Instance is now disabled
        *     });
        * };
        */

        /**
        * @event
        * @name ScriptInstance#state
        * @description Fired when Script Instance changes state to enabled or disabled
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
        * @name ScriptInstance#destroy
        * @description Fired when Script Instance is destroyed and removed from component
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
        * @name ScriptInstance#attr
        * @description Fired when any script attribute been changed
        * @param {String} name Name of attribute changed
        * @param {} value New value
        * @param {} valueOld Old value
        * @example
        * PlayerController.prototype.initialize = function() {
        *     this.on('attr', function(name, value, valueOld) {
        *         console.log(name + ' been changed from ' + valueOld + ' to ' + value);
        *     });
        * };
        */

        /**
        * @event
        * @name ScriptInstance#attr:[name]
        * @description Fired when specific script attribute been changed
        * @param {} value New value
        * @param {} valueOld Old value
        * @example
        * PlayerController.prototype.initialize = function() {
        *     this.on('attr:speed', function(value, valueOld) {
        *         console.log('speed been changed from ' + valueOld + ' to ' + value);
        *     });
        * };
        */

        /**
         * @name ScriptInstance#enabled
         * @type Boolean
         * @description False when script will not be running, due to disabled state of any of: Entity (including any parents), ScriptComponent, ScriptInstance.
         * When disabled will not run any update methods on each tick.
         * initialize and postInitialize methods will run once when Script Instance is `enabled` during app tick.
         */
        Object.defineProperty(script.prototype, 'enabled', {
            get: function() {
                return this._enabled && this.entity.script.enabled && this.entity.enabled;
            },
            set: function(value) {
                if (this._enabled !== !! value)
                    this._enabled = !! value;

                if (this.enabled !== this._enabledOld) {
                    this._enabledOld = this.enabled;
                    this.fire(this.enabled ? 'enabled' : 'disabled');
                    this.fire('state', this.enabled);
                }
            }
        });

        // add to scripts registry
        var registry = app ? app.scripts : pc.Application.getApplication().scripts;
        registry.add(script);

        return script;
    };

    Script.reservedAttributes = {
        'enabled': 1,
        'entity': 1,
        'app': 1
    };

    return {
        Script: Script
    };
}());
