import { Vec2 } from '../../core/math/vec2.js';
import { Compute } from '../../platform/graphics/compute.js';
import { Shader } from '../../platform/graphics/shader.js';
import { Texture } from '../../platform/graphics/texture.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { BindGroupFormat, BindStorageBufferFormat, BindStorageTextureFormat, BindTextureFormat, BindUniformBufferFormat } from '../../platform/graphics/bind-group-format.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import {
    BUFFERUSAGE_COPY_DST, BUFFERUSAGE_COPY_SRC, BUFFERUSAGE_INDIRECT,
    FILTER_NEAREST,
    PIXELFORMAT_RGBA8,
    SAMPLETYPE_UINT,
    SHADERLANGUAGE_WGSL,
    SHADERSTAGE_COMPUTE,
    UNIFORMTYPE_FLOAT,
    UNIFORMTYPE_MAT4,
    UNIFORMTYPE_UINT
} from '../../platform/graphics/constants.js';
import { GSPLAT_FORWARD, PROJECTION_ORTHOGRAPHIC, tonemapNames, gammaNames } from '../constants.js';
import { Mat4 } from '../../core/math/mat4.js';
import { GSplatRenderer } from './gsplat-renderer.js';
import { FramePassGSplatComputeLocal } from './frame-pass-gsplat-compute-local.js';
import { PrefixSumKernel } from '../graphics/prefix-sum-kernel.js';
import { computeGsplatLocalTileCountSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-tile-count.js';
import { computeGsplatLocalScatterSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-scatter.js';
import { computeGsplatLocalRasterizeSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-rasterize.js';
import { computeGsplatLocalTileSortSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-tile-sort.js';
import { computeGsplatLocalClassifySource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-classify.js';
import { computeGsplatLocalBucketSortSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-bucket-sort.js';
import { computeGsplatLocalChunkSortSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-chunk-sort.js';
import { computeGsplatLocalCopySource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-copy.js';
import { computeGsplatLocalBitonicSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-bitonic.js';
import { computeGsplatCommonSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-common.js';
import { computeGsplatTileIntersectSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-tile-intersect.js';
import { GSplatTileComposite } from './gsplat-tile-composite.js';

/**
 * @import { GraphNode } from '../graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Layer } from '../layer.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
 */

const TILE_SIZE = 16;
// Starting multiplier for the unified tile entry buffer. The actual multiplier grows
// dynamically based on async GPU readback of real usage (high-water mark tracking).
const INITIAL_TILE_ENTRY_MULTIPLIER = 1.5;
const COUNT_WORKGROUP_SIZE = 256;
const CACHE_STRIDE = 8;
// Budget for chunkRanges buffer; excess chunks from bucket sort are silently dropped.
const MAX_CHUNKS_PER_TILE = 8;
const _viewProjMat = new Mat4();
const _viewProjData = new Float32Array(16);
const _viewData = new Float32Array(16);
const _dispatchSize = new Vec2();

/**
 * Renders splats using a tiled compute pipeline with per-tile binning and local sorting.
 * Receives a compacted splat ID list from {@link GSplatIntervalCompaction}, projects each
 * splat into a projection cache, bins them into screen-space tiles via atomic counting +
 * prefix sum + scatter, classifies tiles by size, sorts each tile by depth (with bucket
 * pre-sort for large tiles), then rasterizes front-to-back. Pipeline:
 *
 *   1. Tile count: project each visible splat, write projection cache (including view-space
 *      depth), atomically count per-tile overlaps.
 *   2. Prefix sum: exclusive prefix sum over per-tile counts produces offsets + total.
 *   3. Scatter: re-iterate splats, atomically write projection cache indices into per-tile
 *      entry lists using the prefix sum offsets.
 *   3.5. Classify: scan tiles, build small/large/rasterize tile lists, assign compact
 *        overflow scratch offsets for large tiles, write indirect args.
 *   4b. Bucket pre-sort: logarithmic-depth bucket histogram + scatter for large tiles (>4096),
 *       using overflow scratch in the unified tileEntries buffer, packs whole buckets into
 *       <=4096 chunks (indirect dispatch). Runs first so the longer chain starts sooner.
 *   4b.5. Write chunk sort indirect dispatch args (separate pass for inter-pass barrier).
 *   4a. Small tile sort: bitonic sort for tiles with 1..4096 entries (indirect dispatch).
 *   4c. Chunk sort: bitonic sort on each chunk from the bucket pre-sort (indirect dispatch).
 *   5. Rasterize: one workgroup per non-empty tile reads its sorted entry range, loads from
 *      the projection cache via shared memory, and blends front-to-back with early-out
 *      (indirect dispatch).
 *
 * The tileEntries buffer is unified: main tile entry lists occupy [0, totalEntries), overflow
 * scratch for bucket sort occupies [totalEntries, totalEntries + overflowUsed). The buffer
 * capacity adapts dynamically via async GPU readback of actual usage (high-water mark).
 *
 * Note: the chunkRanges buffer is sized for MAX_CHUNKS_PER_TILE chunks per tile. The bucket
 * sort splits oversized buckets into MAX_CHUNK_SIZE (4096) pieces and bounds-checks against
 * this budget; excess chunks are silently dropped (those entries keep bucket-level ordering).
 *
 * The result is composited into the scene via a full-screen quad with premultiplied blending.
 *
 * @ignore
 */
class GSplatComputeLocalRenderer extends GSplatRenderer {
    /** @type {Texture} */
    outputTexture;

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

    /** @type {FramePassGSplatComputeLocal} */
    framePass;

    /** @type {GSplatTileComposite} */
    tileComposite;

    /** @type {boolean} */
    _needsFramePassRegister = false;

    /** @type {number} */
    _textureSize = 0;

    /** @type {number} */
    _minPixelSize = 2.0;

    /** @type {number} */
    _exposure = 1.0;

    /** @type {number} */
    _toneMapping = -1;

    /** @type {number} */
    _gamma = -1;

    /** @type {number} */
    _numSplats = 0;

    /** @type {StorageBuffer|null} */
    _compactedSplatIds = null;

    /** @type {StorageBuffer|null} */
    _sortElementCountBuffer = null;

    /** @type {StorageBuffer|null} Projection cache: 8 u32 per splat (screen, coeffs, color, depth) */
    _projCacheBuffer = null;

    /** @type {StorageBuffer|null} Per-tile splat counts / prefix sum offsets (numTiles + 1) */
    _tileSplatCountsBuffer = null;

    /** @type {StorageBuffer|null} Per-tile atomic write cursors for scatter */
    _tileWriteCursorsBuffer = null;

    /** @type {StorageBuffer|null} Unified buffer for tile entry lists + overflow scratch */
    _tileEntriesBuffer = null;

    /** @type {StorageBuffer|null} Tile indices with 1..4096 splats */
    _smallTileListBuffer = null;

    /** @type {StorageBuffer|null} Tile indices with >4096 splats */
    _largeTileListBuffer = null;

    /** @type {StorageBuffer|null} Per-large-tile overflow base offsets (parallel to largeTileList) */
    _largeTileOverflowBasesBuffer = null;

    /** @type {StorageBuffer|null} All non-empty tile indices */
    _rasterizeTileListBuffer = null;

    /** @type {StorageBuffer|null} Atomic counters [smallCount, largeCount, rasterizeCount, overflowUsed] */
    _tileListCountsBuffer = null;

    /** @type {StorageBuffer|null} (offset, count) pairs for chunk sort workgroups */
    _chunkRangesBuffer = null;

    /** @type {StorageBuffer|null} Atomic counter for total chunk count */
    _totalChunksBuffer = null;

    /** @type {StorageBuffer|null} Indirect dispatch args for chunk sort (3 u32s) */
    _chunkSortIndirectBuffer = null;

    /** @type {number} */
    _allocatedSplatCapacity = 0;

    /** @type {number} Allocated capacity (in u32 entries) of the unified tileEntries buffer */
    _allocatedEntryCapacity = 0;

    /** @type {number} */
    _allocatedTileCapacity = 0;

    /**
     * Dynamic multiplier: capacity = numSplats * _tileEntryMultiplier.
     * Grows automatically via async GPU readback when the buffer is too small.
     *
     * @type {number}
     */
    _tileEntryMultiplier = INITIAL_TILE_ENTRY_MULTIPLIER;

    /** @type {boolean} */
    _readbackPending = false;

    /** @type {BindGroupFormat} */
    _countBindGroupFormat;

    /** @type {BindGroupFormat} */
    _scatterBindGroupFormat;

    /** @type {BindGroupFormat} */
    _classifyBindGroupFormat;

    /** @type {BindGroupFormat} */
    _sortBindGroupFormat;

    /** @type {BindGroupFormat} */
    _bucketSortBindGroupFormat;

    /** @type {BindGroupFormat} */
    _copyBindGroupFormat;

    /** @type {BindGroupFormat} */
    _chunkSortBindGroupFormat;

    /** @type {BindGroupFormat} */
    _rasterizeBindGroupFormat;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GraphNode} node - The graph node.
     * @param {GraphNode} cameraNode - The camera node.
     * @param {Layer} layer - The layer to add mesh instances to.
     * @param {GSplatWorkBuffer} workBuffer - The work buffer containing splat data.
     */
    constructor(device, node, cameraNode, layer, workBuffer) {
        super(device, node, cameraNode, layer, workBuffer);

        this.outputTexture = new Texture(device, {
            name: 'GSplatLocalComputeOutput',
            width: 4,
            height: 4,
            format: PIXELFORMAT_RGBA8,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            storage: true
        });

        this.prefixSumKernel = new PrefixSumKernel(device);

        this._createCountCompute();
        this._createScatterCompute();
        this._createClassifyCompute();
        this._createSortCompute();
        this._createBucketSortCompute();
        this._createCopyCompute();
        this._createChunkSortCompute();
        this._createRasterizeCompute();
        this.framePass = new FramePassGSplatComputeLocal(this);

        const thisCamera = cameraNode.camera;
        this.tileComposite = new GSplatTileComposite(device, node, (camera) => {
            const renderMode = this.renderMode ?? 0;
            return thisCamera.camera === camera && (renderMode & GSPLAT_FORWARD) !== 0 && this._rasterizeTileListBuffer !== null;
        });
    }

    destroy() {
        this._unregisterFramePass();

        if (this.renderMode) {
            if (this.renderMode & GSPLAT_FORWARD) {
                this.layer.removeMeshInstances([this.tileComposite.meshInstance], true);
            }
        }

        this.countCompute.shader.destroy();
        this._countBindGroupFormat.destroy();
        this.scatterCompute.shader.destroy();
        this._scatterBindGroupFormat.destroy();
        this.classifyCompute.shader.destroy();
        this._classifyBindGroupFormat.destroy();
        this.sortCompute.shader.destroy();
        this._sortBindGroupFormat.destroy();
        this.bucketSortCompute.shader.destroy();
        this._bucketSortBindGroupFormat.destroy();
        this.copyCompute.shader.destroy();
        this._copyBindGroupFormat.destroy();
        this.chunkSortCompute.shader.destroy();
        this._chunkSortBindGroupFormat.destroy();
        this.rasterizeCompute.shader.destroy();
        this._rasterizeBindGroupFormat.destroy();
        this.prefixSumKernel.destroy();

        this._projCacheBuffer?.destroy();
        this._tileSplatCountsBuffer?.destroy();
        this._tileWriteCursorsBuffer?.destroy();
        this._tileEntriesBuffer?.destroy();
        this._smallTileListBuffer?.destroy();
        this._largeTileListBuffer?.destroy();
        this._largeTileOverflowBasesBuffer?.destroy();
        this._rasterizeTileListBuffer?.destroy();
        this._tileListCountsBuffer?.destroy();
        this._chunkRangesBuffer?.destroy();
        this._totalChunksBuffer?.destroy();
        this._chunkSortIndirectBuffer?.destroy();

        this.outputTexture.destroy();
        this.tileComposite.destroy();

        super.destroy();
    }

    get material() {
        return this.tileComposite.material;
    }

    setRenderMode(renderMode) {
        const oldRenderMode = this.renderMode ?? 0;
        const wasForward = (oldRenderMode & GSPLAT_FORWARD) !== 0;
        const isForward = (renderMode & GSPLAT_FORWARD) !== 0;

        if (!wasForward && isForward) {
            this.layer.addMeshInstances([this.tileComposite.meshInstance], true);
            this._registerFramePass();
        }

        if (wasForward && !isForward) {
            this.layer.removeMeshInstances([this.tileComposite.meshInstance], true);
            this._unregisterFramePass();
        }

        super.setRenderMode(renderMode);
    }

    frameUpdate(gsplat, exposure) {
        if (this._needsFramePassRegister) {
            this._registerFramePass();
        }
        this._minPixelSize = gsplat.minPixelSize;
        this._exposure = exposure ?? 1.0;

        const cam = this.cameraNode.camera?.camera;
        if (cam) {
            const toneMapping = cam.shaderParams.toneMapping;
            const gamma = cam.shaderParams.shaderOutputGamma;
            if (toneMapping !== this._toneMapping || gamma !== this._gamma) {
                this._toneMapping = toneMapping;
                this._gamma = gamma;
                this._recreateCountCompute();
            }
        }
    }

    /**
     * Receives compacted splat data from the manager's interval compaction pipeline.
     *
     * @param {StorageBuffer} compactedSplatIds - Dense buffer of visible splat IDs.
     * @param {StorageBuffer} sortElementCountBuffer - Single-u32 buffer with visible count.
     * @param {number} textureSize - The work buffer texture size.
     * @param {number} numSplats - Upper bound on visible splats (for buffer sizing).
     */
    setCompactedData(compactedSplatIds, sortElementCountBuffer, textureSize, numSplats) {
        this._compactedSplatIds = compactedSplatIds;
        this._sortElementCountBuffer = sortElementCountBuffer;
        this._textureSize = textureSize;
        this._numSplats = numSplats;
    }

    /** @private */
    _registerFramePass() {
        const beforePasses = this.cameraNode.camera?.camera?.beforePasses;
        if (beforePasses) {
            if (beforePasses.indexOf(this.framePass) === -1) {
                beforePasses.push(this.framePass);
            }
            this._needsFramePassRegister = false;
        } else {
            this._needsFramePassRegister = true;
        }
    }

    /** @private */
    _unregisterFramePass() {
        this._needsFramePassRegister = false;
        const beforePasses = this.cameraNode.camera?.camera?.beforePasses;
        if (beforePasses) {
            const idx = beforePasses.indexOf(this.framePass);
            if (idx !== -1) {
                beforePasses.splice(idx, 1);
            }
        }
    }

    resizeOutputTexture(width, height) {
        this.outputTexture.resize(width, height);
    }

    /**
     * Ensure buffers are large enough for the current splat count and tile count.
     *
     * @param {number} numSplats - Upper bound on visible splats.
     * @param {number} numTiles - Total number of screen tiles.
     * @private
     */
    _ensureBuffers(numSplats, numTiles) {
        if (numSplats > this._allocatedSplatCapacity) {
            this._projCacheBuffer?.destroy();
            this._allocatedSplatCapacity = numSplats;
            this._projCacheBuffer = new StorageBuffer(this.device, numSplats * CACHE_STRIDE * 4);
        }

        // Unified buffer: main tile entries [0..totalEntries) + overflow scratch for bucket sort.
        // Capacity adapts dynamically via _tileEntryMultiplier (async GPU readback).
        // Grow immediately; shrink only when overallocated by >2x (dead zone prevents thrashing).
        const requiredEntryCapacity = Math.ceil(numSplats * this._tileEntryMultiplier);
        const needsGrow = requiredEntryCapacity > this._allocatedEntryCapacity;
        const needsShrink = this._allocatedEntryCapacity > 0 &&
            requiredEntryCapacity * 2 < this._allocatedEntryCapacity;
        if (needsGrow || needsShrink) {
            this._tileEntriesBuffer?.destroy();
            this._allocatedEntryCapacity = requiredEntryCapacity;
            this._tileEntriesBuffer = new StorageBuffer(this.device, requiredEntryCapacity * 4, BUFFERUSAGE_COPY_DST);
        }

        const requiredTileSlots = numTiles + 1;
        if (requiredTileSlots > this._allocatedTileCapacity) {
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
            // COPY_SRC needed for async readback of totalEntries at tileSplatCounts[numTiles]
            this._tileSplatCountsBuffer = new StorageBuffer(this.device, requiredTileSlots * 4, BUFFERUSAGE_COPY_DST | BUFFERUSAGE_COPY_SRC);
            this._tileWriteCursorsBuffer = new StorageBuffer(this.device, numTiles * 4, BUFFERUSAGE_COPY_DST);
            this._smallTileListBuffer = new StorageBuffer(this.device, numTiles * 4);
            this._largeTileListBuffer = new StorageBuffer(this.device, numTiles * 4);
            this._largeTileOverflowBasesBuffer = new StorageBuffer(this.device, numTiles * 4);
            this._rasterizeTileListBuffer = new StorageBuffer(this.device, numTiles * 4);
            // 4 slots: [smallCount, largeCount, rasterizeCount, overflowUsed]
            // COPY_SRC needed for async readback of overflow usage at slot 3
            this._tileListCountsBuffer = new StorageBuffer(this.device, 4 * 4, BUFFERUSAGE_COPY_DST | BUFFERUSAGE_COPY_SRC);

            const maxChunks = numTiles * MAX_CHUNKS_PER_TILE;
            this._chunkRangesBuffer = new StorageBuffer(this.device, maxChunks * 8);
            this._totalChunksBuffer = new StorageBuffer(this.device, 1 * 4, BUFFERUSAGE_COPY_DST);
            this._chunkSortIndirectBuffer = new StorageBuffer(this.device, 3 * 4, BUFFERUSAGE_COPY_DST | BUFFERUSAGE_INDIRECT);

            this.prefixSumKernel.destroyPasses();
        }
    }

    dispatch() {
        const width = this.outputTexture.width;
        const height = this.outputTexture.height;
        const numSplats = this._numSplats;

        if (!this._compactedSplatIds || !this._sortElementCountBuffer || numSplats === 0) return;

        const device = this.device;
        const numTilesX = Math.ceil(width / TILE_SIZE);
        const numTilesY = Math.ceil(height / TILE_SIZE);
        const numTiles = numTilesX * numTilesY;

        this._ensureBuffers(numSplats, numTiles);

        const maxEntries = this._allocatedEntryCapacity;

        const wb = this.workBuffer;
        const camera = this.cameraNode.camera;
        const cam = camera.camera;

        const view = cam.viewMatrix;
        const proj = cam.projectionMatrix;
        _viewProjMat.mul2(proj, view);
        _viewProjData.set(_viewProjMat.data);
        _viewData.set(view.data);
        const focal = width * proj.data[0];

        // --- Pass 1: Per-tile count + projection cache ---
        this._tileSplatCountsBuffer.clear();

        this.countCompute.setParameter('compactedSplatIds', this._compactedSplatIds);
        this.countCompute.setParameter('sortElementCount', this._sortElementCountBuffer);
        this.countCompute.setParameter('dataTransformA', wb.getTexture('dataTransformA'));
        this.countCompute.setParameter('dataTransformB', wb.getTexture('dataTransformB'));
        this.countCompute.setParameter('dataColor', wb.getTexture('dataColor'));
        this.countCompute.setParameter('projCache', this._projCacheBuffer);
        this.countCompute.setParameter('tileSplatCounts', this._tileSplatCountsBuffer);
        this.countCompute.setParameter('splatTextureSize', this._textureSize);
        this.countCompute.setParameter('numTilesX', numTilesX);
        this.countCompute.setParameter('numTilesY', numTilesY);
        this.countCompute.setParameter('viewProj', _viewProjData);
        this.countCompute.setParameter('viewMatrix', _viewData);
        this.countCompute.setParameter('focal', focal);
        this.countCompute.setParameter('viewportWidth', width);
        this.countCompute.setParameter('viewportHeight', height);
        this.countCompute.setParameter('nearClip', cam.nearClip);
        this.countCompute.setParameter('farClip', cam.farClip);
        this.countCompute.setParameter('minPixelSize', this._minPixelSize);
        this.countCompute.setParameter('isOrtho', cam.projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0);
        this.countCompute.setParameter('exposure', this._exposure);

        const countWorkgroups = Math.ceil(numSplats / COUNT_WORKGROUP_SIZE);
        Compute.calcDispatchSize(countWorkgroups, _dispatchSize);
        this.countCompute.setupDispatch(_dispatchSize.x, _dispatchSize.y, 1);
        device.computeDispatch([this.countCompute], 'GSplatLocalTileCount');

        // --- Pass 2: Prefix sum over per-tile counts ---
        this.prefixSumKernel.resize(this._tileSplatCountsBuffer, numTiles + 1);
        this.prefixSumKernel.dispatch(device);

        // --- Pass 3: Scatter splat cache indices into per-tile entries ---
        this._tileWriteCursorsBuffer.clear();

        this.scatterCompute.setParameter('projCache', this._projCacheBuffer);
        this.scatterCompute.setParameter('sortElementCount', this._sortElementCountBuffer);
        this.scatterCompute.setParameter('tileSplatCounts', this._tileSplatCountsBuffer);
        this.scatterCompute.setParameter('tileWriteCursors', this._tileWriteCursorsBuffer);
        this.scatterCompute.setParameter('tileEntries', this._tileEntriesBuffer);
        this.scatterCompute.setParameter('numTilesX', numTilesX);
        this.scatterCompute.setParameter('numTilesY', numTilesY);
        this.scatterCompute.setParameter('maxEntries', maxEntries);
        this.scatterCompute.setParameter('viewportWidth', width);
        this.scatterCompute.setParameter('viewportHeight', height);

        this.scatterCompute.setupDispatch(_dispatchSize.x, _dispatchSize.y, 1);
        device.computeDispatch([this.scatterCompute], 'GSplatLocalScatter');

        // --- Pass 3.5: Classify tiles → build small/large/rasterize lists + indirect args ---
        this._tileListCountsBuffer.clear();
        this._totalChunksBuffer.clear();
        this._chunkSortIndirectBuffer.clear();

        // Reserve 3 indirect dispatch slots: 0=smallSort, 1=bucketSort, 2=rasterize
        const indirectSlot = device.getIndirectDispatchSlot(3);

        // Reserve 1 indirect draw slot for the tile-based composite
        const drawSlot = device.getIndirectDrawSlot(1);

        this.classifyCompute.setParameter('tileSplatCounts', this._tileSplatCountsBuffer);
        this.classifyCompute.setParameter('smallTileList', this._smallTileListBuffer);
        this.classifyCompute.setParameter('largeTileList', this._largeTileListBuffer);
        this.classifyCompute.setParameter('rasterizeTileList', this._rasterizeTileListBuffer);
        this.classifyCompute.setParameter('tileListCounts', this._tileListCountsBuffer);
        this.classifyCompute.setParameter('indirectDispatchArgs', device.indirectDispatchBuffer);
        this.classifyCompute.setParameter('largeTileOverflowBases', this._largeTileOverflowBasesBuffer);
        this.classifyCompute.setParameter('indirectDrawArgs', device.indirectDrawBuffer);
        this.classifyCompute.setParameter('numTiles', numTiles);
        this.classifyCompute.setParameter('dispatchSlotOffset', indirectSlot * 3);
        this.classifyCompute.setParameter('bufferCapacity', maxEntries);
        this.classifyCompute.setParameter('maxWorkgroupsPerDim', device.limits.maxComputeWorkgroupsPerDimension || 65535);
        this.classifyCompute.setParameter('drawSlot', drawSlot);

        this.classifyCompute.setupDispatch(1, 1, 1);
        device.computeDispatch([this.classifyCompute], 'GSplatLocalClassify');

        // --- Pass 4b: Bucket pre-sort for large tiles (indirect dispatch) ---
        // Runs before 4a so the longer chain (4b → 4b.5 → 4c) starts sooner.
        this.bucketSortCompute.setParameter('tileEntries', this._tileEntriesBuffer);
        this.bucketSortCompute.setParameter('largeTileOverflowBases', this._largeTileOverflowBasesBuffer);
        this.bucketSortCompute.setParameter('tileSplatCounts', this._tileSplatCountsBuffer);
        this.bucketSortCompute.setParameter('projCache', this._projCacheBuffer);
        this.bucketSortCompute.setParameter('largeTileList', this._largeTileListBuffer);
        this.bucketSortCompute.setParameter('chunkRanges', this._chunkRangesBuffer);
        this.bucketSortCompute.setParameter('totalChunks', this._totalChunksBuffer);
        this.bucketSortCompute.setParameter('tileListCounts', this._tileListCountsBuffer);
        this.bucketSortCompute.setParameter('bufferCapacity', maxEntries);
        this.bucketSortCompute.setParameter('maxChunks', numTiles * MAX_CHUNKS_PER_TILE);

        this.bucketSortCompute.setupIndirectDispatch(indirectSlot + 1);
        device.computeDispatch([this.bucketSortCompute], 'GSplatLocalBucketSort');

        // --- Pass 4b.5: Write chunk sort indirect dispatch args ---
        // Separate pass so the inter-pass barrier guarantees all bucket sort writes
        // (tileEntries, totalChunks, chunkRanges) are visible before the chunk sort.
        this.copyCompute.setParameter('totalChunks', this._totalChunksBuffer);
        this.copyCompute.setParameter('chunkSortIndirect', this._chunkSortIndirectBuffer);
        this.copyCompute.setParameter('maxChunks', numTiles * MAX_CHUNKS_PER_TILE);
        this.copyCompute.setParameter('maxWorkgroupsPerDim', device.limits.maxComputeWorkgroupsPerDimension || 65535);

        this.copyCompute.setupDispatch(1, 1, 1);
        device.computeDispatch([this.copyCompute], 'GSplatLocalCopy');

        // --- Pass 4a: Bitonic sort for small tiles (indirect dispatch) ---
        this.sortCompute.setParameter('tileEntries', this._tileEntriesBuffer);
        this.sortCompute.setParameter('tileSplatCounts', this._tileSplatCountsBuffer);
        this.sortCompute.setParameter('projCache', this._projCacheBuffer);
        this.sortCompute.setParameter('smallTileList', this._smallTileListBuffer);
        this.sortCompute.setParameter('tileListCounts', this._tileListCountsBuffer);

        this.sortCompute.setupIndirectDispatch(indirectSlot);
        device.computeDispatch([this.sortCompute], 'GSplatLocalTileSort');

        // --- Pass 4c: Chunk sort for large-tile chunks (indirect dispatch) ---
        this.chunkSortCompute.setParameter('tileEntries', this._tileEntriesBuffer);
        this.chunkSortCompute.setParameter('projCache', this._projCacheBuffer);
        this.chunkSortCompute.setParameter('chunkRanges', this._chunkRangesBuffer);
        this.chunkSortCompute.setParameter('totalChunks', this._totalChunksBuffer);
        this.chunkSortCompute.setParameter('maxChunks', numTiles * MAX_CHUNKS_PER_TILE);

        this.chunkSortCompute.setupIndirectDispatch(0, this._chunkSortIndirectBuffer);
        device.computeDispatch([this.chunkSortCompute], 'GSplatLocalChunkSort');

        // --- Pass 5: Rasterize from sorted per-tile entry ranges (indirect dispatch) ---
        this.rasterizeCompute.setParameter('outputTexture', this.outputTexture);
        this.rasterizeCompute.setParameter('tileEntries', this._tileEntriesBuffer);
        this.rasterizeCompute.setParameter('tileSplatCounts', this._tileSplatCountsBuffer);
        this.rasterizeCompute.setParameter('projCache', this._projCacheBuffer);
        this.rasterizeCompute.setParameter('rasterizeTileList', this._rasterizeTileListBuffer);
        this.rasterizeCompute.setParameter('tileListCounts', this._tileListCountsBuffer);
        this.rasterizeCompute.setParameter('screenWidth', width);
        this.rasterizeCompute.setParameter('screenHeight', height);
        this.rasterizeCompute.setParameter('numTilesX', numTilesX);

        this.rasterizeCompute.setupIndirectDispatch(indirectSlot + 2);
        device.computeDispatch([this.rasterizeCompute], 'GSplatLocalRasterize');

        // Update tile composite for indirect draw
        this.tileComposite.update(drawSlot, this.outputTexture, this._rasterizeTileListBuffer, numTilesX, width, height);

        // Async readback: check if the buffer was large enough, grow multiplier if not.
        // Reads totalEntries (from prefix sum) and totalOverflowUsed (from classify).
        // The readback arrives 1-2 frames later; until then rendering may be degraded.
        this._scheduleReadback(numSplats, numTiles);
    }

    /**
     * Schedule async GPU readback of tile entry and overflow usage.
     * Updates _tileEntryMultiplier to track actual usage, allowing both growth and shrinkage.
     *
     * @param {number} numSplats - Splat count at dispatch time (for computing new multiplier).
     * @param {number} numTiles - Tile count at dispatch time (for reading prefix sum total).
     * @private
     */
    _scheduleReadback(numSplats, numTiles) {
        if (this._readbackPending || numSplats === 0) return;
        this._readbackPending = true;

        const capturedNumSplats = numSplats;

        // tileSplatCounts[numTiles] = totalEntries (prefix sum total, 4 bytes at offset numTiles*4)
        // tileListCounts[3] = totalOverflowUsed (4 bytes at offset 12)
        const readback1 = this._tileSplatCountsBuffer.read(numTiles * 4, 4);
        const readback2 = this._tileListCountsBuffer.read(3 * 4, 4);

        Promise.all([readback1, readback2]).then(([r1, r2]) => {
            this._readbackPending = false;
            const totalEntries = new Uint32Array(r1.buffer, r1.byteOffset, 1)[0];
            const totalOverflow = new Uint32Array(r2.buffer, r2.byteOffset, 1)[0];
            const needed = totalEntries + totalOverflow;

            if (capturedNumSplats > 0) {
                this._tileEntryMultiplier = Math.max((needed / capturedNumSplats) * 1.1, INITIAL_TILE_ENTRY_MULTIPLIER);
            }
        }).catch(() => {
            this._readbackPending = false;
        });
    }

    /** @private */
    _recreateCountCompute() {
        this.countCompute.shader.destroy();
        this._countBindGroupFormat.destroy();
        this._createCountCompute();
    }

    /** @private */
    _createCommonIncludes() {
        const cincludes = new Map();
        cincludes.set('gsplatCommonCS', computeGsplatCommonSource);
        cincludes.set('gsplatTileIntersectCS', computeGsplatTileIntersectSource);
        return cincludes;
    }

    /** @private */
    _createBitonicIncludes() {
        const cincludes = new Map();
        cincludes.set('gsplatLocalBitonicCS', computeGsplatLocalBitonicSource);
        return cincludes;
    }

    /** @private */
    _createCountCompute() {
        const device = this.device;

        const uniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('splatTextureSize', UNIFORMTYPE_UINT),
            new UniformFormat('numTilesX', UNIFORMTYPE_UINT),
            new UniformFormat('numTilesY', UNIFORMTYPE_UINT),
            new UniformFormat('viewProj', UNIFORMTYPE_MAT4),
            new UniformFormat('viewMatrix', UNIFORMTYPE_MAT4),
            new UniformFormat('focal', UNIFORMTYPE_FLOAT),
            new UniformFormat('viewportWidth', UNIFORMTYPE_FLOAT),
            new UniformFormat('viewportHeight', UNIFORMTYPE_FLOAT),
            new UniformFormat('nearClip', UNIFORMTYPE_FLOAT),
            new UniformFormat('farClip', UNIFORMTYPE_FLOAT),
            new UniformFormat('minPixelSize', UNIFORMTYPE_FLOAT),
            new UniformFormat('isOrtho', UNIFORMTYPE_UINT),
            new UniformFormat('exposure', UNIFORMTYPE_FLOAT)
        ]);

        this._countBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('compactedSplatIds', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('sortElementCount', SHADERSTAGE_COMPUTE, true),
            new BindTextureFormat('dataTransformA', SHADERSTAGE_COMPUTE, undefined, SAMPLETYPE_UINT, false),
            new BindTextureFormat('dataTransformB', SHADERSTAGE_COMPUTE, undefined, SAMPLETYPE_UINT, false),
            new BindTextureFormat('dataColor', SHADERSTAGE_COMPUTE, undefined, SAMPLETYPE_UINT, false),
            new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('tileSplatCounts', SHADERSTAGE_COMPUTE),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ]);

        const cincludes = this._createCommonIncludes();
        this._createTonemapIncludes(cincludes);

        const cdefines = new Map();
        cdefines.set('TONEMAP', tonemapNames[this._toneMapping] ?? 'LINEAR');
        cdefines.set('GAMMA', gammaNames[this._gamma] ?? 'NONE');
        cdefines.set('TONEMAP_NO_EXPOSURE_UNIFORM', '');

        const shader = new Shader(device, {
            name: 'GSplatLocalTileCount',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatLocalTileCountSource,
            cincludes: cincludes,
            cdefines: cdefines,
            computeBindGroupFormat: this._countBindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });

        this.countCompute = new Compute(device, shader, 'GSplatLocalTileCount');
    }

    /** @private */
    _createScatterCompute() {
        const device = this.device;

        const uniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('numTilesX', UNIFORMTYPE_UINT),
            new UniformFormat('numTilesY', UNIFORMTYPE_UINT),
            new UniformFormat('maxEntries', UNIFORMTYPE_UINT),
            new UniformFormat('viewportWidth', UNIFORMTYPE_FLOAT),
            new UniformFormat('viewportHeight', UNIFORMTYPE_FLOAT)
        ]);

        this._scatterBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('sortElementCount', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('tileSplatCounts', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('tileWriteCursors', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('tileEntries', SHADERSTAGE_COMPUTE),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ]);

        const cincludes = new Map();
        cincludes.set('gsplatTileIntersectCS', computeGsplatTileIntersectSource);

        const shader = new Shader(device, {
            name: 'GSplatLocalScatter',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatLocalScatterSource,
            cincludes: cincludes,
            computeBindGroupFormat: this._scatterBindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });

        this.scatterCompute = new Compute(device, shader, 'GSplatLocalScatter');
    }

    /** @private */
    _createClassifyCompute() {
        const device = this.device;

        const uniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('numTiles', UNIFORMTYPE_UINT),
            new UniformFormat('dispatchSlotOffset', UNIFORMTYPE_UINT),
            new UniformFormat('bufferCapacity', UNIFORMTYPE_UINT),
            new UniformFormat('maxWorkgroupsPerDim', UNIFORMTYPE_UINT),
            new UniformFormat('drawSlot', UNIFORMTYPE_UINT)
        ]);

        this._classifyBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('tileSplatCounts', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('smallTileList', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('largeTileList', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('rasterizeTileList', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('tileListCounts', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('indirectDispatchArgs', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('largeTileOverflowBases', SHADERSTAGE_COMPUTE),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('indirectDrawArgs', SHADERSTAGE_COMPUTE)
        ]);

        const shader = new Shader(device, {
            name: 'GSplatLocalClassify',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatLocalClassifySource,
            computeBindGroupFormat: this._classifyBindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });

        this.classifyCompute = new Compute(device, shader, 'GSplatLocalClassify');
    }

    /** @private */
    _createSortCompute() {
        const device = this.device;

        this._sortBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('tileEntries', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('tileSplatCounts', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('smallTileList', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('tileListCounts', SHADERSTAGE_COMPUTE, true)
        ]);

        const shader = new Shader(device, {
            name: 'GSplatLocalTileSort',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatLocalTileSortSource,
            cincludes: this._createBitonicIncludes(),
            computeBindGroupFormat: this._sortBindGroupFormat
        });

        this.sortCompute = new Compute(device, shader, 'GSplatLocalTileSort');
    }

    /** @private */
    _createBucketSortCompute() {
        const device = this.device;

        const uniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('bufferCapacity', UNIFORMTYPE_UINT),
            new UniformFormat('maxChunks', UNIFORMTYPE_UINT)
        ]);

        this._bucketSortBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('tileEntries', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('largeTileOverflowBases', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('tileSplatCounts', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('largeTileList', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('chunkRanges', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('totalChunks', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('tileListCounts', SHADERSTAGE_COMPUTE, true),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ]);

        const shader = new Shader(device, {
            name: 'GSplatLocalBucketSort',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatLocalBucketSortSource,
            computeBindGroupFormat: this._bucketSortBindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });

        this.bucketSortCompute = new Compute(device, shader, 'GSplatLocalBucketSort');
    }

    /** @private */
    _createCopyCompute() {
        const device = this.device;

        const uniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('maxChunks', UNIFORMTYPE_UINT),
            new UniformFormat('maxWorkgroupsPerDim', UNIFORMTYPE_UINT)
        ]);

        this._copyBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('totalChunks', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('chunkSortIndirect', SHADERSTAGE_COMPUTE),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ]);

        const shader = new Shader(device, {
            name: 'GSplatLocalCopy',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatLocalCopySource,
            computeBindGroupFormat: this._copyBindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });

        this.copyCompute = new Compute(device, shader, 'GSplatLocalCopy');
    }

    /** @private */
    _createChunkSortCompute() {
        const device = this.device;

        const uniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('maxChunks', UNIFORMTYPE_UINT)
        ]);

        this._chunkSortBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('tileEntries', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('chunkRanges', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('totalChunks', SHADERSTAGE_COMPUTE, true),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ]);

        const shader = new Shader(device, {
            name: 'GSplatLocalChunkSort',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatLocalChunkSortSource,
            cincludes: this._createBitonicIncludes(),
            computeBindGroupFormat: this._chunkSortBindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });

        this.chunkSortCompute = new Compute(device, shader, 'GSplatLocalChunkSort');
    }

    /** @private */
    _createRasterizeCompute() {
        const device = this.device;

        const uniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('screenWidth', UNIFORMTYPE_UINT),
            new UniformFormat('screenHeight', UNIFORMTYPE_UINT),
            new UniformFormat('numTilesX', UNIFORMTYPE_UINT)
        ]);

        this._rasterizeBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageTextureFormat('outputTexture', PIXELFORMAT_RGBA8),
            new BindStorageBufferFormat('tileEntries', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('tileSplatCounts', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('rasterizeTileList', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('tileListCounts', SHADERSTAGE_COMPUTE, true),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ]);

        const shader = new Shader(device, {
            name: 'GSplatLocalRasterize',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatLocalRasterizeSource,
            computeBindGroupFormat: this._rasterizeBindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });

        this.rasterizeCompute = new Compute(device, shader, 'GSplatLocalRasterize');
    }
}

export { GSplatComputeLocalRenderer };
