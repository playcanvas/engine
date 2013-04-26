/**
 * @name pc
 * @namespace PlayCanvas Engine
 * @description Root namespace for the PlayCanvas Engine
 * @preserve PlayCanvas Engine v__CURRENT_SDK_VERSION__ revision __MERCURIAL_REVISION__
 * http://playcanvas.com
 * Copyright 2011-2013 PlayCanvas Ltd. All rights reserved.
 * Do not distribute.
 * Contains: https://github.com/tildeio/rsvp.js - see page for license information
 */
var pc = {
        /**
        * @name pc.config
        * @description Configuration data made available to the application from the server
        * @param bootstrap
        * @param frame Options set from the containing frame
        * @param frame.url The URL of the containing frame 
        * @param api_url
        * @param corazon
        * @param username
        * @param repository
        * @param script_prefix
        */
        config: {},

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
         * @function
         * @name pc.unpack()
         * @description Copy a set of common PlayCanvas functions/classes/namespaces into the global namespace
         */
        unpack: function () {
            window.m4 = pc.math.mat4;
            window.v2 = pc.math.vec2;
            window.v3 = pc.math.vec3;
            window.v4 = pc.math.vec4;
            window.quat = pc.math.quat;
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
         * Extended typeof() function, returns the type of the object.
         * @param {Object} obj The object to get the type of
         * @return {String} The type string: "null", "undefined", "number", "string", "boolean", "array", "object", "function", "date", "regexp" or "float32array"
         * @function
         * @name pc.type
         */
        type: function (obj) {
            if (obj === null) {
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
            return (o !== a);
        }
    };

    /**
     * @private
     * @name pc._typeLookup
     * @function
     * @description Create look up table for types
     */
    var _typeLookup = function () {
        var result = {}, 
        index, 
        names = ["Array", "Object", "Function", "Date", "RegExp", "Float32Array"];
        
        for(index = 0; index < names.length; ++index) {
            result["[object " + names[index] + "]"] = names[index].toLowerCase();
        }
        
        return result;
    } ();

if (typeof exports !== 'undefined') {
    exports.pc = pc;
}
