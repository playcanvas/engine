import { Texture } from '../../platform/graphics/texture.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import {
    BUFFERUSAGE_COPY_DST, BUFFERUSAGE_COPY_SRC, BUFFERUSAGE_INDIRECT,
    FILTER_NEAREST,
    PIXELFORMAT_R32U, PIXELFORMAT_RGBA16F
} from '../../platform/graphics/constants.js';
import { PrefixSumKernel } from '../graphics/prefix-sum-kernel.js';

/**
 * @import { Compute } from '../../platform/graphics/compute.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { BindGroupFormat } from '../../platform/graphics/bind-group-format.js'
 */

const MAX_CHUNKS_PER_TILE = 8;

/**
 * Persistent per-dispatch resource container for the local compute gsplat renderer. Each dispatch
 * set holds its own Compute instances (for independent parameter state), tile-dependent
 * StorageBuffers (sized per resolution), a PrefixSumKernel, and mode-specific output textures.
 * Splat/entry-dependent buffers (projCache, tileEntries) are shared on the renderer and bound
 * to these Compute instances via setParameter before each dispatch.
 *
 * @ignore
 */
class GSplatLocalDispatchSet {
    /** @type {GraphicsDevice} */
    device;

    /** @type {boolean} */
    pickMode;

    /** @type {Compute} */
    countCompute;

    /** @type {Compute} */
    scatterCompute;

    /** @type {Compute} */
    classifyCompute;

    /** @type {Compute} */
    sortCompute;

    /** @type {Compute} */
    bucketSortCompute;

    /** @type {Compute} */
    copyCompute;

    /** @type {Compute} */
    chunkSortCompute;

    /** @type {Compute} */
    rasterizeCompute;

    /** @type {PrefixSumKernel} */
    prefixSumKernel;

    /** @type {StorageBuffer|null} */
    _tileSplatCountsBuffer = null;

    /** @type {StorageBuffer|null} */
    _tileWriteCursorsBuffer = null;

    /** @type {StorageBuffer|null} */
    _smallTileListBuffer = null;

    /** @type {StorageBuffer|null} */
    _largeTileListBuffer = null;

    /** @type {StorageBuffer|null} */
    _largeTileOverflowBasesBuffer = null;

    /** @type {StorageBuffer|null} */
    _rasterizeTileListBuffer = null;

    /** @type {StorageBuffer|null} */
    _tileListCountsBuffer = null;

    /** @type {StorageBuffer|null} */
    _chunkRangesBuffer = null;

    /** @type {StorageBuffer|null} */
    _totalChunksBuffer = null;

    /** @type {StorageBuffer|null} */
    _chunkSortIndirectBuffer = null;

    /** @type {number} */
    _allocatedTileCapacity = 0;

    /** @type {Texture|null} Color mode output */
    outputTexture = null;

    /** @type {Texture|null} Pick mode: splat ID output (r32uint) */
    pickIdTexture = null;

    /** @type {Texture|null} Pick mode: depth output (rgba16float) */
    pickDepthTexture = null;

    /** @type {BindGroupFormat|null} Mode-specific rasterize bind group format */
    rasterizeBindGroupFormat = null;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {boolean} pickMode - Whether this set is for picking.
     */
    constructor(device, pickMode) {
        this.device = device;
        this.pickMode = pickMode;
        this.prefixSumKernel = new PrefixSumKernel(device);

        if (pickMode) {
            this.pickIdTexture = new Texture(device, {
                name: 'GSplatLocalPickId',
                width: 4,
                height: 4,
                format: PIXELFORMAT_R32U,
                mipmaps: false,
                minFilter: FILTER_NEAREST,
                magFilter: FILTER_NEAREST,
                storage: true
            });
            this.pickDepthTexture = new Texture(device, {
                name: 'GSplatLocalPickDepth',
                width: 4,
                height: 4,
                format: PIXELFORMAT_RGBA16F,
                mipmaps: false,
                minFilter: FILTER_NEAREST,
                magFilter: FILTER_NEAREST,
                storage: true
            });
        } else {
            this.outputTexture = new Texture(device, {
                name: 'GSplatLocalComputeOutput',
                width: 4,
                height: 4,
                format: PIXELFORMAT_RGBA16F,
                mipmaps: false,
                minFilter: FILTER_NEAREST,
                magFilter: FILTER_NEAREST,
                storage: true
            });
        }
    }

