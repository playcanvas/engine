pc.extend(pc, function () {
    /**
     * @namespace
     * @name pc.json
     * @description Extend versions of built-in json parsing environment
     * pc.json.parse() is identical to JSON.parse()
     * pc.json.stringify() will behave identically to the built in JSON.stringify() function expcet it will correctly handle Float32Arrays by converting them into standard arrays
     * before encoding. 
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
         * @description Extended version of JSON.stringify which converts any Float32Arrays into normal Arrays before encoding
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
