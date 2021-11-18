import { RefCountedObject } from '../core/ref-counted-object.js';
import { Vec3 } from '../math/vec3.js';
import { FloatPacking } from '../math/float-packing.js';
import { BoundingBox } from '../shape/bounding-box.js';
import { Texture } from '../graphics/texture.js';
import { VertexBuffer } from '../graphics/vertex-buffer.js';
import { VertexFormat } from '../graphics/vertex-format.js';
import { getApplication } from '../framework/globals.js';

import { BUFFER_STATIC, TYPE_FLOAT32, SEMANTIC_ATTR15, ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGB32F } from '../graphics/constants.js';

// value added to floats which are used as ints on the shader side to avoid values being rounded to one less occasionally
const _floatRounding = 0.2;

/**
 * @class
 * @name Morph
 * @classdesc Contains a list of {@link MorphTarget}, a combined delta AABB and some associated data.
 * @param {MorphTarget[]} targets - A list of morph targets.
 * @param {GraphicsDevice} graphicsDevice - The graphics device used to manage this morph target. If it is not provided, a device is obtained
 * from the {@link Application}.
 */
class Morph extends RefCountedObject {
    constructor(targets, graphicsDevice) {
        super();

        this.device = graphicsDevice || getApplication().graphicsDevice;
        this._targets = targets;

        // default to texture based morphing if available
        if (this.device.supportsMorphTargetTexturesCore) {

            // pick renderable format - prefer half-float
            if (this.device.extTextureHalfFloat && this.device.textureHalfFloatRenderable) {
                this._renderTextureFormat = Morph.FORMAT_HALF_FLOAT;
            } else if (this.device.extTextureFloat && this.device.textureFloatRenderable) {
                this._renderTextureFormat = Morph.FORMAT_FLOAT;
            }

            // pick texture format - prefer half-float
            if (this.device.extTextureHalfFloat && this.device.textureHalfFloatUpdatable) {
                this._textureFormat = Morph.FORMAT_HALF_FLOAT;
            } else  if (this.device.extTextureFloat) {
                this._textureFormat = Morph.FORMAT_FLOAT;
            }

            // if both available, enable texture morphing
            if (this._renderTextureFormat !== undefined && this._textureFormat !== undefined) {
                this._useTextureMorph = true;
            }
        }

        this._init();
        this._updateMorphFlags();
        this._calculateAabb();
    }

    static FORMAT_FLOAT = 0;

    static FORMAT_HALF_FLOAT = 1;

    get morphPositions() {
        return this._morphPositions;
    }

    get morphNormals() {
        return this._morphNormals;
    }

    get maxActiveTargets() {

        // no limit when texture morph based
        if (this._useTextureMorph)
            return this._targets.length;

        return (this._morphPositions && this._morphNormals) ? 4 : 8;
    }

    get useTextureMorph() {
        return this._useTextureMorph;
    }

    _init() {

        // try to init texture based morphing
        if (this._useTextureMorph) {
            this._useTextureMorph = this._initTextureBased();
        }

        // if texture morphing is not set up, use attribute based morphing
        if (!this._useTextureMorph) {
            for (let i = 0; i < this._targets.length; i++) {
                this._targets[i]._initVertexBuffers(this.device);
            }
        }

        // finalize init
        for (let i = 0; i < this._targets.length; i++) {
            this._targets[i]._postInit();
        }
    }

