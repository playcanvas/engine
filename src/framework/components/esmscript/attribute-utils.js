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
 * This type represents a generic class constructor.
 * @typedef {Function} ModuleClass
 */

/**
 * @typedef {Object} AttributeDefinition
 * @property {'asset'|'boolean'|'curve'|'entity'|'json'|'number'|'rgb'|'rgba'|'string'|'vec2'|'vec3'|'vec4'} type - The attribute type
 */

/**
 * The expected output of an ESM Script file. It contains the class definition and the attributes it requires.
 * @typedef {Object} ModuleExport
 * @property {ModuleClass} default - The default export of a esm script that defines a class
 * @property {Object<string, AttributeDefinition>} attributes - An object containing the names of attributes and their definitions;
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
};

/**
 * This function returns the value at a path from an object.
 * @param {Object} object - The object to get the value from
 * @param {string[]} path - The path to the value as an array of strings
 * @returns {*} The value at the path or undefined if it doesn't exist
 */
export const getValueAtPath = (object, path) => {
    return path.reduce((prev, curr) => prev?.[curr], object);
};

/**
 * This function sets the value at a path on an object.
 * @param {Object} object - The object to set the value on
 * @param {string[]} path - The path to the value as an array of strings
 * @param {*} value - The value to set
 * @returns {*} The value that was set
 */
export const setValueAtPath = (object, path, value) => {
    const last = path[path.length - 1];
    const parent = path.slice(0, -1).reduce((prev, curr) => {
        if (!prev[curr]) prev[curr] = {};
        return prev[curr];
    }, object);
    parent[last] = value;
    return value;
};

/**
 * This callback is executed for each attribute definition.
 *
 * @callback forEachAttributeDefinitionCallback
 * @param {AttributeDefinition} attributeDefinition - The current attribute definition.
 * @param {string[]} path - The path to the current attribute definition.
 */

/**
 * This function iterates over an attribute definition dictionary and calls a callback for each valid definition.
 * @param {AttributeDefinitionDict} attributeDefDict - The attribute definition dictionary to iterate over.
 * @param {forEachAttributeDefinitionCallback} callback - The callback to call for each valid attribute definition.
 * @param {string[]} [path] - The path to begin iterating from attribute definition. If empty, it starts from the root.
 */
export const forEachAttributeDefinition = (attributeDefDict, callback, path = []) => {

    const attributeDefEntries = Object.entries(attributeDefDict);

    attributeDefEntries.forEach(([attributeName, def]) => {

        const localPath = [...path, attributeName];

        if (isValidAttributeDefinition(def)) {

            callback(def, localPath);

        } else if (typeof def === 'object') {
            forEachAttributeDefinition(def, callback, localPath);
        }
    });
};

/**
 * A Dictionary object where each key is a string and each value is an AttributeDefinition.
 * @typedef {Object.<string, AttributeDefinition>} AttributeDefinitionDict
 */

/**
 * This function recursively populates an object with attributes based on an attribute definition.
 * It's used to populate the attributes of an ESM Script Component from an object literal, only
 * copying those attributes that are defined in the attributes definition and have the correct type.
 * If no attribute is specified it uses the default value from the attribute definition if available.
 *
 * @param {import('../../app-base.js').AppBase} app - The app base to search for asset references
 * @param {AttributeDefinitionDict} attributeDefDict - The definition
 * @param {Object} attributes - The attributes to apply
 * @param {Object} [object] - The object to populate with attributes
 * @returns {Object} the object with properties set
 *
 * @example
 * const attributes = { someNum: 1, nested: { notStr: 2, ignoredValue: 20 }}
 * const definitions = {
 *  someNum: { type: 'number' },
 *  nested: {
 *      notStr: { type: 'string' },
 *      otherValue: { type: 'number', default: 3 }
 *  }
 * }
 *
 * // only the attributes that are defined in the definition are copied
 * populateWithAttributes(app, object, attributeDefDict, attributes)
 * // outputs { someNum: 1, nested: { notStr: 2, otherValue: 3 }}
 */
export function populateWithAttributes(app, attributeDefDict, attributes, object = {}) {

    // Iterate over each attribute definition
    forEachAttributeDefinition(attributeDefDict, (def, path) => {

        const isSimpleType = typeof def.type === 'string';
        const valueFromAttributes = getValueAtPath(attributes, path);
        const valueFromObject = getValueAtPath(object, path);

        // If the attribute is an array, then we need to recurse into each element
        if (def.array) {

            // In order of preference, take the value from the attributes, from the object, the default, or an empty array
            const arr = valueFromAttributes ??
                valueFromObject ??
                def.default ??
                [];


            // If the array is not an array, then warn and set it to an empty array
            if (!Array.isArray(arr)) {

                Debug.warn(`The attribute '${path.join('.')}' is an array but the value provided is not an array.`);
                setValueAtPath(object, path, []);

            } else {
                // If the array is a simple type, just copy it
                let value = [...arr];

                // If the array is a complex type, then recurse through each element
                if (!isSimpleType) value = arr.map(v => populateWithAttributes(app, def.type, v, {}));

                // Set the resulting array on the path
                setValueAtPath(object, path, value);
            }

        } else {

            const value = valueFromAttributes ?? def.default;
            const mappedValue = rawToValue(app, def, value);

            // If we have a complex object (ie {type: CustomType}) then recurse into it
            if (typeof def.type === 'object') {

                const localValue = setValueAtPath(object, [...path], {});
                populateWithAttributes(app, def.type, value, localValue);

            // We have a valid value so set it on the object
            } else if (mappedValue != null) {

                setValueAtPath(object, [...path], mappedValue);

            // We have an invalid value so warn
            } else if (value != null && mappedValue === null) {

                Debug.warn(`'${path.join('.')}' is a '${typeof value}' but a '${def.type}' was expected. Please see the attribute definition.`);

            // Assert the type is valid
            } else {

                const isValidAttributeType = VALID_ATTR_TYPES.has(def.type);
                Debug.assert(isValidAttributeType, `The attribute definition for '${path.join('.')}' is malformed with a type of '${def.type}'.`);

            }
        }
    });

    // Perform a shallow comparison to warn of any attributes that are not defined in the definition
    for (const key in attributes) {
        if (attributeDefDict[key] === undefined) {
            Debug.warn(`'${key}' is not defined. Please see the attribute definition.`);
        }
    }

    return object;

}


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

    // If the type is an object, assume it's a complex type and simply return it
    if (typeof type === 'object') return {};

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
