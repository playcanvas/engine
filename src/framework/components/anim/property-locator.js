import { AnimBinder } from '../../../anim/anim-binder.js';

/**
 * @private
 * @class
 * @name pc.AnimPropertyLocator
 * @classdesc The AnimProperyLocator encodes and decodes paths to properties in the scene hierarchy.
 * @description Create a new AnimPropertyLocator.
 */
function AnimPropertyLocator() {}

Object.assign(AnimPropertyLocator.prototype, {
    /**
     * @private
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
        return AnimBinder.joinPath([
            AnimBinder.joinPath(locator[0]),
            locator[1],
            AnimBinder.joinPath(locator[2])
        ], '/');
    },
    /**
     * @private
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
        var locatorSections = AnimBinder.splitPath(locator, '/');
        return [
            AnimBinder.splitPath(locatorSections[0]),
            locatorSections[1],
            AnimBinder.splitPath(locatorSections[2])
        ];
    }
});

export { AnimPropertyLocator };
