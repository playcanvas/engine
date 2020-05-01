Object.assign(pc, function () {
    /**
     * @class
     * @name pc.AnimPropertyLocator
     * @classdesc The AnimProperyLocator encodes and decodes paths to properties in the scene hierarchy.
     * @description Create a new AnimPropertyLocator.
     */
    var AnimPropertyLocator = function () {
    };
    Object.assign(AnimPropertyLocator.prototype, {
        /**
         * @function
         * @name pc.AnimPropertyLocator#encode
         * @description Converts a locator array into its string version
         * @param {Array} locator - The property location in the scene defined as an array
         * @returns {string} The locator encoded as a string
         * @example
         * // returns 'spotLight/light/color.r'
         * encode([['spotLight'], 'light', ['color', 'r']]);
         */
        encode: function (locator) {
            return pc.AnimBinder.joinPath([
                pc.AnimBinder.joinPath(locator[0]),
                locator[1],
                pc.AnimBinder.joinPath(locator[2])
            ], '/');
        },
        /**
         * @function
         * @name pc.AnimPropertyLocator#decode
         * @description Converts a locator string into its array version
         * @param {Array} locator - The property location in the scene defined as a string
         * @returns {Array} - The locator decoded into an array
         * @example
         * // returns [['spotLight'], 'light', ['color','r']]
         * encode('spotLight/light/color.r');
         */
        decode: function (locator) {
            var locatorSections = pc.AnimBinder.splitPath(locator, '/');
            return [
                pc.AnimBinder.splitPath(locatorSections[0]),
                locatorSections[1],
                pc.AnimBinder.splitPath(locatorSections[2])
            ];
        }
    });
    return {
        AnimPropertyLocator: AnimPropertyLocator
    };
}());
