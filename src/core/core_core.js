/**
 * @name pc
 * @namespace Root namespace for the PlayCanvas engine
 * @preserve PlayCanvas Engine v__CURRENT_SDK_VERSION__ revision __MERCURIAL_REVISION__
 * http://playcanvas.com
 * Copyright 2011-2012 PlayCanvas Ltd. All rights reserved.
 * Do not distribute.
 */
var pc = function () {
    // public interface
    var _pc = {
        common: {},
        /**
         * Storage for the applications using the PlayCanvas Engine
         */
        apps: {},
        /**
         * Storage for exported entity data
         */
        data: {},
                
        /**
         * @private
         * @function
         * @name pc.unpack()
         * @description Copy a set of common PlayCanvas functions/classes/namespaces into the global namespace
         */
        unpack: function () {
            // Objects to copy into global window object.
            // in format ["src name", "target name"]
            objects = [
                ["pc.math.vec3", "vec3"],
                ["pc.math.vec4", "vec4"],
                ["pc.math.mat3", "mat3"],
                ["pc.math.mat4", "mat4"]
            ]            
        },
             
        /**
         * Convert an array-like object into a normal array.
         * For example, this is useful for converting the arguments object into an array. 
         * @param {Object} arr The array to convert
         * @return {Array} An array
         * @function
         * @name pc.makeArray
         */
        makeArray: function (arr) {
            var i, 
            ret = [],
            length = arr.length;
            
            for(i = 0; i < length; ++i) {
                ret.push(arr[i]);
            }
            
            return ret;
        },

        /**
         * [deprecated] Call fn(index, arrayItem) for each item in the array
         * @deprecated There is a built in function Array.map which should perform this task
         * @param {Array} arr The array to iterate over
         * @param {Function} fn The function to execute on each array item
         * @function
         * @name pc.each
         */
        each: function (arr, fn) {
            var index,
            length = arr.length;
            
            for(index = 0; index < length; ++index) {
                fn(index, arr[index]);
            }
        },

        /**
         * [deprecated] Create a callback function which maintains the correct value for 'this'
         * @deprecated Use the built in function bind() on the Function object
         * @param {Object} self The object to use as 'this' for the callback
         * @param {Object} fn The function to callback
         * @function
         * @name pc.callback
         */
        callback: function (self, fn) {
            return function () {
                    var args = pc.makeArray(arguments);
                    return fn.apply(self, args);
                };
        },
        
        /**
         * Extended typeof() function, returns the type of the object.
         * @param {Object} obj The object to get the type of
         * @return {String} The type string: "null", "undefined", "number", "string", "boolean", "array", "object", "function", "date" or "regexp"
         * @function
         * @name pc.type
         */
        type: function (obj) {
            if(obj == null) {
                return "null";
            }
            
            var type = typeof(obj);
            
            if (type == "undefined" || type == "number" || type == "string" || type == "boolean") {
                return type;
            }
            
            return _typeLookup[Object.prototype.toString.call(obj)];
        },

        /**
         * Merge the contents of two objects into a single object
         * <pre lang="javascript"><code>
         * var A = {a: function() {console.log(this.a}};
         * var B = {b: function() {console.log(this.b}};
         * 
         * pc.extend(A,B);
         * A.a();
         * // logs "a"
         * A.b();
         * // logs "b"
         * </pre></code>
         * @param {Object} target The target object of the merge
         * @param {Object} ex The object that is merged with target
         * @return {Object} The target object
         * @function
         * @name pc.extend
         */
        extend: function(target, ex) {
            var prop,
            copy;
            
            for(prop in ex) {
                copy = ex[prop];
                if(pc.type(copy) == "object") {
                    target[prop] = pc.extend({}, copy);
                } else if(pc.type(copy) == "array") {
                    target[prop] = pc.extend([], copy);
                } else {
                    target[prop] = copy;        
                }
            }
            
            return target;
        },
        
        /**
         * Return true if the Object is not undefined
         * @param {Object} o The Object to test
         * @function
         * @name pc.isDefined
         */
        isDefined: function(o) {
            var a;
            return !(o === a)
        }
    };
    // private
    /**
     * Create look up table for types
     * @private
     * @function
     * @name pc._typeLookup
     */
    var _typeLookup = function () {
            var result = {}, 
            index, 
            names = ["Array", "Object", "Function", "Date", "RegExp", "Float32Array"];
            
            for(index = 0; index < names.length; ++index) {
                result["[object " + names[index] + "]"] = names[index].toLowerCase();
            };
            
            return result;
        } ();
    
    return _pc;
}();