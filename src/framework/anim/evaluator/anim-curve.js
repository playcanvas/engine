/**
 * Animation curve links an input data set to an output data set and defines the interpolation
 * method to use.
 *
 * @category Animation
 */
class AnimCurve {
    /**
     * Create a new animation curve.
     *
     * @param {string[]} paths - Array of path strings identifying the targets of this curve, for
     * example "rootNode.translation".
     * @param {number} input - Index of the curve which specifies the key data.
     * @param {number} output - Index of the curve which specifies the value data.
     * @param {number} interpolation - The interpolation method to use. One of the following:
     *
     * - {@link INTERPOLATION_STEP}
     * - {@link INTERPOLATION_LINEAR}
     * - {@link INTERPOLATION_CUBIC}
     */
    constructor(paths, input, output, interpolation) {
        this._paths = paths;
        this._input = input;
        this._output = output;
        this._interpolation = interpolation;
    }

    /**
     * The list of paths which identify targets of this curve.
     *
     * @type {string[]}
     */
    get paths() {
        return this._paths;
    }

    /**
     * The index of the AnimTrack input which contains the key data for this curve.
     *
     * @type {number}
     */
    get input() {
        return this._input;
    }

    /**
     * The index of the AnimTrack input which contains the key data for this curve.
     *
     * @type {number}
     */
    get output() {
        return this._output;
    }

    /**
     * The interpolation method used by this curve.
     *
     * @type {number}
     */
    get interpolation() {
        return this._interpolation;
    }
}

export { AnimCurve };
