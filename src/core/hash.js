pc.extend(pc, (function () {
    return {
        /**
         * @private
         * @function
         * @name pc.hashCode
         * @description Calculates simple hash value of a string. Designed for performance, not perfect.
         * @param {String} str String
         * @returns {Number} Hash value
         */
        hashCode: function(str){
            var hash = 0;
            if (str.length === 0) return hash;
            for (var i = 0; i < str.length; i++) {
                var char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return hash;
        }
    };
}()));
