import { Debug } from '../core/debug.js';
import { BoundingBox } from '../core/shape/bounding-box.js';

import { SEMANTIC_ATTR0, TYPE_FLOAT32 } from '../platform/graphics/constants.js';
import { VertexBuffer } from '../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../platform/graphics/vertex-format.js';

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
     * @param {number} options.deltaPositionsType - A format to store position offsets inside
     * {@link VertexBuffer}. Defaults to {@link TYPE_FLOAT32} if not provided.
     * @param {ArrayBuffer} [options.deltaNormals] - An array of 3-dimensional vertex normal
     * offsets.
     * @param {number} options.deltaNormalsType - A format to store normal offsets inside
     * {@link VertexBuffer}. Defaults to {@link TYPE_FLOAT32} if not provided.
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
    }

    destroy() {

        this._vertexBufferPositions?.destroy();
        this._vertexBufferPositions = null;

        this._vertexBufferNormals?.destroy();
        this._vertexBufferNormals = null;

        this.texturePositions?.destroy();
        this.texturePositions = null;

        this.textureNormals?.destroy();
        this.textureNormals = null;
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
            if (this.deltaPositions)
                this._aabb.compute(this.deltaPositions);
        }

        return this._aabb;
    }

    get morphPositions() {
        return !!this._vertexBufferPositions || !!this.texturePositions;
    }

    get morphNormals() {
        return !!this._vertexBufferNormals || !!this.textureNormals;
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

    _initVertexBuffers(graphicsDevice) {

        const options = this.options;
        this._vertexBufferPositions = this._createVertexBuffer(graphicsDevice, options.deltaPositions, options.deltaPositionsType);
        this._vertexBufferNormals = this._createVertexBuffer(graphicsDevice, options.deltaNormals, options.deltaNormalsType);

        // access positions from vertex buffer when needed
        if (this._vertexBufferPositions) {
            this.deltaPositions = this._vertexBufferPositions.lock();
        }
    }

    _createVertexBuffer(device, data, dataType = TYPE_FLOAT32) {

        if (data) {

            // create vertex buffer with specified type (or float32), and semantic of ATTR0 which gets replaced at runtime with actual semantic
            const formatDesc = [{ semantic: SEMANTIC_ATTR0, components: 3, type: dataType }];
            return new VertexBuffer(device, new VertexFormat(device, formatDesc), data.length / 3, {
                data: data
            });
        }

        return null;
    }

    _setTexture(name, texture) {
        this[name] = texture;
    }
}

export { MorphTarget };
