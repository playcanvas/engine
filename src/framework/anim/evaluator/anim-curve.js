/**
 * Identifies the property that an {@link AnimCurve} drives. The path is resolved by an animation
 * binder into a concrete target on an entity.
 *
 * @typedef {object} AnimCurvePath
 * @property {string[]} entityPath - The names of the entities from the animation root down to the
 * target entity.
 * @property {string} component - The name of the component that owns the property, or `graph`
 * for a transform on the entity itself.
 * @property {string[]} propertyPath - The property name segments, for example
 * `['localPosition']` or `['weight.Smile']`.
 * @category Animation
 */

/**
 * Animation curve links an input data set to an output data set and defines the interpolation
 * method to use. The {@link paths} name the targets the curve drives, {@link input} and
 * {@link output} index into the owning {@link AnimTrack}'s keyframe time and value data, and
 * {@link interpolation} is one of {@link INTERPOLATION_STEP}, {@link INTERPOLATION_LINEAR} or
 * {@link INTERPOLATION_CUBIC}.
 *
 * @category Animation
 */
class AnimCurve {
    /**
     * Create a new animation curve.
     *
     * @param {AnimCurvePath[]} paths - Array of paths identifying the targets of this curve, for
     * example the local position of a node.
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
     * @type {AnimCurvePath[]}
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
