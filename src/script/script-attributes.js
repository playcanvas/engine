import { Color } from '../core/color.js';

import { Curve } from '../math/curve.js';
import { CurveSet } from '../math/curve-set.js';
import { Vec2 } from '../math/vec2.js';
import { Vec3 } from '../math/vec3.js';
import { Vec4 } from '../math/vec4.js';

import { GraphNode } from '../scene/graph-node.js';

import { Asset } from '../asset/asset.js';

var components = ['x', 'y', 'z', 'w'];
var vecLookup = [undefined, undefined, Vec2, Vec3, Vec4];

var rawToValue = function (app, args, value, old) {
    var i;
    var j;

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
            var result = {};

            if (Array.isArray(args.schema)) {
                if (!value || typeof value !== 'object') {
                    value = {};
                }

                for (i = 0; i < args.schema.length; i++) {
                    var field = args.schema[i];
                    if (!field.name) continue;

                    if (field.array) {
                        result[field.name] = [];

                        var arr = Array.isArray(value[field.name]) ? value[field.name] : [];

                        for (j = 0; j < arr.length; j++) {
                            result[field.name].push(rawToValue(app, field, arr[j]));
                        }
                    } else {
                        // use the value of the field as it's passed into rawToValue otherwise
                        // use the default field value
                        var val = value.hasOwnProperty(field.name) ? value[field.name] : field.default;
                        result[field.name] = rawToValue(app, field, val);
                    }
                }
            }

            return result;
        case 'asset':
            if (value instanceof Asset) {
                return value;
            } else if (typeof value === 'number') {
                return app.assets.get(value) || null;
            } else if (typeof value === 'string') {
                return app.assets.get(parseInt(value, 10)) || null;
            }
            return null;
        case 'entity':
            if (value instanceof GraphNode) {
                return value;
            } else if (typeof value === 'string') {
                return app.getEntityFromIndex(value);
            }
            return null;
        case 'rgb':
        case 'rgba':
            if (value instanceof Color) {
                if (old instanceof Color) {
                    old.copy(value);
                    return old;
                }
                return value.clone();
            } else if (value instanceof Array && value.length >= 3 && value.length <= 4) {
                for (i = 0; i < value.length; i++) {
                    if (typeof value[i] !== 'number')
                        return null;
                }
                if (!old) old = new Color();

                old.r = value[0];
                old.g = value[1];
                old.b = value[2];
                old.a = (value.length === 3) ? 1 : value[3];

                return old;
            } else if (typeof value === 'string' && /#([0-9abcdef]{2}){3,4}/i.test(value)) {
                if (!old)
                    old = new Color();

                old.fromString(value);
                return old;
            }
            return null;
        case 'vec2':
        case 'vec3':
        case 'vec4':
            var len = parseInt(args.type.slice(3), 10);
            var vecType = vecLookup[len];

            if (value instanceof vecType) {
                if (old instanceof vecType) {
                    old.copy(value);
                    return old;
                }
                return value.clone();
            } else if (value instanceof Array && value.length === len) {
                for (i = 0; i < value.length; i++) {
                    if (typeof value[i] !== 'number')
                        return null;
                }
                if (!old) old = new vecType();

                for (i = 0; i < len; i++)
                    old[components[i]] = value[i];

                return old;
            }
            return null;
        case 'curve':
            if (value) {
                var curve;
                if (value instanceof Curve || value instanceof CurveSet) {
                    curve = value.clone();
                } else {
                    var CurveType = value.keys[0] instanceof Array ? CurveSet : Curve;
                    curve = new CurveType(value.keys);
                    curve.type = value.type;
                }
                return curve;
            }
            break;
    }

    return value;
};


/* eslint-disable jsdoc/no-undefined-types */
/**
 * @class
 * @name pc.ScriptAttributes
 * @classdesc Container of Script Attribute definitions. Implements an interface to add/remove attributes and store their definition for a {@link pc.ScriptType}.
 * Note: An instance of pc.ScriptAttributes is created automatically by each {@link pc.ScriptType}.
 * @param {Class<pc.ScriptType>} scriptType - Script Type that attributes relate to.
 */
/* eslint-enable jsdoc/no-undefined-types */
function ScriptAttributes(scriptType) {
    this.scriptType = scriptType;
    this.index = { };
}

