import { Debug } from '../core/debug.js';
import { RefCountedObject } from '../core/ref-counted-object.js';
import { Vec3 } from '../core/math/vec3.js';
import { FloatPacking } from '../core/math/float-packing.js';
import { BoundingBox } from '../core/shape/bounding-box.js';
import { Texture } from '../platform/graphics/texture.js';
import { VertexBuffer } from '../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../platform/graphics/vertex-format.js';

import {
    TYPE_UINT32, SEMANTIC_ATTR15, ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST,
    PIXELFORMAT_RGBA16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA32F
} from '../platform/graphics/constants.js';

/**
 * Contains a list of {@link MorphTarget}s, a combined delta AABB and some associated data.
 *
 * @category Graphics
 */
class Morph extends RefCountedObject {
    /**
     * @type {BoundingBox}
     * @private
     */
    _aabb;

    /** @type {boolean} */
    preferHighPrecision;

    /**
     * Create a new Morph instance.
     *
     * @param {import('./morph-target.js').MorphTarget[]} targets - A list of morph targets.
     * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice -
     * The graphics device used to manage this morph target.
     * @param {object} [options] - Object for passing optional arguments.
     * @param {boolean} [options.preferHighPrecision] - True if high precision storage should be
     * preferred. This is faster to create and allows higher precision, but takes more memory and
     * might be slower to render. Defaults to false.
     */
    constructor(targets, graphicsDevice, { preferHighPrecision = false } = {}) {
        super();

        Debug.assert(graphicsDevice, "Morph constructor takes a GraphicsDevice as a parameter, and it was not provided.");
        this.device = graphicsDevice;

        this.preferHighPrecision = preferHighPrecision;

        // validation
        Debug.assert(targets.every(target => !target.used), 'A specified target has already been used to create a Morph, use its clone instead.');
        this._targets = targets.slice();

        // default to texture based morphing if available
        const device = this.device;
        if (device.supportsMorphTargetTexturesCore) {

            // renderable format
            const renderableHalf = device.textureHalfFloatRenderable ? PIXELFORMAT_RGBA16F : undefined;
            const renderableFloat = device.textureFloatRenderable ? PIXELFORMAT_RGBA32F : undefined;
            this._renderTextureFormat = this.preferHighPrecision ?
                (renderableFloat ?? renderableHalf) : (renderableHalf ?? renderableFloat);

            // texture format - both are always supported
            this._textureFormat = this.preferHighPrecision ? PIXELFORMAT_RGB32F : PIXELFORMAT_RGBA16F;

            // if the render format is available, enable texture morphing
            if (this._renderTextureFormat !== undefined) {
                this._useTextureMorph = true;
            }
        }

        this._init();
        this._updateMorphFlags();
    }

    get aabb() {

        // lazy evaluation, which allows us to skip this completely if customAABB is used
        if (!this._aabb) {
            // calculate min and max expansion size
            // Note: This represents average case, where most morph targets expand the mesh within the same area. It does not
            // represent the stacked worst case scenario where all morphs could be enabled at the same time, as this can result
            // in a very large aabb. In cases like this, the users should specify customAabb for Model/Render component.
            const min = new Vec3();
            const max = new Vec3();
            for (let i = 0; i < this._targets.length; i++) {
                const targetAabb = this._targets[i].aabb;
                min.min(targetAabb.getMin());
                max.max(targetAabb.getMax());
            }

            this._aabb = new BoundingBox();
            this._aabb.setMinMax(min, max);
        }

        return this._aabb;
    }

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

    _findSparseSet(deltaArrays, ids, usedDataIndices) {

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
                ids.push(freeIndex);
                usedDataIndices.push(v / 3);
                freeIndex++;
            } else {
                // non morphed vertices would be all mapped to pixel 0 of texture
                ids.push(0);
            }
        }

        return freeIndex;
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
        const freeIndex = this._findSparseSet(deltaArrays, ids, usedDataIndices);

        // texture size for freeIndex pixels - roughly square
        const maxTextureSize = this.device.maxTextureSize;
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
        if (this._textureFormat === PIXELFORMAT_RGBA16F) {
            halfFloat = true;
            numComponents = 4;  // RGBA16 is used, RGB16 does not work
        }

        // create textures
        const textures = [];
        for (let i = 0; i < deltaArrays.length; i++) {
            textures.push(this._createTexture('MorphTarget', this._textureFormat));
        }

        // build texture for each delta array, all textures are the same size
        for (let i = 0; i < deltaArrays.length; i++) {
            const data = deltaArrays[i];
            const texture = textures[i];
            const textureData = texture.lock();

            // copy full arrays into sparse arrays and convert format (skip 0th pixel - used by non-morphed vertices)
            if (halfFloat) {

                for (let v = 0; v < usedDataIndices.length; v++) {
                    const index = usedDataIndices[v] * 3;
                    const dstIndex = v * numComponents + numComponents;
                    textureData[dstIndex] = float2Half(data[index]);
                    textureData[dstIndex + 1] = float2Half(data[index + 1]);
                    textureData[dstIndex + 2] = float2Half(data[index + 2]);
                }

            } else {

                for (let v = 0; v < usedDataIndices.length; v++) {
                    const index = usedDataIndices[v] * 3;
                    const dstIndex = v * numComponents + numComponents;
                    textureData[dstIndex] = data[index];
                    textureData[dstIndex + 1] = data[index + 1];
                    textureData[dstIndex + 2] = data[index + 2];
                }
            }

            // assign texture to target
            texture.unlock();
            const target = deltaInfos[i].target;
            target._setTexture(deltaInfos[i].name, texture);
        }

        // create vertex stream with vertex_id used to map vertex to texture
        const formatDesc = [{ semantic: SEMANTIC_ATTR15, components: 1, type: TYPE_UINT32, asInt: true }];
        this.vertexBufferIds = new VertexBuffer(this.device, new VertexFormat(this.device, formatDesc, ids.length), ids.length, {
            data: new Uint32Array(ids)
        });

        return true;
    }

    /**
     * Frees video memory allocated by this object.
     */
    destroy() {
        this.vertexBufferIds?.destroy();
        this.vertexBufferIds = null;

        for (let i = 0; i < this._targets.length; i++) {
            this._targets[i].destroy();
        }
        this._targets.length = 0;
    }

    /**
     * Gets the array of morph targets.
     *
     * @type {import('./morph-target.js').MorphTarget[]}
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

    /**
     * Creates texture. Used to create both source morph target data, as well as render target used
     * to morph these into, positions and normals.
     *
     * @param {string} name - The name of the texture.
     * @param {number} format - The format of the texture.
     * @returns {Texture} The created texture.
     * @private
     */
    _createTexture(name, format) {
        return new Texture(this.device, {
            width: this.morphTextureWidth,
            height: this.morphTextureHeight,
            format: format,
            cubemap: false,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            name: name
        });
    }
}

export { Morph };
