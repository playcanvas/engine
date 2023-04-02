/**
 * @name pc
 * @namespace
 * @description Root namespace for the PlayCanvas Engine.
 */

const version = '$_CURRENT_SDK_VERSION';
const revision = '$_CURRENT_SDK_REVISION';
const config = { };
const common = { };
const apps = { }; // Storage for the applications using the PlayCanvas Engine
const data = { }; // Storage for exported entity data

// Create look up table for types.
const _typeLookup = function () {
    const result = { };
    const names = ['Array', 'Object', 'Function', 'Date', 'RegExp', 'Float32Array'];

    for (let i = 0; i < names.length; i++)
        result['[object ' + names[i] + ']'] = names[i].toLowerCase();

    return result;
}();

/**
 * Extended typeof() function, returns the type of the object.
 *
 * @param {object} obj - The object to get the type of.
 * @returns {string} The type string: "null", "undefined", "number", "string", "boolean", "array", "object", "function", "date", "regexp" or "float32array".
 * @ignore
 */
function type(obj) {
    if (obj === null) {
        return 'null';
    }

    const type = typeof obj;

    if (type === 'undefined' || type === 'number' || type === 'string' || type === 'boolean') {
        return type;
    }

    return _typeLookup[Object.prototype.toString.call(obj)];
}

/**
 * Merge the contents of two objects into a single object.
 *
 * @param {object} target - The target object of the merge.
 * @param {object} ex - The object that is merged with target.
 * @returns {object} The target object.
 * @example
 * const A = {
 *     a: function () {
 *         console.log(this.a);
 *     }
 * };
 * const B = {
 *     b: function () {
 *         console.log(this.b);
 *     }
 * };
 *
 * pc.extend(A, B);
 * A.a();
 * // logs "a"
 * A.b();
 * // logs "b"
 * @ignore
 */
function extend(target, ex) {
    for (const prop in ex) {
        const copy = ex[prop];

        if (type(copy) === 'object') {
            target[prop] = extend({}, copy);
        } else if (type(copy) === 'array') {
            target[prop] = extend([], copy);
        } else {
            target[prop] = copy;
        }
    }

    return target;
}

export { apps, common, config, data, extend, revision, type, version };
