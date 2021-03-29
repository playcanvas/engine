/**
 * @name pc
 * @namespace
 * @description Root namespace for the PlayCanvas Engine.
 */

/**
 * @private
 * @function
 * @name _typeLookup
 * @description Create look up table for types.
 */
const _typeLookup = function () {
    const result = { };
    const names = ["Array", "Object", "Function", "Date", "RegExp", "Float32Array"];

    for (let i = 0; i < names.length; i++)
        result["[object " + names[i] + "]"] = names[i].toLowerCase();

    return result;
}();

const version = "__CURRENT_SDK_VERSION__";
const revision = "__REVISION__";
const config = { };
const common = { };
const apps = { }; // Storage for the applications using the PlayCanvas Engine
const data = { }; // Storage for exported entity data

/**
 * @private
 * @function
 * @name type
 * @description Extended typeof() function, returns the type of the object.
 * @param {object} obj - The object to get the type of.
 * @returns {string} The type string: "null", "undefined", "number", "string", "boolean", "array", "object", "function", "date", "regexp" or "float32array".
 */
function type(obj) {
    if (obj === null) {
        return "null";
    }

    const type = typeof obj;

    if (type === "undefined" || type === "number" || type === "string" || type === "boolean") {
        return type;
    }

    return _typeLookup[Object.prototype.toString.call(obj)];
}

/**
 * @private
 * @function
 * @name extend
 * @description Merge the contents of two objects into a single object.
 * @param {object} target - The target object of the merge.
 * @param {object} ex - The object that is merged with target.
 * @returns {object} The target object.
 * @example
 * var A = {
 *     a: function () {
 *         console.log(this.a);
 *     }
 * };
 * var B = {
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
 */
function extend(target, ex) {
    for (const prop in ex) {
        const copy = ex[prop];

        if (type(copy) === "object") {
            target[prop] = extend({}, copy);
        } else if (type(copy) === "array") {
            target[prop] = extend([], copy);
        } else {
            target[prop] = copy;
        }
    }

    return target;
}

/**
 * @private
 * @function
 * @name isDefined
 * @description Return true if the Object is not undefined.
 * @param {object} o - The Object to test.
 * @returns {boolean} True if the Object is not undefined.
 */
function isDefined(o) {
    let a;
    return (o !== a);
}

export { apps, common, config, data, extend, isDefined, revision, type, version };
