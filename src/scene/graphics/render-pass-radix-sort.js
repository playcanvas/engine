import { Debug } from '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { Texture } from '../../platform/graphics/texture.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, FILTER_NEAREST_MIPMAP_NEAREST,
    PIXELFORMAT_R32F, PIXELFORMAT_R32U
} from '../../platform/graphics/constants.js';

import { RenderPassRadixSortCount } from './render-pass-radix-sort-count.js';
import { RenderPassRadixSortReorder } from './render-pass-radix-sort-reorder.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

// Constants for radix sort
const BITS_PER_STEP = 4;  // 4-bit radix (16 buckets)
const GROUP_SIZE = 4;     // Log2 of 16 (16 elements per group)

/**
 * A render pass that performs GPU-based radix sort using mipmap-based prefix sums.
 *
 * This implementation is based on:
 * - VRChat Gaussian Splatting by MichaelMoroz: https://github.com/MichaelMoroz/VRChatGaussianSplatting
 * - Mipmap prefix sum trick by d4rkpl4y3r: https://github.com/d4rkc0d3r/CompactSparseTextureDemo
 *
 * ## Algorithm Overview
 *
 * The sort uses a 4-bit radix (16 buckets) and processes keys in multiple passes,
 * one pass per 4-bit chunk. Each pass consists of:
 *
 * 1. **Count Pass**: For each digit (0-15), count how many keys in each group have that digit.
 *    Output is an R32F texture where each pixel stores a count. Groups are 16 elements.
 *
 * 2. **Mipmap Generation**: Generate mipmaps for the count texture using hardware mipmap
 *    generation. This creates a quadtree of counts that enables efficient binary search.
 *
 * 3. **Reorder Pass**: For each output position, binary search through the mipmap hierarchy
 *    to find which source element maps to it. The mipmap structure enables O(log N) lookup
 *    per element instead of O(N) linear scan.
 *
 * ## Mipmap Prefix Sum Trick
 *
 * The key insight is that mipmaps naturally form a quadtree of averages. By writing counts
 * (e.g., 1.0 for active pixels) into an R32F texture with auto-generated mipmaps:
 *
 * - Each mip level stores the average of the 4 pixels below it
 * - To reconstruct actual counts, multiply by 4^level (i.e., `1 << (level * 2)`)
 * - This gives us a hierarchical prefix sum structure
 *
 * Binary search traversal:
 * - Start at maxMipLevel and work down to level 0
 * - At each level, check 3 quadrants (can skip 4th - if not in first 3, must be in 4th)
 * - Order: bottom-left → bottom-right → top-left → top-right (Z-order/Morton curve)
 * - Accumulate prefix sums while descending to find the target element
 *
 * The Z-order traversal ensures stable sorting: if element A comes before B in the input,
 * it remains before B in the output.
 *
 * ## Internal Data Layout
 *
 * - Internal keys/indices use Morton order (Z-order curve) for better texture cache locality
 * - Source keys texture uses linear (row-major) layout
 * - Output sorted indices use linear layout for simple consumer access
 *
 * ## Complexity
 *
 * - Time: O(N log N) per pass due to mipmap binary search
 * - Passes: ceil(numBits / 4) passes for numBits-bit keys
 * - Memory: 2x keys textures + 2x indices textures + 1x prefix sums texture (all power-of-2)
 *
 * @category Graphics
 * @ignore
 */
class RenderPassRadixSort extends RenderPass {
    /**
     * The current sorted indices texture (R32U). Access sorted indices using Morton lookup.
     *
     * @type {Texture|null}
     */
    _currentIndices = null;

    /**
     * Current number of radix passes.
     *
     * @type {number}
     */
    _numPasses = 0;

    /**
     * Current internal texture size (power of 2).
     *
     * @type {number}
     */
    _internalSize = 0;

    /**
     * Internal keys texture 0 (ping-pong buffer).
     *
     * @type {Texture|null}
     */
    _keys0 = null;

    /**
     * Internal keys texture 1 (ping-pong buffer).
     *
     * @type {Texture|null}
     */
    _keys1 = null;

