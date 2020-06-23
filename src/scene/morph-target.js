import { BoundingBox } from '../shape/bounding-box.js';

import { BUFFER_STATIC, SEMANTIC_ATTR0, TYPE_FLOAT32 } from '../graphics/graphics.js';
import { VertexBuffer } from '../graphics/vertex-buffer.js';
import { VertexFormat } from '../graphics/vertex-format.js';

    /**
     * @class
     * @name pc.MorphTarget
     * @classdesc A Morph Target (also known as Blend Shape) contains deformation data to apply to existing mesh.
     * Multiple morph targets can be blended together on a mesh. This is useful for effects that are hard to achieve with conventional animation and skinning.
     * @param {object} options - Object for passing optional arguments.
     * @param {ArrayBuffer} options.deltaPositions - An array of 3-dimensional vertex position offsets.
     * @param {number} options.deltaPositionsType - A format to store position offsets inside {@link pc.VertexBuffer}. Defaults to {@link pc.TYPE_FLOAT32} if not provided.
     * @param {ArrayBuffer} [options.deltaNormals] - An array of 3-dimensional vertex normal offsets.
     * @param {number} options.deltaNormalsType - A format to store normal offsets inside {@link pc.VertexBuffer}. Defaults to {@link pc.TYPE_FLOAT32} if not provided.
     * @param {string} [options.name] - Name.
     * @param {pc.BoundingBox} [options.aabb] - Bounding box. Will be automatically generated, if undefined.
     * @param {number} [options.defaultWeight] - Default blend weight to use for this morph target.
     */
var MorphTarget = function (options) {

    if (arguments.length === 2) {
            // #ifdef DEBUG
        console.warn('DEPRECATED: Passing graphicsDevice to MorphTarget is deprecated, please remove the parameter.');
            // #endif
        options = arguments[1];
    }

    this.options = options;
        this.name = options.name;
        this.defaultWeight = options.defaultWeight || 0;

        // bounds
        this.aabb = options.aabb;
        if (!this.aabb) {
        this.aabb = new BoundingBox();
        if (options.deltaPositions)
            this.aabb.compute(options.deltaPositions);
        }

        // store delta positions, used by aabb evaluation
    this.deltaPositions = options.deltaPositions;
}

    Object.defineProperties(MorphTarget.prototype, {
        'morphPositions': {
            get: function () {
            return !!this._vertexBufferPositions || !!this.texturePositions;
            }
        },

        'morphNormals': {
            get: function () {
            return !!this._vertexBufferNormals || !!this.textureNormals;
            }
        }
    });

    Object.assign(MorphTarget.prototype, {

    _postInit: function () {

            // release original data
        this.options = null;
    },

    _initVertexBuffers: function (graphicsDevice) {

        var options = this.options;
        this._vertexBufferPositions = this._createVertexBuffer(graphicsDevice, options.deltaPositions, options.deltaPositionsType);
        this._vertexBufferNormals = this._createVertexBuffer(graphicsDevice, options.deltaNormals, options.deltaNormalsType);

            // access positions from vertex buffer when needed
        if (this._vertexBufferPositions) {
            this.deltaPositions = this._vertexBufferPositions.lock();
        }
    },

        _createVertexBuffer: function (device, data, dataType) {

            if (data) {

                // create vertex buffer with specified type (or float32), and semantic of ATTR0 which gets replaced at runtime with actual semantic
            var formatDesc = [{ semantic: SEMANTIC_ATTR0, components: 3, type: dataType || TYPE_FLOAT32 }];
            return new VertexBuffer(device, new VertexFormat(device, formatDesc), data.length / 3, BUFFER_STATIC, data);
            }

            return null;
        },

    _setTexture: function (name, texture) {
        this[name] = texture;
    },

        destroy: function () {

            if (this._vertexBufferPositions) {
                this._vertexBufferPositions.destroy();
                this._vertexBufferPositions = null;
            }

            if (this._vertexBufferNormals) {
                this._vertexBufferNormals.destroy();
                this._vertexBufferNormals = null;
            }

        if (this.texturePositions) {
            this.texturePositions.destroy();
            this.texturePositions = null;
        }
        if (this.textureNormals) {
            this.textureNormals.destroy();
            this.textureNormals = null;
        }
        }
    });

export { MorphTarget };