    _initTextureBased() {
        // collect all source delta arrays to find sparse set of vertices
        const deltaArrays = [], deltaInfos = [];
        for (let i = 0; i < this._targets.length; i++) {
            const target = this._targets[i];
            if (target.options.deltaPositions) {
                deltaArrays.push(target.options.deltaPositions);
                deltaInfos.push({ target: target, name: 'texturePositions' });
            }
            if (target.options.deltaNormals) {
                deltaArrays.push(target.options.deltaNormals);
                deltaInfos.push({ target: target, name: 'textureNormals' });
            }
        }

        // find sparse set for all target deltas into usedDataIndices and build vertex id buffer
        const ids = [], usedDataIndices = [];
        let freeIndex = 1;  // reserve slot 0 for zero delta
        const dataCount = deltaArrays[0].length;
        for (let v = 0; v < dataCount; v += 3) {

            // find if vertex is morphed by any target
            let vertexUsed = false;
            for (let i = 0; i < deltaArrays.length; i++) {
                const data = deltaArrays[i];

                // if non-zero delta
                if (data[v] !== 0 || data[v + 1] !== 0 || data[v + 2] !== 0) {
                    vertexUsed = true;
                    break;
                }
            }

            if (vertexUsed) {
                ids.push(freeIndex + _floatRounding);
                usedDataIndices.push(v / 3);
                freeIndex++;
            } else {
                // non morphed vertices would be all mapped to pixel 0 of texture
                ids.push(0 + _floatRounding);
            }
        }

        // max texture size: vertexBufferIds is stored in float32 format, giving us 2^24 range, so can address 4096 texture at maximum
        // TODO: on webgl2 we could store this in uint32 format and remove this limit
        const maxTextureSize = Math.min(this.device.maxTextureSize, 4096);

        // texture size for freeIndex pixels - roughly square
        let morphTextureWidth = Math.ceil(Math.sqrt(freeIndex));
        morphTextureWidth = Math.min(morphTextureWidth, maxTextureSize);
        const morphTextureHeight = Math.ceil(freeIndex / morphTextureWidth);

        // if data cannot fit into max size texture, fail this set up
        if (morphTextureHeight > maxTextureSize) {
            return false;
        }

        this.morphTextureWidth = morphTextureWidth;
        this.morphTextureHeight = morphTextureHeight;

        // texture format based vars
        let halfFloat = false;
        let numComponents = 3;  // RGB32 is used
        const float2Half = FloatPacking.float2Half;
        if (this._textureFormat === Morph.FORMAT_HALF_FLOAT) {
            halfFloat = true;
            numComponents = 4;  // RGBA16 is used, RGB16 does not work
        }

        // build texture for each delta array, all textures are the same size
        const arraySize = this.morphTextureWidth * this.morphTextureHeight * numComponents;
        const packedDeltas = halfFloat ? new Uint16Array(arraySize) : new Float32Array(arraySize);
        for (let i = 0; i < deltaArrays.length; i++) {
            const data = deltaArrays[i];

            // copy full arrays into sparse arrays and convert format (skip 0th pixel - used by non-morphed vertices)
            for (let v = 0; v < usedDataIndices.length; v++) {
                const index = usedDataIndices[v];

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
            const target = deltaInfos[i].target;
            const format = this._textureFormat === Morph.FORMAT_FLOAT ? PIXELFORMAT_RGB32F : PIXELFORMAT_RGBA16F;
            target._setTexture(deltaInfos[i].name, this._createTexture("MorphTarget", format, packedDeltas));
        }

        // create vertex stream with vertex_id used to map vertex to texture
        const formatDesc = [{ semantic: SEMANTIC_ATTR15, components: 1, type: TYPE_FLOAT32 }];
        this.vertexBufferIds = new VertexBuffer(this.device, new VertexFormat(this.device, formatDesc), ids.length, BUFFER_STATIC, new Float32Array(ids));

        return true;
    }

    /**
     * @function
     * @name Morph#destroy
     * @description Frees video memory allocated by this object.
     */
    destroy() {
        if (this.vertexBufferIds) {
            this.vertexBufferIds.destroy();
            this.vertexBufferIds = null;
        }

        for (let i = 0; i < this._targets.length; i++) {
            this._targets[i].destroy();
        }
        this._targets.length = 0;
    }

    /**
     * @readonly
     * @name Morph#targets
     * @type {MorphTarget[]}
     * @description The array of morph targets.
     */
    get targets() {
        return this._targets;
    }

    _updateMorphFlags() {

        // find out if this morph needs to morph positions and normals
        this._morphPositions = false;
        this._morphNormals = false;
        for (let i = 0; i < this._targets.length; i++) {
            const target = this._targets[i];
            if (target.morphPositions) {
                this._morphPositions = true;
            }
            if (target.morphNormals) {
                this._morphNormals = true;
            }
        }
    }

    _calculateAabb() {

        this.aabb = new BoundingBox(new Vec3(0, 0, 0), new Vec3(0, 0, 0));

        // calc bounding box of the relative change this morph can add
        for (let i = 0; i < this._targets.length; i++) {
            const target = this._targets[i];
            this.aabb._expand(target.aabb.getMin(), target.aabb.getMax());
        }
    }

    // creates texture. Used to create both source morph target data, as well as render target used to morph these into, positions and normals
    _createTexture(name, format, pixelData) {

        const texture = new Texture(this.device, {
            width: this.morphTextureWidth,
            height: this.morphTextureHeight,
            format: format,
            cubemap: false,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
        texture.name = name;

        if (pixelData) {
            texture.lock().set(pixelData);
            texture.unlock();
        }

        return texture;
    }
}

export { Morph };
