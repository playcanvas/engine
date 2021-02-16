/**
 * @private
 * @class
 * @name AnimCurve
 * @classdesc Animation curve links an input data set to an output data set
 * and defines the interpolation method to use.
 * @description Create a new animation curve
 * @param {string[]} paths - array of path strings identifying the targets of this curve, for example "rootNode.translation".
 * @param {number} input - index of the curve which specifies the key data.
 * @param {number} output - index of the curve which specifies the value data.
 * @param {number} interpolation - the interpolation method to use. One of the following:
 *
 * * {@link pc.INTERPOLATION_STEP}
 * * {@link pc.INTERPOLATION_LINEAR}
 * * {@link pc.INTERPOLATION_CUBIC}
 */
class AnimCurve {
    constructor(paths, input, output, interpolation) {
        this._paths = paths;
        this._input = input;
        this._output = output;
        this._interpolation = interpolation;
    }

    get paths() {
        return this._paths;
    }

    get input() {
        return this._input;
    }

    get output() {
        return this._output;
    }

    get interpolation() {
        return this._interpolation;
    }
}

export { AnimCurve };