ScriptAttributes.reservedNames = [
    'app', 'entity', 'enabled', '_enabled', '_enabledOld', '_destroyed',
    '__attributes', '__attributesRaw', '__scriptType', '__executionOrder',
    '_callbacks', 'has', 'get', 'on', 'off', 'fire', 'once', 'hasEvent'
].reduce((acc, curr) => (acc[curr] = 1, acc), {});

/**
 * @function
 * @name pc.ScriptAttributes#add
 * @description Add Attribute.
 * @param {string} name - Name of an attribute.
 * @param {object} args - Object with Arguments for an attribute.
 * @param {("boolean"|"number"|"string"|"json"|"asset"|"entity"|"rgb"|"rgba"|"vec2"|"vec3"|"vec4"|"curve")} args.type - Type of an attribute value.
 * @param {*} [args.default] - Default attribute value.
 * @param {string} [args.title] - Title for Editor's for field UI.
 * @param {string} [args.description] - Description for Editor's for field UI.
 * @param {string|string[]} [args.placeholder] - Placeholder for Editor's for field UI.
 * For multi-field types, such as vec2, vec3, and others use array of strings.
 * @param {boolean} [args.array] - If attribute can hold single or multiple values.
 * @param {number} [args.size] - If attribute is array, maximum number of values can be set.
 * @param {number} [args.min] - Minimum value for type 'number', if max and min defined, slider will be rendered in Editor's UI.
 * @param {number} [args.max] - Maximum value for type 'number', if max and min defined, slider will be rendered in Editor's UI.
 * @param {number} [args.precision] - Level of precision for field type 'number' with floating values.
 * @param {number} [args.step] - Step value for type 'number'. The amount used to increment the value when using the arrow keys in the Editor's UI.
 * @param {string} [args.assetType] - Name of asset type to be used in 'asset' type attribute picker in Editor's UI, defaults to '*' (all).
 * @param {string[]} [args.curves] - List of names for Curves for field type 'curve'.
 * @param {string} [args.color] - String of color channels for Curves for field type 'curve', can be any combination of `rgba` characters.
 * Defining this property will render Gradient in Editor's field UI.
 * @param {object[]} [args.enum] - List of fixed choices for field, defined as array of objects, where key in object is a title of an option.
 * @param {object[]} [args.schema] - List of attributes for type 'json'. Each attribute description is an object with the same properties as regular script attributes
 * but with an added 'name' field to specify the name of each attribute in the JSON.
 * @example
 * PlayerController.attributes.add('fullName', {
 *     type: 'string'
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
 *         { '32x32': 32 },
 *         { '64x64': 64 },
 *         { '128x128': 128 }
 *     ]
 * });
 * @example
 * PlayerController.attributes.add('config', {
 *     type: 'json',
 *     schema: [{
 *         name: 'speed',
 *         type: 'number',
 *         title: 'Speed',
 *         placeholder: 'km/h',
 *         default: 22.2
 *     }, {
 *         name: 'resolution',
 *         type: 'number',
 *         default: 32,
 *         enum: [
 *             { '32x32': 32 },
 *             { '64x64': 64 },
 *             { '128x128': 128 }
 *         ]
 *     }]
 * });
 */
ScriptAttributes.prototype.add = function (name, args) {
    if (this.index[name]) {
        // #ifdef DEBUG
        console.warn('attribute \'' + name + '\' is already defined for script type \'' + this.scriptType.name + '\'');
        // #endif
        return;
    } else if (ScripAttributes.reservedNames[name]) {
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
 * @param {string} name - Name of an attribute.
 * @returns {boolean} True if removed or false if not defined.
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
 * @param {string} name - Name of an attribute.
 * @returns {boolean} True if Attribute is defined.
 * @example
 * if (PlayerController.attributes.has('fullName')) {
 *     // attribute fullName is defined
 * }
 */
ScriptAttributes.prototype.has = function (name) {
    return !!this.index[name];
};

/**
 * @function
 * @name pc.ScriptAttributes#get
 * @description Get object with attribute arguments.
 * Note: Changing argument properties will not affect existing Script Instances.
 * @param {string} name - Name of an attribute.
 * @returns {?object} Arguments with attribute properties.
 * @example
 * // changing default value for an attribute 'fullName'
 * var attr = PlayerController.attributes.get('fullName');
 * if (attr) attr.default = 'Unknown';
 */
ScriptAttributes.prototype.get = function (name) {
    return this.index[name] || null;
};

export { ScriptAttributes };
