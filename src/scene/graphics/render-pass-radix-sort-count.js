import { SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { RenderPassShaderQuad } from './render-pass-shader-quad.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import { ShaderChunks } from '../shader-lib/shader-chunks.js';
import glslRadixSortCountPS from '../shader-lib/glsl/chunks/radix-sort/radix-sort-count.js';
import glslRadixSortCountQuad from '../shader-lib/glsl/chunks/radix-sort/radix-sort-count-quad.js';
import wgslRadixSortCountPS from '../shader-lib/wgsl/chunks/radix-sort/radix-sort-count.js';
import wgslRadixSortCountQuad from '../shader-lib/wgsl/chunks/radix-sort/radix-sort-count-quad.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

/**
 * Render pass that counts digit occurrences per group (Pass 0 of radix sort).
 * Outputs to R32F prefix sums texture.
 *
 * Has two variants:
 * - sourceLinear=true: First pass, reads from user's linear-layout texture
 * - sourceLinear=false: Subsequent passes, reads from internal Morton-layout texture
 *
 * @category Graphics
 * @ignore
 */
class RenderPassRadixSortCount extends RenderPassShaderQuad {
    /**
     * Whether this pass reads from linear-layout source texture (first pass).
     *
     * @type {boolean}
     */
    sourceLinear = false;

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
     * @type {{elementCount: number, imageElementsLog2: number}}
     * @private
     */
    _dynamicParams = { elementCount: 0, imageElementsLog2: 0 };

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {boolean} sourceLinear - Whether to read from linear-layout source texture.
     * @param {number} bitsPerStep - Bits per radix step (usually 4).
     * @param {number} groupSize - Log2 of group size (usually 4 for 16 elements).
     * @param {number} currentBit - Current bit offset for this pass.
     */
    constructor(device, sourceLinear, bitsPerStep, groupSize, currentBit) {
        super(device);

        this.sourceLinear = sourceLinear;
        this.bitsPerStep = bitsPerStep;
        this.groupSize = groupSize;
        this.currentBit = currentBit;

        // Register shader chunks (main shader + quad include chunk)
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('radixSortCountPS', glslRadixSortCountPS);
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('radixSortCountQuad', glslRadixSortCountQuad);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('radixSortCountPS', wgslRadixSortCountPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('radixSortCountQuad', wgslRadixSortCountQuad);

        const defines = new Map();
        if (sourceLinear) {
            defines.set('SOURCE_LINEAR', '');
        }

        const shaderName = sourceLinear ? 'RadixSortCountShaderLinear' : 'RadixSortCountShader';

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: shaderName,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: 'radixSortCountPS',
            fragmentDefines: defines,
            fragmentOutputTypes: 'float'
        });

        // Resolve uniform locations
        this.keysTextureId = device.scope.resolve('keysTexture');
        this.bitsPerStepId = device.scope.resolve('bitsPerStep');
        this.groupSizeId = device.scope.resolve('groupSize');
        this.elementCountId = device.scope.resolve('elementCount');
        this.imageElementsLog2Id = device.scope.resolve('imageElementsLog2');
        this.currentBitId = device.scope.resolve('currentBit');
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
     * Sets dynamic parameters (called each frame).
     *
     * @param {number} elementCount - Number of elements to sort.
     * @param {number} imageElementsLog2 - Log2 of total texture elements.
     */
    setDynamicParams(elementCount, imageElementsLog2) {
        this._dynamicParams.elementCount = elementCount;
        this._dynamicParams.imageElementsLog2 = imageElementsLog2;
    }

    execute() {
        this.keysTextureId.setValue(this._keysTexture);
        this.bitsPerStepId.setValue(this.bitsPerStep);
        this.groupSizeId.setValue(this.groupSize);
        this.elementCountId.setValue(this._dynamicParams.elementCount);
        this.imageElementsLog2Id.setValue(this._dynamicParams.imageElementsLog2);
        this.currentBitId.setValue(this.currentBit);

        super.execute();
    }
}

export { RenderPassRadixSortCount };
