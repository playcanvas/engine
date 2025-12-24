import { Debug } from '../core/debug.js';
import { BoundingBox } from '../core/shape/bounding-box.js';

/**
 * A Morph Target (also known as Blend Shape) contains deformation data to apply to existing mesh.
 * Multiple morph targets can be blended together on a mesh. This is useful for effects that are
 * hard to achieve with conventional animation and skinning.
 *
 * @category Graphics
 */
class MorphTarget {
    /**
     * A used flag. A morph target can be used / owned by the Morph class only one time.
     *
     * @type {boolean}
     */
    used = false;

    /**
     * Create a new MorphTarget instance.
     *
     * @param {object} options - Object for passing optional arguments.
     * @param {ArrayBuffer} options.deltaPositions - An array of 3-dimensional vertex position
     * offsets.
     * @param {ArrayBuffer} [options.deltaNormals] - An array of 3-dimensional vertex normal
     * offsets.
     * @param {string} [options.name] - Name.
     * @param {BoundingBox} [options.aabb] - Bounding box. Will be automatically generated, if
     * undefined.
     * @param {number} [options.defaultWeight] - Default blend weight to use for this morph target.
     * @param {boolean} [options.preserveData] - When true, the morph target keeps its data passed using the options,
     * allowing the clone operation.
     */
    constructor(options) {
        Debug.assert(arguments.length === 1);
        this.options = options;
        this._name = options.name;
        this._defaultWeight = options.defaultWeight || 0;

        // bounds
        this._aabb = options.aabb;

        // store delta positions, used by aabb evaluation
        this.deltaPositions = options.deltaPositions;

        // true if the streams are available
        this.morphPositions = !!options.deltaPositions;
        this.morphNormals = !!options.deltaNormals;
    }

    /**
     * Gets the name of the morph target.
     *
     * @type {string}
     */
    get name() {
        return this._name;
    }

    /**
     * Gets the default weight of the morph target.
     *
     * @type {number}
     */
    get defaultWeight() {
        return this._defaultWeight;
    }

    get aabb() {

        // lazy evaluation, which allows us to skip this completely if customAABB is used
        if (!this._aabb) {
            this._aabb = new BoundingBox();
            if (this.deltaPositions) {
                this._aabb.compute(this.deltaPositions);
            }
        }

        return this._aabb;
    }

    /**
     * Returns an identical copy of the specified morph target. This can only be used if the morph target
     * was created with options.preserveData set to true.
     *
     * @returns {MorphTarget} A morph target instance containing the result of the cloning.
     */
    clone() {
        Debug.assert(this.options, 'MorphTarget cannot be cloned, was it created with a preserveData option?');
        return new MorphTarget(this.options);
    }

    _postInit() {

        // release original data
        if (!this.options.preserveData) {
            this.options = null;
        }

        // mark it as used
        this.used = true;
    }
}

export { MorphTarget };
