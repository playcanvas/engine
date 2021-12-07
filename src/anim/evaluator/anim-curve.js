/**
 * @class
 * @name AnimCurve
 * @classdesc Animation curve links an input data set to an output data set
 * and defines the interpolation method to use.
 * @description Create a new animation curve.
 * @param {string[]} paths - Array of path strings identifying the targets of this curve, for example "rootNode.translation".
 * @param {number} input - Index of the curve which specifies the key data.
 * @param {number} output - Index of the curve which specifies the value data.
 * @param {number} interpolation - The interpolation method to use. One of the following:
 *
 * - {@link INTERPOLATION_STEP}
 * - {@link INTERPOLATION_LINEAR}
 * - {@link INTERPOLATION_CUBIC}
 */
class AnimCurve {
    constructor(paths, input, output, interpolation) {
        this._paths = paths;
        this._input = input;
        this._output = output;
        this._interpolation = interpolation;
    }

    /**
     * @readonly
     * @name AnimCurve#paths
     * @type {string[]}
     * @description Returns a list of paths which identify targets of this curve.
     */
    get paths() {
        return this._paths;
    }

    /**
     * @readonly
     * @name AnimCurve#input
     * @type {number}
     * @description Returns the index of the AnimTrack input which contains the key data for this curve.
     */
    get input() {
        return this._input;
    }

    /**
     * @readonly
     * @name AnimCurve#output
     * @type {number}
     * @description Returns the index of the AnimTrack input which contains the key data for this curve.
     */
    get output() {
        return this._output;
    }

    /**
     * @readonly
     * @name AnimCurve#interpolation
     * @type {number}
     * @description The interpolation method used by this curve.
     */
    get interpolation() {
        return this._interpolation;
    }
}

export { AnimCurve };
