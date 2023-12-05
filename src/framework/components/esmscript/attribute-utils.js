import { Color } from "../../../core/math/color.js";
import { Curve } from "../../../core/math/curve.js";
import { CurveSet } from "../../../core/math/curve-set.js";
import { Vec2 } from "../../../core/math/vec2.js";
import { Vec3 } from "../../../core/math/vec3.js";
import { Vec4 } from "../../../core/math/vec4.js";
import { Asset } from "../../../framework/asset/asset.js";
import { GraphNode } from "../../../scene/graph-node.js";
import { Debug } from "../../../core/debug.js";

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
export const VALID_ATTR_TYPES = new Set([
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

    return attributeDefinition && attributeDefinition.hasOwnProperty('type');

    // return VALID_ATTR_TYPES.has(attributeDefinition.type) ||
    //     (typeof attributeDefinition.type === 'object' && !Array.isArray(attributeDefinition.type));
};

/**
 * A function that recursively iterates through an attribute definition,
 * performing a callback for each valid entry and accumulating the result.
 * Useful for copying, merging or assigning attributes onto objects
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

        // determine the attribute value
        const value = attributes?.[attributeName] ??
            attributeDefinition?.default ??
            nestedObject?.[attributeName];

        const type = attributeDefinition?.type;
        const isArrayType = !!attributeDefinition?.array;
        const isValueArray = Array.isArray(value);

        // An attributes `type` can either be simple, ie. a string `{ type: 'rgba' }`
        // or it can be an object containing nested attributes ie. `{ type: CustomObjectType }`
        const isSimpleType = typeof type === 'string';

        // Warn and return early if the attribute is marked with `{ array: true }`
        // but the value is not an array
        if (isArrayType && value !== undefined && !isValueArray) {
            Debug.warn(`'${attributeName}' is an array and cannot be assigned a '${typeof value}'`);
            nestedObject[attributeName] = [];
            return nestedObject;
        }

        // If the definition has a `type` property then assume it's valid attribute definition
        if (isValidAttributeDefinition(attributeDefinition)) {

            // A simple attribute type is one who's s
            if (isSimpleType) {

                /**
                 * If this is a simple attribute defined with a string
                 */

                if (!isArrayType) {

                    callback(nestedObject, attributeName, attributeDefinition, value);

                } else {

                    // convert to array if not already one
                    const valueArr = isValueArray ? value : [value];
                    nestedObject[attributeName] = valueArr.reduce((acc, arrValue, i) => {
                        callback(acc, i, attributeDefinition, arrValue);
                        return acc;
                    }, []);

                }

            } else {

                /**
                 * For any complex attribute who's `type` is not a string,
                 * we must recurse through the `type` itself
                 */


                if (!isArrayType) {

                    nestedObject[attributeName] = reduceAttributeDefinition(type, value, callback, {});

                } else {

                    let attr;
                    // convert to array if not already one
                    const valueArr = isValueArray ? value : [value];
                    nestedObject[attributeName] = valueArr.reduce((acc, arrValue, i) => {
                        attr = reduceAttributeDefinition(type, arrValue, callback, {});
                        if (attr !== undefined) acc[i] = attr;
                        return acc;
                    }, []);

                }

            }

            // Run the callback on each item in the array and create a new array
            // const arr = valueArr.reduce(reducer, []);

            // If an array, assign the full array, otherwise use the first element
            // nestedObject[attributeName] = arr;

        } else if (typeof attributeDefinition === 'object') {

            /**
             * This a mechanism to group attributes together
             * @example
             * const attr = {
             *  color: { type: 'rgb', default: '#ff0000' },
             *  motion: { // groups motion settings under `entity.motion.*`
             *      speed: { type: 'number', default: 100 },
             *      velocity: { type: 'number', default: 2 },
             *  }
             * }
             */

            nestedObject[attributeName] = reduceAttributeDefinition(
                attributeDefinition,
                attributes?.[attributeName],
                callback,
                {}
            );

        } else {

            // It's not an object or a attribute definition, and will be ignored
            Debug.warn(`The attribute '${attributeName}' has not been defined as an attribute definition.`);
        }

        return nestedObject;
    }, object);
};


const components = ['x', 'y', 'z', 'w'];
const vecLookup = [undefined, undefined, Vec2, Vec3, Vec4];

/**
 * Converts raw attribute data to actual values
 *
 * @param {import('../../app-base.js').AppBase} app - The app to use for asset lookup
 * @param {AttributeDefinition} attributeDefinition - The attribute definition
 * @param {*} value - The raw value to convert
 * @returns {*} The converted value
 */
export function rawToValue(app, attributeDefinition, value) {

    const { type } = attributeDefinition;

    switch (type) {
        case 'boolean':
            return !!value;
        case 'app':
            return value;
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
}
