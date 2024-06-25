import { Debug } from '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { Curve } from '../../core/math/curve.js';
import { CurveSet } from '../../core/math/curve-set.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Asset } from '../asset/asset.js';

const components = ['x', 'y', 'z', 'w'];
const vecLookup = [undefined, undefined, Vec2, Vec3, Vec4];

function rawToValue(app, args, value, old) {
    switch (args.type) {
        case 'boolean':
            return !!value;
        case 'number':
            if (typeof value === 'number') {
                return value;
            } else if (typeof value === 'string') {
                const v = parseInt(value, 10);
                if (isNaN(v)) return null;
                return v;
            } else if (typeof value === 'boolean') {
                return 0 + value;
            }
            return null;
        case 'json': {
            const result = {};

            if (Array.isArray(args.schema)) {
                if (!value || typeof value !== 'object') {
                    value = {};
                }

                for (let i = 0; i < args.schema.length; i++) {
                    const field = args.schema[i];
                    if (!field.name) continue;

                    if (field.array) {
                        result[field.name] = [];

                        const arr = Array.isArray(value[field.name]) ? value[field.name] : [];

                        for (let j = 0; j < arr.length; j++) {
                            result[field.name].push(rawToValue(app, field, arr[j]));
                        }
                    } else {
                        // use the value of the field as it's passed into rawToValue otherwise
                        // use the default field value
                        const val = value.hasOwnProperty(field.name) ? value[field.name] : field.default;
                        result[field.name] = rawToValue(app, field, val);
                    }
                }
            }

            return result;
        }
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
                for (let i = 0; i < value.length; i++) {
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
        case 'vec4': {
            const len = parseInt(args.type.slice(3), 10);
            const vecType = vecLookup[len];

            if (value instanceof vecType) {
                if (old instanceof vecType) {
                    old.copy(value);
                    return old;
                }
                return value.clone();
            } else if (value instanceof Array && value.length === len) {
                for (let i = 0; i < value.length; i++) {
                    if (typeof value[i] !== 'number')
                        return null;
                }
                if (!old) old = new vecType();

                for (let i = 0; i < len; i++)
                    old[components[i]] = value[i];

                return old;
            }
            return null;
        }
        case 'curve':
            if (value) {
                let curve;
                if (value instanceof Curve || value instanceof CurveSet) {
                    curve = value.clone();
                } else {
                    const CurveType = value.keys[0] instanceof Array ? CurveSet : Curve;
                    curve = new CurveType(value.keys);
                    curve.type = value.type;
                }
                return curve;
            }
            break;
    }

    return value;
}

/**
 * @typedef {Object} AttributeSchema
 * @property {"boolean"|"number"|"string"|"json"|"asset"|"entity"|"rgb"|"rgba"|"vec2"|"vec3"|"vec4"|"curve"} type - The Attribute type
 * @property {boolean} [array] - True if this attribute is an array of `type`
 */

/**
 * Takes an attribute schema, a value and current value, and return a new value.
 *
 * @param {import('../../framework/application.js').Application} app - The working application
 * @param {AttributeSchema} schema - The attribute schema used to resolve properties
 * @param {*} value - The raw value to create
 * @param {*} current - The existing value
 * @returns {*} The return value
 */
function attributeToValue(app, schema, value, current) {
    if (schema.array) {
        return value.map((item, index) => rawToValue(app, schema, item, current ? current[index] : null));
    }

    return rawToValue(app, schema, value, current);
}

/**
 * Assigns values to a script instance based on a map of attributes schemas
 * and a corresponding map of data.
 *
 * @param {import('../../framework/application.js').Application} app - The application instance
 * @param {Object<string, AttributeSchema>} attributeSchemaMap - A map of names to Schemas
 * @param {Object<string, *>} data - A Map of data to assign to the Script instance
 * @param {import('../../framework/script/script.js').Script} script - A Script instance to assign values on
 */
export function assignAttributesToScript(app, attributeSchemaMap, data, script) {

    if (!data) return;

    // Iterate over the schema and assign corresponding data
    for (const attributeName in attributeSchemaMap) {
        const attributeSchema = attributeSchemaMap[attributeName];
        const dataToAssign = data[attributeName];

        // Skip if the data is not defined
        if (dataToAssign === undefined) continue;

        // Assign the value to the script based on the attribute schema
        script[attributeName] =  attributeToValue(app, attributeSchema, dataToAssign, script[attributeName]);
    }
}

/**
 * Container of Script Attribute definitions. Implements an interface to add/remove attributes and
 * store their definition for a {@link ScriptType}. Note: An instance of ScriptAttributes is
 * created automatically by each {@link ScriptType}.
 *
 * @category Script
 */
class ScriptAttributes {
    static assignAttributesToScript = assignAttributesToScript;

    static attributeToValue = attributeToValue;

    /**
     * Create a new ScriptAttributes instance.
     *
     * @param {typeof import('./script-type.js').ScriptType} scriptType - Script Type that attributes relate to.
     */
    constructor(scriptType) {
        this.scriptType = scriptType;
        this.index = {};
    }

    static reservedNames = new Set([
        'app', 'entity', 'enabled', '_enabled', '_enabledOld', '_destroyed',
        '__attributes', '__attributesRaw', '__scriptType', '__executionOrder',
        '_callbacks', '_callbackActive', 'has', 'get', 'on', 'off', 'fire', 'once', 'hasEvent'
    ]);

    /**
     * Add Attribute.
     *
     * @param {string} name - Name of an attribute.
     * @param {object} args - Object with Arguments for an attribute.
     * @param {("boolean"|"number"|"string"|"json"|"asset"|"entity"|"rgb"|"rgba"|"vec2"|"vec3"|"vec4"|"curve")} args.type - Type
     * of an attribute value.  Can be:
     *
     * - "asset"
     * - "boolean"
     * - "curve"
     * - "entity"
     * - "json"
     * - "number"
     * - "rgb"
     * - "rgba"
     * - "string"
     * - "vec2"
     * - "vec3"
     * - "vec4"
     *
     * @param {*} [args.default] - Default attribute value.
     * @param {string} [args.title] - Title for Editor's for field UI.
     * @param {string} [args.description] - Description for Editor's for field UI.
     * @param {string|string[]} [args.placeholder] - Placeholder for Editor's for field UI.
     * For multi-field types, such as vec2, vec3, and others use array of strings.
     * @param {boolean} [args.array] - If attribute can hold single or multiple values.
     * @param {number} [args.size] - If attribute is array, maximum number of values can be set.
     * @param {number} [args.min] - Minimum value for type 'number', if max and min defined, slider
     * will be rendered in Editor's UI.
     * @param {number} [args.max] - Maximum value for type 'number', if max and min defined, slider
     * will be rendered in Editor's UI.
     * @param {number} [args.precision] - Level of precision for field type 'number' with floating
     * values.
     * @param {number} [args.step] - Step value for type 'number'. The amount used to increment the
     * value when using the arrow keys in the Editor's UI.
     * @param {string} [args.assetType] - Name of asset type to be used in 'asset' type attribute
     * picker in Editor's UI, defaults to '*' (all).
     * @param {string[]} [args.curves] - List of names for Curves for field type 'curve'.
     * @param {string} [args.color] - String of color channels for Curves for field type 'curve',
     * can be any combination of `rgba` characters. Defining this property will render Gradient in
     * Editor's field UI.
     * @param {object[]} [args.enum] - List of fixed choices for field, defined as array of objects,
     * where key in object is a title of an option.
     * @param {object[]} [args.schema] - List of attributes for type 'json'. Each attribute
     * description is an object with the same properties as regular script attributes but with an
     * added 'name' field to specify the name of each attribute in the JSON.
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
    add(name, args) {
        if (this.index[name]) {
            Debug.warn(`attribute '${name}' is already defined for script type '${this.scriptType.name}'`);
            return;
        } else if (ScriptAttributes.reservedNames.has(name)) {
            Debug.warn(`attribute '${name}' is a reserved attribute name`);
            return;
        }

        this.index[name] = args;

        Object.defineProperty(this.scriptType.prototype, name, {
            get: function () {
                return this.__attributes[name];
            },
            set: function (raw) {
                const evt = 'attr';
                const evtName = 'attr:' + name;

                const old = this.__attributes[name];
                // keep copy of old for the event below
                let oldCopy = old;
                // json types might have a 'clone' field in their
                // schema so make sure it's not that
                // entities should not be cloned as well
                if (old && args.type !== 'json' && args.type !== 'entity' && old.clone) {
                    // check if an event handler is there
                    // before cloning for performance
                    if (this.hasEvent(evt) || this.hasEvent(evtName)) {
                        oldCopy = old.clone();
                    }
                }

                // convert to appropriate type
                if (args.array) {
                    this.__attributes[name] = [];
                    if (raw) {
                        for (let i = 0, len = raw.length; i < len; i++) {
                            this.__attributes[name].push(rawToValue(this.app, args, raw[i], old ? old[i] : null));
                        }
                    }
                } else {
                    this.__attributes[name] = rawToValue(this.app, args, raw, old);
                }

                this.fire(evt, name, this.__attributes[name], oldCopy);
                this.fire(evtName, this.__attributes[name], oldCopy);
            }
        });
    }

    /**
     * Remove Attribute.
     *
     * @param {string} name - Name of an attribute.
     * @returns {boolean} True if removed or false if not defined.
     * @example
     * PlayerController.attributes.remove('fullName');
     */
    remove(name) {
        if (!this.index[name])
            return false;

        delete this.index[name];
        delete this.scriptType.prototype[name];
        return true;
    }

    /**
     * Detect if Attribute is added.
     *
     * @param {string} name - Name of an attribute.
     * @returns {boolean} True if Attribute is defined.
     * @example
     * if (PlayerController.attributes.has('fullName')) {
     *     // attribute fullName is defined
     * }
     */
    has(name) {
        return !!this.index[name];
    }

    /**
     * Get object with attribute arguments. Note: Changing argument properties will not affect
     * existing Script Instances.
     *
     * @param {string} name - Name of an attribute.
     * @returns {?object} Arguments with attribute properties.
     * @example
     * // changing default value for an attribute 'fullName'
     * var attr = PlayerController.attributes.get('fullName');
     * if (attr) attr.default = 'Unknown';
     */
    get(name) {
        return this.index[name] || null;
    }
}

export { ScriptAttributes };
