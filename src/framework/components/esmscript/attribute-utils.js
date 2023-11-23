import { Color } from "../../../core/math/color.js";
import { Curve } from "../../../core/math/curve.js";
import { CurveSet } from "../../../core/math/curve-set.js";
import { Vec2 } from "../../../core/math/vec2.js";
import { Vec3 } from "../../../core/math/vec3.js";
import { Vec4 } from "../../../core/math/vec4.js";
import { Asset } from "../../../framework/asset/asset.js";
import { GraphNode } from "../../../scene/graph-node.js";

/**
 * @callback UpdateFunction
 * @param {number} dt - The time since the last update.
 * @ignore
 */

/**
 * @callback SwapFunction
 * @param {Object} newState - The new state to swap to.
 * @ignore
 */

/**
 * @typedef {Object} ModuleInstance
 * @property {Function} [active] - A function called when the module becomes active
 * @property {Function} [inactive] - A function called when the module becomes inactive
 * @property {UpdateFunction} [update] - A function called on game tick if the module is enabled
 * @property {Function} [destroy] - A function called when the module should be destroyed
 */

/**
 * This type represents a generic class constructor.
 * @typedef {Function} ModuleClass
 */

/**
 * @typedef {Object|Map} AttributeDefinition
 * @property {'asset'|'boolean'|'curve'|'entity'|'json'|'number'|'rgb'|'rgba'|'string'|'vec2'|'vec3'|'vec4'} type - The attribute type
 */

/**
 * The expected output of an ESM Script file. It contains the class definition and the attributes it requires.
 * @typedef {Object} ModuleExport
 * @property {ModuleClass} default - The default export of a esm script that defines a class
 * @property {Object.<string, AttributeDefinition>} attributes - An object containing the names of attributes and their definitions;
 */

/**
 * A list of valid attribute types
 * @ignore
 */
const VALID_ATTR_TYPES = new Set([
    "asset",
    "boolean",
    "curve",
    "entity",
    "json",
    "number",
    "rgb",
    "rgba",
    "string",
    "vec2",
    "vec3",
    "vec4"
]);

/**
 * For any given attribute definition returns whether it conforms to the required
 * shape of an attribute definition.
 *
 * @param {AttributeDefinition|object} attributeDefinition - The attribute to check
 * @returns {boolean} True if the object can be treated as a attribute definition
 * @example
 * isValidAttributeDefinition({ type: 'entity' }); // true
 * isValidAttributeDefinition({ type: 'invalidType' }); // false
 * isValidAttributeDefinition({ x: 'y' }); // false
 */
export const isValidAttributeDefinition = (attributeDefinition) => {
    return attributeDefinition && VALID_ATTR_TYPES.has(attributeDefinition.type);
};

/**
 * A reducer function that recursively iterates over an attribute definition,
 * performing a callback for each valid entry and accumulating the result.
 * Useful for copying, merging or assigning attributes onto an object
 *
 * @param {AttributeDefinitionDict} attributeDefDict - The set of attribute definitions to iterate over
 * @param {Object} attributes - An associated map of attribute values
 * @param {Function} callback - Called per attribute definition with (object, key, attributeDefinition, value)
 * @param {Object} [object] - the object to assign them to
 * @returns {Object} The accumulated result
 */
export const reduceAttributeDefinition = (attributeDefDict, attributes, callback, object = {}) => {

    const attributeDefEntries = Object.entries(attributeDefDict);

    return attributeDefEntries.reduce((nestedObject, [attributeName, attributeDefinition]) => {

        // early out if the attribute already exists.
        if (nestedObject.hasOwnProperty(attributeName)) return nestedObject;

        // Check if it's a valid attribute definition and not already defined
        if (isValidAttributeDefinition(attributeDefinition)) {

            // Return the attributes value if it exists, otherwise, use the 'default' value
            const value = attributes?.hasOwnProperty(attributeName) ?
                attributes[attributeName] :
                attributeDefinition.default;

            // perform the callback
            callback(nestedObject, attributeName, attributeDefinition, value);

        } else if (typeof attributeDefinition === 'object') {

            nestedObject[attributeName] = reduceAttributeDefinition(
                attributeDefinition,
                attributes?.[attributeName],
                callback,
                {}
            );

        }
        return nestedObject;
    }, object);
};


const components = ['x', 'y', 'z', 'w'];
const vecLookup = [undefined, undefined, Vec2, Vec3, Vec4];

/**
 * Converts raw attribute data to actual values
 *
 * @param {AppBase} app - The app to use for asset lookup
 * @param {AttributeDefinition} attributeDefinition - The attribute definition
 * @param {*} value - The raw value to convert
 * @returns {*} The converted value
 */
export function rawToValue(app, attributeDefinition, value) {

    const { type } = attributeDefinition;

    switch (type) {
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
                // if (old instanceof Color) {
                //     old.copy(value);
                //     return old;
                // }
                return value;// .clone();
            } else if (value instanceof Array && value.length >= 3 && value.length <= 4) {
                for (let i = 0; i < value.length; i++) {
                    if (typeof value[i] !== 'number')
                        return null;
                }
                // if (!old)
                const color = new Color();

                color.r = value[0];
                color.g = value[1];
                color.b = value[2];
                color.a = (value.length === 3) ? 1 : value[3];

                return color;
            } else if (typeof value === 'string' && /#([0-9abcdef]{2}){3,4}/i.test(value)) {
                // if (!old)
                const color = new Color();

                color.fromString(value);
                return color;
            }
            return null;
        case 'vec2':
        case 'vec3':
        case 'vec4': {
            const len = parseInt(type.slice(3), 10);
            const vecType = vecLookup[len];

            if (value instanceof vecType) {
                // if (old instanceof vecType) {
                //     old.copy(value);
                //     return old;
                // }
                return value; // .clone();
            } else if (value instanceof Array && value.length === len) {
                for (let i = 0; i < value.length; i++) {
                    if (typeof value[i] !== 'number')
                        return null;
                }
                // if (!old)
                const vec = new vecType();

                for (let i = 0; i < len; i++)
                    vec[components[i]] = value[i];

                return vec;
            }
            return null;
        }
        case 'curve':
            if (value) {
                let curve;
                if (value instanceof Curve || value instanceof CurveSet) {
                    curve = value;// .clone();
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