    /**
     * Resize mode-specific output textures.
     *
     * @param {number} width - Target width in pixels.
     * @param {number} height - Target height in pixels.
     */
    resizeOutputTextures(width, height) {
        if (this.pickMode) {
            this.pickIdTexture?.resize(width, height);
            this.pickDepthTexture?.resize(width, height);
        } else {
            this.outputTexture?.resize(width, height);
        }
    }

    /**
     * Ensure tile-dependent buffers are large enough for the given tile count.
     *
     * @param {number} numTiles - Total number of screen tiles.
     */
    ensureTileBuffers(numTiles) {
        const requiredTileSlots = numTiles + 1;
        if (requiredTileSlots <= this._allocatedTileCapacity) return;

        this._tileSplatCountsBuffer?.destroy();
        this._tileWriteCursorsBuffer?.destroy();
        this._smallTileListBuffer?.destroy();
        this._largeTileListBuffer?.destroy();
        this._largeTileOverflowBasesBuffer?.destroy();
        this._rasterizeTileListBuffer?.destroy();
        this._tileListCountsBuffer?.destroy();
        this._chunkRangesBuffer?.destroy();
        this._totalChunksBuffer?.destroy();
        this._chunkSortIndirectBuffer?.destroy();

        this._allocatedTileCapacity = requiredTileSlots;
        this._tileSplatCountsBuffer = new StorageBuffer(this.device, requiredTileSlots * 4, BUFFERUSAGE_COPY_DST | BUFFERUSAGE_COPY_SRC);
        this._tileWriteCursorsBuffer = new StorageBuffer(this.device, numTiles * 4, BUFFERUSAGE_COPY_DST);
        this._smallTileListBuffer = new StorageBuffer(this.device, numTiles * 4);
        this._largeTileListBuffer = new StorageBuffer(this.device, numTiles * 4);
        this._largeTileOverflowBasesBuffer = new StorageBuffer(this.device, numTiles * 4);
        this._rasterizeTileListBuffer = new StorageBuffer(this.device, numTiles * 4);
        this._tileListCountsBuffer = new StorageBuffer(this.device, 4 * 4, BUFFERUSAGE_COPY_DST | BUFFERUSAGE_COPY_SRC);

        const maxChunks = numTiles * MAX_CHUNKS_PER_TILE;
        this._chunkRangesBuffer = new StorageBuffer(this.device, maxChunks * 8);
        this._totalChunksBuffer = new StorageBuffer(this.device, 1 * 4, BUFFERUSAGE_COPY_DST);
        this._chunkSortIndirectBuffer = new StorageBuffer(this.device, 3 * 4, BUFFERUSAGE_COPY_DST | BUFFERUSAGE_INDIRECT);

        this.prefixSumKernel.destroyPasses();
    }

    destroy() {
        this._tileSplatCountsBuffer?.destroy();
        this._tileWriteCursorsBuffer?.destroy();
        this._smallTileListBuffer?.destroy();
        this._largeTileListBuffer?.destroy();
        this._largeTileOverflowBasesBuffer?.destroy();
        this._rasterizeTileListBuffer?.destroy();
        this._tileListCountsBuffer?.destroy();
        this._chunkRangesBuffer?.destroy();
        this._totalChunksBuffer?.destroy();
        this._chunkSortIndirectBuffer?.destroy();

        this.prefixSumKernel.destroy();

        this.outputTexture?.destroy();
        this.pickIdTexture?.destroy();
        this.pickDepthTexture?.destroy();

        this.rasterizeBindGroupFormat?.destroy();
    }
}

export { GSplatLocalDispatchSet };