    /**
     * Internal indices texture 0 (ping-pong buffer).
     *
     * @type {Texture|null}
     */
    _indices0 = null;

    /**
     * Internal indices texture 1 (ping-pong buffer).
     *
     * @type {Texture|null}
     */
    _indices1 = null;

    /**
     * Prefix sums texture (R32F with mipmaps).
     *
     * @type {Texture|null}
     */
    _prefixSums = null;

    /**
     * Sort render target 0 (MRT for keys + indices).
     *
     * @type {RenderTarget|null}
     */
    _sortRT0 = null;

    /**
     * Sort render target 1 (MRT for keys + indices).
     *
     * @type {RenderTarget|null}
     */
    _sortRT1 = null;

    /**
     * Prefix sums render target.
     *
     * @type {RenderTarget|null}
     */
    _prefixSumsRT = null;

    /**
     * Count passes for each radix iteration.
     *
     * @type {RenderPassRadixSortCount[]}
     */
    _countPasses = [];

    /**
     * Reorder passes for each radix iteration.
     *
     * @type {RenderPassRadixSortReorder[]}
     */
    _reorderPasses = [];

    /**
     * Number of elements to sort (set by setup()).
     *
     * @type {number}
     */
    _elementCount = 0;

    /**
     * The source keys texture (set by setup()).
     *
     * @type {Texture|null}
     */
    _keysTexture = null;

    /**
     * Creates a new RenderPassRadixSort instance.
     *
     * @param {GraphicsDevice} device - The graphics device.
     */
    // eslint-disable-next-line no-useless-constructor
    constructor(device) {
        super(device);
    }

    /**
     * Gets the sorted indices texture (R32U, linear layout). Use `.width` for texture dimensions.
     * Access with: `texelFetch(texture, ivec2(index % width, index / width), 0).r`
     *
     * @type {Texture|null}
     */
    get sortedIndices() {
        return this._currentIndices;
    }

    /**
     * Sets up the sort for the current frame.
     *
     * Note: The source keys texture is read-only and can be any size.
     * The sorted indices will be in a separate power-of-2 texture.
     *
     * @param {Texture} keysTexture - R32U texture containing sort keys (linear layout, any size).
     * @param {number} elementCount - Number of elements to sort.
     * @param {number} [numBits] - Number of bits to sort (1-24). More bits = more passes.
     */
    setup(keysTexture, elementCount, numBits = 16) {
        Debug.assert(keysTexture, 'RenderPassRadixSort.setup: keysTexture is required');
        Debug.assert(elementCount > 0, 'RenderPassRadixSort.setup: elementCount must be > 0');
        Debug.assert(numBits >= 1 && numBits <= 24, 'RenderPassRadixSort.setup: numBits must be 1-24');

        this._keysTexture = keysTexture;
        this._elementCount = elementCount;

        // Check if number of passes changed - only recreate if needed
        // (e.g., 11 and 12 bits both need 3 passes, so no recreation needed)
        const numPasses = Math.ceil(numBits / BITS_PER_STEP);
        if (numPasses !== this._numPasses) {
            this._destroyPasses();
            this._numPasses = numPasses;
        }

        // Calculate required internal texture size (power of 2)
        const requiredSize = this._calculateInternalSize(elementCount);
        if (requiredSize !== this._internalSize) {
            // Need to destroy passes first since they reference old render targets
            this._destroyPasses();
            this._resizeInternalTextures(requiredSize);
            this._internalSize = requiredSize;
        }

        // Create passes if needed
        if (this._countPasses.length === 0) {
            this._createPasses();
        }
    }

    /**
     * Calculates the required power-of-2 texture size for the given element count.
     *
     * @param {number} elementCount - Number of elements.
     * @returns {number} Power-of-2 size.
     * @private
     */
    _calculateInternalSize(elementCount) {
        // Need square power-of-2 texture that can hold elementCount elements
        const side = Math.ceil(Math.sqrt(elementCount));
        return Math.pow(2, Math.ceil(Math.log2(side)));
    }

