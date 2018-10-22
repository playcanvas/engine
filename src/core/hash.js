Object.assign(pc, (function () {
    return {
        /**
         * @private
         * @function
         * @name pc.hashCode
         * @description Calculates simple hash value of a string. Designed for performance, not perfect.
         * @param {String} str String
         * @returns {Number} Hash value
         */
        hashCode: function (str) {
            var hash = 0;
            for (var i = 0, len = str.length; i < len; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                // Convert to 32bit integer
                hash |= 0;
            }
            return hash;
        }
    };
}()));
