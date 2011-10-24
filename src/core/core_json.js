pc.extend(pc, function () {
    /**
     * @namespace
     * @name pc.json
     * @description Extend versions of built-in json parsingenvironment 
     */
    var json = {
        /**
         * @function
         * @name pc.json.parse
         * @description Identical to JSON.parse
         * @param {Object} value
         * @param {Object} reviver
         */
        parse: function (value, reviver) {
            return JSON.parse(value, reviver);
        },
        /**
         * @function
         * @name pc.json.stringify
         * @description extend version of JSON.stringify which converts any Float32Arrays into normal Arrays before encoding
         * @param {Object} value
         * @param {Object} replacer
         * @param {Object} space
         */
        stringify: function (value, replacer, space) {
            return JSON.stringify(value, function (key, value) {
                if(this[key] instanceof Float32Array) {
                    value = pc.makeArray(this[key]);
                } 
                return replacer ? replacer(key,value) : value;
            }, space);
        }
    };
    
    return {
        json: json
    };
}());
