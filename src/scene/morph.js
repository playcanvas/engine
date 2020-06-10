Object.assign(pc, function () {

    /**
     * @class
     * @name pc.Morph
     * @classdesc Contains a list of pc.MorphTarget, a combined delta AABB and some associated data.
     * @param {pc.MorphTarget[]} targets - A list of morph targets.
     * @param {pc.GraphicsDevice} graphicsDevice - The graphics device used to manage this morph target. If it is not provided, a device is obtained
     * from the {@link pc.Application}.
     */
    var Morph = function (targets, graphicsDevice) {

        this.device = graphicsDevice || pc.Application.getApplication().graphicsDevice;
        this._targets = targets;

        // default to texture based morphing if available
        if (this.device.supportsMorphTargetTexturesCore) {

            // pick renderable format - prefer half-float
            if (this.device.extTextureHalfFloat && this.device.textureHalfFloatRenderable) {
                this._renderTextureFormat = pc.Morph.FORMAT_HALF_FLOAT;
            } else if (this.device.extTextureFloat && this.device.textureFloatRenderable) {
                this._renderTextureFormat = pc.Morph.FORMAT_FLOAT;
            }

            // pick texture format - prefer half-float
            if (this.device.extTextureHalfFloat && this.device.textureHalfFloatUpdatable) {
                this._textureFormat = pc.Morph.FORMAT_HALF_FLOAT;
            } else  if (this.device.extTextureFloat) {
                this._textureFormat = pc.Morph.FORMAT_FLOAT;
            }

            // if both available, enable texture morphing
            if (this._renderTextureFormat !== undefined && this._textureFormat !== undefined) {
                this._useTextureMorph = true;
            }
        }

        this._init();
        this._updateMorphFlags();
        this._calculateAabb();
    };

    Object.defineProperties(Morph, {
        FORMAT_FLOAT: { value: 0 },
        FORMAT_HALF_FLOAT: { value: 1 }
    });

    Object.defineProperties(Morph.prototype, {
        'morphPositions': {
            get: function () {
                return this._morphPositions;
            }
        },

        'morphNormals': {
            get: function () {
                return this._morphNormals;
            }
        },

        'maxActiveTargets': {
            get: function () {

                // no limit when texture morph based
                if (this._useTextureMorph)
                    return this._targets.length;

                return (this._morphPositions && this._morphNormals) ? 4 : 8;
            }
        },

        'useTextureMorph': {
            get: function () {
                return this._useTextureMorph;
            }
        }
    });

    Object.assign(Morph.prototype, {

        _init: function () {

            // try to init texture based morphing
            if (this._useTextureMorph) {
                this._useTextureMorph = this._initTextureBased();
            }

            // if texture morphing is not set up, use attribute based morphing
            var i;
            if (!this._useTextureMorph) {
                for (i = 0; i < this._targets.length; i++) {
                    this._targets[i]._initVertexBuffers(this.device);
                }
            }

            // finalize init
            for (i = 0; i < this._targets.length; i++) {
                this._targets[i]._postInit();
            }
        },

        _initTextureBased: function () {
            var target, i, v;

            // collect all source delta arrays to find sparse set of vertices
            var deltaArrays = [], deltaInfos = [];
            for (i = 0; i < this._targets.length; i++) {
                target = this._targets[i];
                if (target.options.deltaPositions) {
                    deltaArrays.push(target.options.deltaPositions);
                    deltaInfos.push( { target: target, name: 'texturePositions' } );
                }
                if (target.options.deltaNormals) {
                    deltaArrays.push(target.options.deltaNormals);
                    deltaInfos.push( { target: target, name: 'textureNormals' } );
                }
            }

            // find sparse set for all target deltas into usedDataIndices and build vertex id buffer
            var ids = [], usedDataIndices = [];
            var vertexUsed, data;
            var freeIndex = 1;  // reserve slot 0 for zero delta
            var dataCount = deltaArrays[0].length;
            for (v = 0; v < dataCount; v += 3) {

                // find if vertex is morphed by any target
                vertexUsed = false;
                for (i = 0; i < deltaArrays.length; i++) {
                    data = deltaArrays[i];

                    // if non-zero delta
                    if (data[v] !== 0 || data[v + 1] !== 0 || data[v + 2] !== 0) {
                        vertexUsed = true;
                        break;
                    }
                }

                if (vertexUsed) {
                    ids.push(freeIndex);
                    usedDataIndices.push(v / 3);
                    freeIndex++;
                } else {
                    // non morphed vertices would be all mapped to pixel 0 of texture
                    ids.push(0);
                }
            }

            // max texture size: vertexBufferIds is stored in float32 format, giving us 2^24 range, so can address 4096 texture at maximum
            // TODO: on webgl2 we could store this in uint32 format and remove this limit
            var maxTextureSize = Math.min(this.device.maxTextureSize, 4096);

            // texture size for freeIndex pixels - roughly square
            var morphTextureWidth = Math.ceil(Math.sqrt(freeIndex));
            morphTextureWidth = Math.min(morphTextureWidth, maxTextureSize);
            var morphTextureHeight = Math.ceil(freeIndex / morphTextureWidth);

            // if data cannot fit into max size texture, fail this set up
            if (morphTextureHeight > maxTextureSize) {
                return false;
            }

            this.morphTextureWidth = morphTextureWidth;
            this.morphTextureHeight = morphTextureHeight;

            // texture format based vars
            var halfFloat = false;
            var numComponents = 3;  // RGB32 is used
            var float2Half = pc.math.float2Half;
            if (this._textureFormat === pc.Morph.FORMAT_HALF_FLOAT) {
                halfFloat = true;
                numComponents = 4;  // RGBA16 is used, RGB16 does not work
            }

            // build texture for each delta array, all textures are the same size
            var arraySize = this.morphTextureWidth * this.morphTextureHeight * numComponents;
            var packedDeltas = halfFloat ? new Uint16Array(arraySize) : new Float32Array(arraySize);
            for (i = 0; i < deltaArrays.length; i++) {
                data = deltaArrays[i];

                // copy full arrays into sparse arrays and convert format (skip 0th pixel - used by non-morphed vertices)
                for (v = 0; v < usedDataIndices.length; v++) {
                    var index = usedDataIndices[v];

                    if (halfFloat) {
                        packedDeltas[v * numComponents + numComponents] = float2Half(data[index * 3]);
                        packedDeltas[v * numComponents + numComponents + 1] = float2Half(data[index * 3 + 1]);
                        packedDeltas[v * numComponents + numComponents + 2] = float2Half(data[index * 3 + 2]);
                    } else {
                        packedDeltas[v * numComponents + numComponents] = data[index * 3];
                        packedDeltas[v * numComponents + numComponents + 1] = data[index * 3 + 1];
                        packedDeltas[v * numComponents + numComponents + 2] = data[index * 3 + 2];
                    }
                }

                // create texture and assign it to target
                target = deltaInfos[i].target;
                var format = this._textureFormat === pc.Morph.FORMAT_FLOAT ? pc.PIXELFORMAT_RGB32F : pc.PIXELFORMAT_RGBA16F;
                target._setTexture(deltaInfos[i].name, this._createTexture("MorphTarget", format, packedDeltas));
            }

            // create vertex stream with vertex_id used to map vertex to texture
            var formatDesc = [{ semantic: pc.SEMANTIC_ATTR0, components: 1, type: pc.TYPE_FLOAT32 }];
            this.vertexBufferIds = new pc.VertexBuffer(this.device, new pc.VertexFormat(this.device, formatDesc), ids.length, pc.BUFFER_STATIC, new Float32Array(ids));

            return true;
        },

        /**
         * @function
         * @name pc.Morph#destroy
         * @description Frees video memory allocated by this object.
         */
        destroy: function () {
            if (this.vertexBufferIds) {
                this.vertexBufferIds.destroy();
                this.vertexBufferIds = null;
            }

            for (var i = 0; i < this._targets.length; i++) {
                this._targets[i].destroy();
            }
            this._targets.length = 0;
        },

        /**
         * @function
         * @name pc.Morph#getTarget
         * @description Gets the morph target by index.
         * @param {number} index - An index of morph target.
         * @returns {pc.MorphTarget} A morph target object.
         */
        getTarget: function (index) {
            return this._targets[index];
        },

        _updateMorphFlags: function () {

            // find out if this morph needs to morph positions and normals
            this._morphPositions = false;
            this._morphNormals = false;
            var target;
            for (var i = 0; i < this._targets.length; i++) {
                target = this._targets[i];
                if (target.morphPositions) {
                    this._morphPositions = true;
                }
                if (target.morphNormals) {
                    this._morphNormals = true;
                }
            }
        },

        _calculateAabb: function () {

            this.aabb = new pc.BoundingBox(new pc.Vec3(0, 0, 0), new pc.Vec3(0, 0, 0));
            var target;

            // calc bounding box of the relative change this morph can add
            for (var i = 0; i < this._targets.length; i++) {
                target = this._targets[i];
                this.aabb._expand(target.aabb.getMin(), target.aabb.getMax());
            }
        },

        // creates texture. Used to create both source morph target data, as well as render target used to morph these into, positions and normals
        _createTexture: function (name, format, pixelData) {

            var texture = new pc.Texture(this.device, {
                width: this.morphTextureWidth,
                height: this.morphTextureHeight,
                format: format,
                cubemap: false,
                mipmaps: false,
                minFilter: pc.FILTER_NEAREST,
                magFilter: pc.FILTER_NEAREST,
                addressU: pc.ADDRESS_CLAMP_TO_EDGE,
                addressV: pc.ADDRESS_CLAMP_TO_EDGE
            });
            texture.name = name;

            if (pixelData) {
                var pixels = texture.lock();
                pixels.set(pixelData);
                texture.unlock();
            }

            return texture;
        }
    });

    return {
        Morph: Morph
    };
}());