    /**
     * Creates or resizes internal textures.
     *
     * @param {number} size - Power-of-2 size for textures.
     * @private
     */
    _resizeInternalTextures(size) {

        // Destroy old textures
        this._destroyInternalTextures();

        // Keys textures (R32U, Morton layout)
        this._keys0 = this._createTexture('RadixSortKeys0', size, PIXELFORMAT_R32U);
        this._keys1 = this._createTexture('RadixSortKeys1', size, PIXELFORMAT_R32U);

        // Indices textures (R32U, Morton layout)
        this._indices0 = this._createTexture('RadixSortIndices0', size, PIXELFORMAT_R32U);
        this._indices1 = this._createTexture('RadixSortIndices1', size, PIXELFORMAT_R32U);

        // Prefix sums texture (R32F with mipmaps)
        // This texture has one pixel per (digit, group) combination:
        // - With 4-bit radix: 16 possible digit values (0-15)
        // - With group size 16: numGroups = size² / 16
        // - Total pixels needed: 16 digits × (size² / 16) groups = size² pixels
        // General formula: size * 2^(bitsPerStep/2) / 2^(groupSize/2)
        // With bitsPerStep=4, groupSize=4: size * 4 / 4 = size (same as keys texture)
        // Note: With current constants, prefixSize === size. The formula is kept general
        // in case we ever change to a different radix (e.g., 8-bit would need larger texture).
        const prefixSize = size * Math.pow(2, BITS_PER_STEP / 2) / Math.pow(2, GROUP_SIZE / 2);
        this._prefixSums = this._createTexture('RadixSortPrefixSums', prefixSize, PIXELFORMAT_R32F, true);

        // Create MRT render targets (keys + indices)
        this._sortRT0 = new RenderTarget({
            name: 'RadixSortRT0',
            colorBuffers: [this._keys0, this._indices0],
            depth: false
        });

        this._sortRT1 = new RenderTarget({
            name: 'RadixSortRT1',
            colorBuffers: [this._keys1, this._indices1],
            depth: false
        });

        // Render target for prefix sums
        this._prefixSumsRT = new RenderTarget({
            name: 'RadixSortPrefixSumsRT',
            colorBuffer: this._prefixSums,
            depth: false
        });
    }

