Object.assign(pc, function () {

    /**
     * @class
     * @name pc.MorphTarget
     * @classdesc A Morph Target (also known as Blend Shape) contains deformation data to apply to existing mesh.
     * Multiple morph targets can be blended together on a mesh. This is useful for effects that are hard to achieve with conventional animation and skinning.
     * @param {pc.GraphicsDevice} graphicsDevice - The graphics device used to manage this morph target. If it is not provided, a device is obtained
     * from the {@link pc.Application}.
     * @param {object} options - Object for passing optional arguments.
     * @param {ArrayBuffer} options.deltaPositions - An array of 3-dimensional vertex position offsets.
     * @param {number} options.deltaPositionsType - A format to store position offsets inside {@link pc.VertexBuffer}. Defaults to {@link pc.TYPE_FLOAT32} if not provided.
     * @param {ArrayBuffer} [options.deltaNormals] - An array of 3-dimensional vertex normal offsets.
     * @param {number} options.deltaNormalsType - A format to store normal offsets inside {@link pc.VertexBuffer}. Defaults to {@link pc.TYPE_FLOAT32} if not provided.
     * @param {string} [options.name] - Name.
     * @param {pc.BoundingBox} [options.aabb] - Bounding box. Will be automatically generated, if undefined.
     * @param {number} [options.defaultWeight] - Default blend weight to use for this morph target.
     */
    var MorphTarget = function (graphicsDevice, options) {

        this.name = options.name;
        this.defaultWeight = options.defaultWeight || 0;

        this._vertexBufferPositions = this._createVertexBuffer(graphicsDevice, options.deltaPositions, options.deltaPositionsType);
        this._vertexBufferNormals = this._createVertexBuffer(graphicsDevice, options.deltaNormals, options.deltaNormalsType);

        // access to positions stored inside vertex buffer
        if (this._vertexBufferPositions) {
            this.deltaPositions = this._vertexBufferPositions.lock();
        }

        // bounds
        this.aabb = options.aabb;
        if (!this.aabb) {
            this.aabb = new pc.BoundingBox();
            if (this.deltaPositions)
                this.aabb.compute(this.deltaPositions);
        }
    };

    Object.defineProperties(MorphTarget.prototype, {
        'morphPositions': {
            get: function () {
                return !!this._vertexBufferPositions;
            }
        },

        'morphNormals': {
            get: function () {
                return !!this._vertexBufferNormals;
            }
        }
    });

    Object.assign(MorphTarget.prototype, {

        _createVertexBuffer: function (device, data, dataType) {

            if (data) {

                // create vertex buffer with specified type (or float32), and semantic of ATTR0 which gets replaced at runtime with actual semantic
                var formatDesc = [{ semantic: pc.SEMANTIC_ATTR0, components: 3, type: dataType || pc.TYPE_FLOAT32 }];
                return new pc.VertexBuffer(device, new pc.VertexFormat(device, formatDesc), data.length / 3, pc.BUFFER_STATIC, data);
            }

            return null;
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
        }
    });

    return {
        MorphTarget: MorphTarget
    };
}());
