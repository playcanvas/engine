import { SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { RenderPassShaderQuad } from './render-pass-shader-quad.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import { ShaderChunks } from '../shader-lib/shader-chunks.js';
import glslRadixSortReorderPS from '../shader-lib/glsl/chunks/radix-sort/radix-sort-reorder.js';
import wgslRadixSortReorderPS from '../shader-lib/wgsl/chunks/radix-sort/radix-sort-reorder.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

/**
 * Render pass that reorders elements using binary search through mipmap hierarchy
 * (Pass 1 of radix sort). Uses MRT to output both keys (R32U) and indices (R32U).
 *
 * Has multiple variants:
 * - sourceLinear=true: First pass, reads keys from user's linear-layout texture
 * - sourceLinear=false: Subsequent passes, reads keys from internal Morton-layout texture
 * - outputLinear=true: Outputs indices in linear layout (simpler for consumers)
 *
 * @category Graphics
 * @ignore
 */
class RenderPassRadixSortReorder extends RenderPassShaderQuad {
    /**
     * Whether this pass reads from linear-layout source texture (first pass).
     *
     * @type {boolean}
     */
    sourceLinear = false;

    /**
     * Whether to output indices in linear layout.
     *
     * @type {boolean}
     */
    outputLinear = false;

    /**
     * Bits per radix step (usually 4).
     *
     * @type {number}
     */
    bitsPerStep = 0;

    /**
     * Log2 of group size (usually 4 for 16 elements).
     *
     * @type {number}
     */
    groupSize = 0;

    /**
     * Current bit offset for this pass.
     *
     * @type {number}
     */
    currentBit = 0;

    /**
     * Dynamic params updated per frame.
     *
     * @type {{elementCount: number, imageElementsLog2: number, imageSize: number}}
     * @private
     */
    _dynamicParams = { elementCount: 0, imageElementsLog2: 0, imageSize: 0 };

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {boolean} sourceLinear - Whether to read from linear-layout source texture.
     * @param {boolean} outputLinear - Whether to output indices in linear layout.
     * @param {number} bitsPerStep - Bits per radix step (usually 4).
     * @param {number} groupSize - Log2 of group size (usually 4 for 16 elements).
     * @param {number} currentBit - Current bit offset for this pass.
     */
    constructor(device, sourceLinear, outputLinear, bitsPerStep, groupSize, currentBit) {
        super(device);

        this.sourceLinear = sourceLinear;
        this.outputLinear = outputLinear;
        this.bitsPerStep = bitsPerStep;
        this.groupSize = groupSize;
        this.currentBit = currentBit;

        // Register shader chunks
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('radixSortReorderPS', glslRadixSortReorderPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('radixSortReorderPS', wgslRadixSortReorderPS);

        const defines = new Map();
        if (sourceLinear) {
            defines.set('SOURCE_LINEAR', '');
        }
        if (outputLinear) {
            defines.set('OUTPUT_LINEAR', '');
        }

        let shaderName = 'RadixSortReorderShader';
        if (sourceLinear) shaderName += 'SourceLinear';
        if (outputLinear) shaderName += 'OutputLinear';

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: shaderName,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: 'radixSortReorderPS',
            fragmentDefines: defines,
            fragmentOutputTypes: ['uvec4', 'uvec4']  // MRT: keys (uint) and indices (uint)
        });

        // Resolve uniform locations
        this.keysTextureId = device.scope.resolve('keysTexture');
        if (!sourceLinear) {
            // Non-first passes need indices texture
            this.indicesTextureId = device.scope.resolve('indicesTexture');
        }
        this.prefixSumsId = device.scope.resolve('prefixSums');
        this.bitsPerStepId = device.scope.resolve('bitsPerStep');
        this.groupSizeId = device.scope.resolve('groupSize');
        this.elementCountId = device.scope.resolve('elementCount');
        this.imageElementsLog2Id = device.scope.resolve('imageElementsLog2');
        this.currentBitId = device.scope.resolve('currentBit');
        this.imageSizeId = device.scope.resolve('imageSize');
    }

    /**
     * Sets the keys texture to read from.
     *
     * @param {Texture} keysTexture - The keys texture (R32U).
     */
    setKeysTexture(keysTexture) {
        this._keysTexture = keysTexture;
    }

    /**
     * Sets the indices texture to read from.
     *
     * @param {Texture} indicesTexture - The indices texture (R32U).
     */
    setIndicesTexture(indicesTexture) {
        this._indicesTexture = indicesTexture;
    }

    /**
     * Sets the prefix sums texture.
     *
     * @param {Texture} prefixSums - The prefix sums texture (R32F with mipmaps).
     */
    setPrefixSumsTexture(prefixSums) {
        this._prefixSums = prefixSums;
    }

    /**
     * Sets dynamic parameters (called each frame).
     *
     * @param {number} elementCount - Number of elements to sort.
     * @param {number} imageElementsLog2 - Log2 of total texture elements.
     * @param {number} imageSize - Size of the internal texture (power of 2).
     */
    setDynamicParams(elementCount, imageElementsLog2, imageSize) {
        this._dynamicParams.elementCount = elementCount;
        this._dynamicParams.imageElementsLog2 = imageElementsLog2;
        this._dynamicParams.imageSize = imageSize;
    }

    execute() {
        this.keysTextureId.setValue(this._keysTexture);
        if (!this.sourceLinear) {
            this.indicesTextureId.setValue(this._indicesTexture);
        }

        this.prefixSumsId.setValue(this._prefixSums);

        this.bitsPerStepId.setValue(this.bitsPerStep);
        this.groupSizeId.setValue(this.groupSize);
        this.elementCountId.setValue(this._dynamicParams.elementCount);
        this.imageElementsLog2Id.setValue(this._dynamicParams.imageElementsLog2);
        this.currentBitId.setValue(this.currentBit);
        this.imageSizeId.setValue(this._dynamicParams.imageSize);

        super.execute();
    }
}

export { RenderPassRadixSortReorder };
