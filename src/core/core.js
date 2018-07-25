/**
 * @private
 * @function
 * @name _typeLookup
 * @description Create look up table for types
 */
var _typeLookup = function () {
    var result = { };
    var names = ["Array", "Object", "Function", "Date", "RegExp", "Float32Array"];

    for (var i = 0; i < names.length; i++)
        result["[object " + names[i] + "]"] = names[i].toLowerCase();

    return result;
}();

// ESLint disabled here due to ifdef comments interleaved with block comment.
/* eslint-disable multiline-comment-style */
/**
 * @name pc
 * @namespace
 * @description Root namespace for the PlayCanvas Engine
 * @preserve PlayCanvas Engine v__CURRENT_SDK_VERSION__ revision __REVISION__
 * http://playcanvas.com
 * Copyright 2011-2018 PlayCanvas Ltd. All rights reserved.
// #ifdef DEBUG
 * DEBUG BUILD
// #endif
// #ifdef PROFILER
 * PROFILER BUILD
// #endif
 */
/* eslint-enable multiline-comment-style */
var pc = {
    version: "__CURRENT_SDK_VERSION__",
    revision: "__REVISION__",
    config: { },
    common: { },
    apps: { }, // Storage for the applications using the PlayCanvas Engine
    data: { }, // Storage for exported entity data

    /**
     * @private
     * @function
     * @name pc.unpack
     * @description Copy a set of common PlayCanvas functions/classes/namespaces into the global namespace
     */
    unpack: function () {
        console.warn("pc.unpack has been deprecated and will be removed shortly. Please update your code.");
    },

    /**
     * @private
     * @function
     * @name pc.makeArray
     * @description Convert an array-like object into a normal array.
     * For example, this is useful for converting the arguments object into an array.
     * @param {Object} arr The array to convert
     * @returns {Array} An array
     */
    makeArray: function (arr) {
        var i,
            ret = [],
            length = arr.length;

        for (i = 0; i < length; ++i) {
            ret.push(arr[i]);
        }

        return ret;
    },

    /**
     * @private
     * @function
     * @name pc.type
     * @description Extended typeof() function, returns the type of the object.
     * @param {Object} obj The object to get the type of
     * @returns {String} The type string: "null", "undefined", "number", "string", "boolean", "array", "object", "function", "date", "regexp" or "float32array"
     */
    type: function (obj) {
        if (obj === null) {
            return "null";
        }

        var type = typeof obj;

        if (type === "undefined" || type === "number" || type === "string" || type === "boolean") {
            return type;
        }

        return _typeLookup[Object.prototype.toString.call(obj)];
    },

    /**
     * @private
     * @function
     * @name pc.extend
     * @description Merge the contents of two objects into a single object
     * @param {Object} target The target object of the merge
     * @param {Object} ex The object that is merged with target
     * @returns {Object} The target object
     * @example
     * var A = {a: function() {console.log(this.a}};
     * var B = {b: function() {console.log(this.b}};
     *
     * pc.extend(A,B);
     * A.a();
     * // logs "a"
     * A.b();
     * // logs "b"
     */
    extend: function (target, ex) {
        var prop,
            copy;

        for (prop in ex) {
            copy = ex[prop];
            if (pc.type(copy) == "object") {
                target[prop] = pc.extend({}, copy);
            } else if (pc.type(copy) == "array") {
                target[prop] = pc.extend([], copy);
            } else {
                target[prop] = copy;
            }
        }

        return target;
    },


    /**
     * @private
     * @function
     * @name pc.isDefined
     * @description Return true if the Object is not undefined
     * @param {Object} o The Object to test
     * @returns {Boolean} True if the Object is not undefined
     */
    isDefined: function (o) {
        var a;
        return (o !== a);
    }
};

if (typeof exports !== 'undefined')
    exports.pc = pc;