    /**
     * Creates a texture for radix sort.
     *
     * @param {string} name - Texture name.
     * @param {number} size - Texture size.
     * @param {number} format - Pixel format (PIXELFORMAT_R32U or PIXELFORMAT_R32F).
     * @param {boolean} [mipmaps] - Whether to generate mipmaps. Defaults to false.
     * @returns {Texture} The created texture.
     * @private
     */
    _createTexture(name, size, format, mipmaps = false) {
        return new Texture(this.device, {
            name: name,
            width: size,
            height: size,
            format: format,
            mipmaps: mipmaps,
            minFilter: mipmaps ? FILTER_NEAREST_MIPMAP_NEAREST : FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
    }

    /**
     * Destroys internal textures and render targets.
     *
     * @private
     */
    _destroyInternalTextures() {
        this._sortRT0?.destroy();
        this._sortRT1?.destroy();
        this._prefixSumsRT?.destroy();

        this._keys0?.destroy();
        this._keys1?.destroy();
        this._indices0?.destroy();
        this._indices1?.destroy();
        this._prefixSums?.destroy();

        this._sortRT0 = null;
        this._sortRT1 = null;
        this._prefixSumsRT = null;
        this._keys0 = null;
        this._keys1 = null;
        this._indices0 = null;
        this._indices1 = null;
        this._prefixSums = null;
    }

    /**
     * Creates the sort passes based on numBits.
     * Sets up beforePasses with the complete pass sequence (count, mipmap, reorder for each iteration).
     *
     * @private
     */
    _createPasses() {
        const device = this.device;
        const numPasses = this._numPasses;

        // Ping-pong state for render target assignment (deterministic)
        let nextRT = this._sortRT1;

        // Create count, mipmap, and reorder passes in order
        for (let i = 0; i < numPasses; i++) {
            const sourceLinear = (i === 0);
            const outputLinear = (i === numPasses - 1);

            const currentBit = i * BITS_PER_STEP;

            // Count pass - renders to R32F prefix sums texture (mipmaps auto-generated after render)
            const countPass = new RenderPassRadixSortCount(device, sourceLinear, BITS_PER_STEP, GROUP_SIZE, currentBit);
            countPass.init(this._prefixSumsRT);
            countPass.setClearColor(new Color(0, 0, 0, 0));
            this._countPasses.push(countPass);
            this.beforePasses.push(countPass);

            // Reorder pass - renders to R32U keys/indices textures
            // Last pass outputs linear layout for simpler consumer access
            const reorderPass = new RenderPassRadixSortReorder(device, sourceLinear, outputLinear, BITS_PER_STEP, GROUP_SIZE, currentBit);
            reorderPass.setPrefixSumsTexture(this._prefixSums);
            reorderPass.init(nextRT);
            this._reorderPasses.push(reorderPass);
            this.beforePasses.push(reorderPass);

            // Swap RT for next iteration
            nextRT = (nextRT === this._sortRT1) ? this._sortRT0 : this._sortRT1;
        }

        // Determine which indices texture will contain the final result
        // After numPasses swaps: odd = _indices1, even = _indices0
        this._currentIndices = (numPasses % 2 === 1) ? this._indices1 : this._indices0;
    }

    /**
     * Destroys all sort passes.
     *
     * @private
     */
    _destroyPasses() {
        // Destroy all passes in beforePasses (includes count and reorder passes)
        for (const pass of this.beforePasses) {
            pass.destroy();
        }
        this.beforePasses.length = 0;
        this._countPasses.length = 0;
        this._reorderPasses.length = 0;
    }

    frameUpdate() {
        super.frameUpdate();

        if (!this._keysTexture || this._countPasses.length === 0) {
            return;
        }

        const numPasses = this._countPasses.length;

        // Calculate dynamic params for this frame
        const elementCount = this._elementCount;
        const imageElementsLog2 = Math.log2(this._internalSize * this._internalSize);
        const imageSize = this._internalSize;

        // Ping-pong state for texture assignment
        let currentKeys = this._keys0;
        let currentIndices = this._indices0;

        // Update dynamic properties for each pass (pass sequence is already set up in _createPasses)
        for (let i = 0; i < numPasses; i++) {
            const sourceLinear = (i === 0);
            const countPass = this._countPasses[i];
            const reorderPass = this._reorderPasses[i];

            // Configure count pass textures and dynamic params
            if (sourceLinear) {
                countPass.setKeysTexture(this._keysTexture);
            } else {
                countPass.setKeysTexture(currentKeys);
            }
            countPass.setDynamicParams(elementCount, imageElementsLog2);

            // Configure reorder pass textures and dynamic params
            if (sourceLinear) {
                reorderPass.setKeysTexture(this._keysTexture);
                // First pass doesn't need indices texture (implicitly [0,1,2,...])
            } else {
                reorderPass.setKeysTexture(currentKeys);
                reorderPass.setIndicesTexture(currentIndices);
            }
            reorderPass.setDynamicParams(elementCount, imageElementsLog2, imageSize);

            // Swap ping-pong buffers for next iteration
            currentKeys = (currentKeys === this._keys0) ? this._keys1 : this._keys0;
            currentIndices = (currentIndices === this._indices0) ? this._indices1 : this._indices0;
        }
    }

    /**
     * Executes the GPU radix sort. This is a convenience method that combines setup, frameUpdate,
     * and rendering all passes in one call.
     *
     * @param {Texture} keysTexture - R32U texture containing sort keys (linear layout, any size).
     * @param {number} elementCount - Number of elements to sort.
     * @param {number} [numBits] - Number of bits to sort (1-24). More bits = more passes. Defaults to 16.
     * @returns {Texture} The sorted indices texture (R32U, linear layout).
     */
    sort(keysTexture, elementCount, numBits = 16) {
        this.setup(keysTexture, elementCount, numBits);
        this.frameUpdate();
        for (const pass of this.beforePasses) {
            pass.render();
        }
        return this.sortedIndices;
    }

    destroy() {
        this._destroyPasses();
        this._destroyInternalTextures();
        super.destroy();
    }
}

export { RenderPassRadixSort };
