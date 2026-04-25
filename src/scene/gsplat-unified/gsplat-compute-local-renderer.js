import { Compute } from '../../platform/graphics/compute.js';
import { Shader } from '../../platform/graphics/shader.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { BindGroupFormat, BindStorageBufferFormat, BindUniformBufferFormat } from '../../platform/graphics/bind-group-format.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import {
    BUFFERUSAGE_COPY_DST,
    BUFFERUSAGE_COPY_SRC,
    BUFFERUSAGE_INDIRECT,
    PIXELFORMAT_RGBA16U,
    SHADERLANGUAGE_WGSL,
    SHADERSTAGE_COMPUTE,
    UNIFORMTYPE_FLOAT,
    UNIFORMTYPE_MAT4,
    UNIFORMTYPE_UINT
} from '../../platform/graphics/constants.js';
import { GSPLAT_FORWARD, PROJECTION_ORTHOGRAPHIC, FOG_NONE, GSPLAT_DEBUG_HEATMAP } from '../constants.js';
import { Debug } from '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { GSplatRenderer } from './gsplat-renderer.js';
import { FramePassGSplatComputeLocal } from './frame-pass-gsplat-compute-local.js';
import { computeGsplatLocalDispatchPrepSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-dispatch-prep.js';
import { computeGsplatLocalDispatchPrepLargeSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-dispatch-prep-large.js';
import { computeGsplatLocalTileCountSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-tile-count.js';
import { computeGsplatLocalTileCountLargeSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-tile-count-large.js';
import { computeGsplatLocalPlaceEntriesSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-place-entries.js';
import { computeGsplatLocalPlaceEntriesLargeSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-place-entries-large.js';
import { computeGsplatLocalTileSortSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-tile-sort.js';
import { computeGsplatLocalClassifySource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-classify.js';
import { computeGsplatLocalBucketSortSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-bucket-sort.js';
import { computeGsplatLocalChunkSortSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-chunk-sort.js';
import { computeGsplatLocalCopySource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-copy.js';
import { computeGsplatLocalBitonicSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-local-bitonic.js';
import { computeGsplatCommonSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-common.js';
import { computeGsplatTileIntersectSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-tile-intersect.js';
import { GSplatTileComposite } from './gsplat-tile-composite.js';
import { GSplatLocalDispatchSet } from './gsplat-local-dispatch-set.js';
import { CACHE_STRIDE } from './gsplat-local-constants.js';
import computeSplatSource from '../shader-lib/wgsl/chunks/gsplat/vert/gsplatComputeSplat.js';

/**
 * @import { GraphNode } from '../graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Layer } from '../layer.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
 * @import { GSplatFormat } from '../gsplat/gsplat-format.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 * @import { MeshInstance } from '../mesh-instance.js'
 */

// ---- Tunable knobs (memory vs. quality / robustness trade-offs) ----

// Floor for _tileEntryMultiplier (minimum tile entries per splat). Controls
// tile-entry buffer capacity on the first few frames before GPU readback has
// converged. Raising reduces cold-start tile clamping (missing tiles on scene
// load / teleport) at a flat cost of numSplats * (value) * 8 bytes.
const INITIAL_TILE_ENTRY_MULTIPLIER = 2.5;

// Headroom factor applied to measured entry demand. Cushions steady-state
// frame-to-frame spikes (camera motion, splats crossing tile boundaries) so
// they don't exceed capacity and cause clamping.
const ENTRY_HEADROOM_MULTIPLIER = 2.0;

// Consecutive low-usage readbacks before the multiplier is allowed to shrink.
const SHRINK_THRESHOLD = 200;

// Initial capacity (in splat IDs) of the large-splat buffer, which holds IDs of
// splats whose screen AABB covers more than 64 tiles and are deferred to the
// cooperative tile-count / place-entries passes. Buffer is grow-only: it expands
// on demand via readback but never shrinks, so demand exceeding this initial size
// causes large splats to be dropped for the first few frames (missing coverage on
// close-up views) until readback catches up. Fixed cost is (value) * 4 bytes.
const INITIAL_LARGE_SPLAT_CAPACITY = 16384;

// ---- Algorithmic invariants (must match shader code, do not change casually) ----

const TILE_SIZE = 16;
const MAX_TILES = 65535; // tile index must fit in 16 bits for pair packing (tileIdx << 16 | localOffset)
const MAX_CHUNKS_PER_TILE = 8;

// ---- Module-scope scratch (reusable, never exported) ----

const _viewProjMat = new Mat4();
const _viewProjData = new Float32Array(16);
const _viewData = new Float32Array(16);
const _fogColorLinear = new Color();
const _fogColorArray = new Float32Array(3);

/**
 * Renders splats using a tiled compute pipeline with per-tile binning and local sorting.
 * Receives a compacted splat ID list from {@link GSplatIntervalCompaction}, projects each
 * splat into a projection cache, bins them into screen-space tiles via a fused
 * count+pair-write pass, classifies tiles by size, sorts each tile by depth (with bucket
 * pre-sort for large tiles), then rasterizes front-to-back. Pipeline:
 *
 *   1. Tile count: project each visible splat, write projection cache (screen pos, conic,
 *      color, depth). Iterate overlapping tiles twice: first to count intersections and
 *      build a 6x5 bitmask, then after a workgroup prefix sum + single global atomicAdd,
 *      to perform capped atomicAdd on per-tile counters and write (tileIdx, localOffset)
 *      pairs into a contiguous pair buffer. Large splats (AABB > 64 tiles) are deferred
 *      to a cooperative pass — their IDs are appended to a largeSplatIds buffer.
 *   1b. Large tile count: one workgroup (256 threads) per deferred large splat reads
 *      projCache, recomputes the AABB, and cooperatively iterates tiles. Same pair-buffer
 *      and tileSplatCounts writes as pass 1. Sets the high bit of splatPairCount to flag
 *      these splats for the cooperative place-entries pass.
 *   2. Prefix sum: exclusive prefix sum over per-tile counts produces offsets + total.
 *   3. Place entries: each thread reads its (tileIdx, localOffset) pairs from the pair
 *      buffer and writes its splat index into tileEntries at deterministic positions
 *      (prefix-summed offset + localOffset). No atomics, no projCache reads. Skips large
 *      splats (high bit of splatPairCount).
 *   3b. Large place entries: cooperative pass — one workgroup (256 threads) per large
 *      splat, same dispatch as 1b. Reads pairs and writes tileEntries in parallel.
 *   3.5. Classify: scan tiles, build small/large/rasterize tile lists, assign compact
 *        overflow scratch offsets for large tiles, write indirect args.
 *   4b. Bucket pre-sort: logarithmic-depth bucket histogram + scatter for large tiles
 *       (>4096 entries), using overflow scratch in the unified tileEntries buffer, packs
 *       whole buckets into <=4096 chunks (indirect dispatch).
 *   4b.5. Copy chunk sort indirect dispatch args (separate pass for inter-pass barrier).
 *   4a. Small tile sort: bitonic sort for tiles with 1..4096 entries (indirect dispatch).
 *   4c. Chunk sort: bitonic sort on each chunk from bucket pre-sort (indirect dispatch).
 *   5. Rasterize: one workgroup per non-empty tile reads its sorted entry range, loads
 *      from the projection cache via shared memory, and blends front-to-back with
 *      early-out (indirect dispatch).
 *
 * The tileEntries buffer is unified: main tile entry lists occupy [0, totalEntries),
 * overflow scratch for bucket sort occupies [totalEntries, totalEntries + overflowUsed).
 * Buffer capacity adapts dynamically via async GPU readback of actual usage.
 *
 * Supports both color and pick dispatch via two {@link GSplatLocalDispatchSet} instances.
 * Splat/entry-dependent buffers (projCache, tileEntries) are shared between dispatch sets
 * with a submitVersion guard to prevent resizing within the same command encoder.
 *
 * @ignore
 */
class GSplatComputeLocalRenderer extends GSplatRenderer {
    /** @type {GSplatLocalDispatchSet} */
    _mainSet;

    /** @type {GSplatLocalDispatchSet|null} */
    _pickSet = null;

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
    _minContribution = 3.0;

    /** @type {number} */
    _alphaClip = 0.3;

    /** @type {number} */
    _exposure = 1.0;

    /** @type {number} */
    _numSplats = 0;

    /** @type {StorageBuffer|null} */
    _compactedSplatIds = null;

    /** @type {StorageBuffer|null} */
    _sortElementCountBuffer = null;

    // --- Shared splat/entry-dependent buffers ---

    /** @type {StorageBuffer|null} */
    _projCacheBuffer = null;

    /** @type {StorageBuffer|null} */
    _tileEntriesBuffer = null;

    // Pair buffer for scatter-free tile binning: stores packed (tileIdx << 16 | localOffset)
    // per splat-tile intersection. Same size as tileEntries (one u32 per pair).

    /** @type {StorageBuffer|null} */
    _pairBuffer = null;

    /**
     * Packed atomic counters: [0] = global pair counter, [1] = large splat count.
     *
     * @type {StorageBuffer|null}
     */
    _countersBuffer = null;

    /** @type {StorageBuffer|null} */
    _splatPairStartBuffer = null;

    /** @type {StorageBuffer|null} */
    _splatPairCountBuffer = null;

    // --- Large-splat deferred processing buffers ---

    /** @type {StorageBuffer|null} */
    _largeSplatIdsBuffer = null;

    /** @type {number} */
    _largeSplatIdsCapacity = INITIAL_LARGE_SPLAT_CAPACITY;

    /** @type {number} */
    _allocatedLargeSplatCapacity = 0;

    /** @type {number} */
    _allocatedSplatCapacity = 0;

    /** @type {number} */
    _allocatedEntryCapacity = 0;

    /** @type {number} */
    _tileEntryMultiplier = INITIAL_TILE_ENTRY_MULTIPLIER;

    /** @type {number} Last device.submitVersion when shared buffers were resized */
    _lastBufferSubmitVersion = -1;

    /** @type {number} Last readback entry count (-1 = consumed / no fresh data) */
    _lastReadbackEntryCount = -1;

    /** @type {number} Consecutive frames where usage < half capacity */
    _shrinkFrameCount = 0;

    /** @type {number} */
    _fisheye = 0;

    /**
     * Active data source providing format and texture access. When set via {@link setDataSource},
     * the renderer reads format and textures from this object instead of the inherited workBuffer.
     * Defaults to the workBuffer passed to the constructor.
     *
     * @type {{ format: GSplatFormat, getTexture: (name: string) => Texture }}
     * @private
     */
    _dataSource;

    /** @type {Shader} */
    _placeEntriesShader;

    /** @type {BindGroupFormat} */
    _placeEntriesBindGroupFormat;

    /** @type {Shader} */
    _placeEntryPrepShader;

    /** @type {BindGroupFormat} */
    _placeEntryPrepBindGroupFormat;

    /** @type {StorageBuffer|null} */
    _placeEntryPrepDispatchBuffer = null;

    /** @type {Compute|null} */
    _placeEntryPrepCompute = null;

    /** @type {Shader} */
    _largeSplatShader;

    /** @type {BindGroupFormat} */
    _largeSplatBindGroupFormat;

    /** @type {Shader} */
    _largeSplatPrepShader;

    /** @type {BindGroupFormat} */
    _largeSplatPrepBindGroupFormat;

    /** @type {StorageBuffer|null} */
    _largeSplatDispatchBuffer = null;

    /** @type {Compute|null} */
    _largeSplatPrepCompute = null;

    /** @type {Shader} */
    _largePlaceEntriesShader;

    /** @type {BindGroupFormat} */
    _largePlaceEntriesBindGroupFormat;

    /** @type {Shader} */
    _classifyShader;

    /** @type {BindGroupFormat} */
    _classifyBindGroupFormat;

    /** @type {Shader} */
    _sortShader;

    /** @type {BindGroupFormat} */
    _sortBindGroupFormat;

    /** @type {Shader} */
    _bucketSortShader;

    /** @type {BindGroupFormat} */
    _bucketSortBindGroupFormat;

    /** @type {Shader} */
    _copyShader;

    /** @type {BindGroupFormat} */
    _copyBindGroupFormat;

    /** @type {Shader} */
    _chunkSortShader;

    /** @type {BindGroupFormat} */
    _chunkSortBindGroupFormat;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GraphNode} node - The graph node.
     * @param {GraphNode} cameraNode - The camera node.
     * @param {Layer} layer - The layer to add mesh instances to.
     * @param {GSplatWorkBuffer} workBuffer - The work buffer containing splat data.
     */
    constructor(device, node, cameraNode, layer, workBuffer) {
        super(device, node, cameraNode, layer, workBuffer);

        this._dataSource = workBuffer;

        this._createSharedShaders();
        this._mainSet = this._createDispatchSet(false);

        this.framePass = new FramePassGSplatComputeLocal(this);

        const thisCamera = cameraNode.camera;
        this.tileComposite = new GSplatTileComposite(device, node, (camera) => {
            const renderMode = this.renderMode ?? 0;
            return thisCamera.camera === camera && (renderMode & GSPLAT_FORWARD) !== 0 && this._mainSet._rasterizeTileListBuffer !== null;
        });
    }

    /**
     * Sets the data source for format and texture access, decoupling this renderer from
     * the work buffer. The source object must provide:
     *
     * - `format` — a {@link GSplatFormat} describing the texture streams and shader read code.
     * - `getTexture(name)` — a function returning a {@link Texture} for a given stream name.
     *
     * @param {object} source - The data source.
     */
    setDataSource(source) {
        this._dataSource = source;
    }

    destroy() {
        this._unregisterFramePass();

        if (this.renderMode) {
            if (this.renderMode & GSPLAT_FORWARD) {
                this.layer.removeMeshInstances([this.tileComposite.meshInstance], true);
            }
        }

        this._mainSet.destroy();
        this._pickSet?.destroy();

        this._placeEntriesShader.destroy();
        this._placeEntriesBindGroupFormat.destroy();
        this._placeEntryPrepShader.destroy();
        this._placeEntryPrepBindGroupFormat.destroy();
        this._placeEntryPrepDispatchBuffer?.destroy();
        this._largeSplatShader.destroy();
        this._largeSplatBindGroupFormat.destroy();
        this._largeSplatPrepShader.destroy();
        this._largeSplatPrepBindGroupFormat.destroy();
        this._largeSplatDispatchBuffer?.destroy();
        this._largePlaceEntriesShader.destroy();
        this._largePlaceEntriesBindGroupFormat.destroy();
        this._classifyShader.destroy();
        this._classifyBindGroupFormat.destroy();
        this._sortShader.destroy();
        this._sortBindGroupFormat.destroy();
        this._bucketSortShader.destroy();
        this._bucketSortBindGroupFormat.destroy();
        this._copyShader.destroy();
        this._copyBindGroupFormat.destroy();
        this._chunkSortShader.destroy();
        this._chunkSortBindGroupFormat.destroy();

        this._projCacheBuffer?.destroy();
        this._depthBuffer?.destroy();
        this._tileEntriesBuffer?.destroy();
        this._pairBuffer?.destroy();
        this._countersBuffer?.destroy();
        this._splatPairStartBuffer?.destroy();
        this._splatPairCountBuffer?.destroy();
        this._largeSplatIdsBuffer?.destroy();

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

    frameUpdate(gsplat, exposure, fogParams) {
        if (this._needsFramePassRegister) {
            this._registerFramePass();
        }
        this._minPixelSize = gsplat.minPixelSize;
        this._minContribution = gsplat.minContribution;
        this._alphaClip = gsplat.alphaClip;
        this._exposure = exposure ?? 1.0;
        this._fisheye = gsplat.fisheye;
        this._fogParams = fogParams ?? null;
        this._debugMode = gsplat.debug;

        const formatHash = this._dataSource.format.hash;
        if (formatHash !== this._formatHash) {
            this._formatHash = formatHash;
            this._invalidateCountCompute();
        }
    }

    /**
     * @param {StorageBuffer} compactedSplatIds - Dense buffer of visible splat IDs.
     * @param {StorageBuffer} sortElementCountBuffer - Single-u32 buffer with visible count.
     * @param {number} textureSize - The work buffer texture size.
     * @param {number} numSplats - Upper bound on visible splats.
     */
    setCompactedData(compactedSplatIds, sortElementCountBuffer, textureSize, numSplats) {
        this._compactedSplatIds = compactedSplatIds;
        this._sortElementCountBuffer = sortElementCountBuffer;
        this._textureSize = textureSize;
        this._numSplats = numSplats;
    }

    /** @private */
    _registerFramePass() {
        const camera = this.cameraNode.camera?.camera;
        if (camera) {
            // Schedule the compute splat pass before this camera's scene rendering.
            if (!camera.beforePasses.includes(this.framePass)) {
                camera.beforePasses.push(this.framePass);
            }
            this._needsFramePassRegister = false;
        } else {
            this._needsFramePassRegister = true;
        }
    }

    /** @private */
    _unregisterFramePass() {
        this._needsFramePassRegister = false;
        const camera = this.cameraNode.camera?.camera;
        if (camera) {
            const idx = camera.beforePasses.indexOf(this.framePass);
            if (idx !== -1) {
                camera.beforePasses.splice(idx, 1);
            }
        }
    }

    resizeOutputTexture(width, height) {
        this._mainSet.resizeOutputTextures(width, height);
    }

    /**
     * Ensure shared splat/entry buffers are large enough. Only resizes when
     * device.submitVersion has changed (preventing mid-encoder buffer destruction).
     *
     * @param {number} numSplats - Upper bound on visible splats.
     * @private
     */
    _ensureSharedBuffers(numSplats) {
        const device = this.device;
        const canResize = device.submitVersion !== this._lastBufferSubmitVersion;

        // Consume readback for shrink logic
        const readbackValue = this._lastReadbackEntryCount;
        if (readbackValue !== -1) {
            this._lastReadbackEntryCount = -1;
            const currentCapacity = this._allocatedEntryCapacity;
            if (currentCapacity > 0 && readbackValue < currentCapacity / 2) {
                this._shrinkFrameCount++;
            } else {
                this._shrinkFrameCount = 0;
            }
            if (this._shrinkFrameCount >= SHRINK_THRESHOLD && numSplats > 0) {
                const target = Math.max(INITIAL_TILE_ENTRY_MULTIPLIER, (readbackValue / numSplats) * ENTRY_HEADROOM_MULTIPLIER);
                this._tileEntryMultiplier = Math.max(target, this._tileEntryMultiplier * 0.9);
                this._shrinkFrameCount = 0;
            }
        }

        if (!canResize) return;

        // Splat capacity (projCache + depthBuffer + per-splat pair metadata)
        if (numSplats > this._allocatedSplatCapacity) {
            this._projCacheBuffer?.destroy();
            this._depthBuffer?.destroy();
            this._splatPairStartBuffer?.destroy();
            this._splatPairCountBuffer?.destroy();
            this._allocatedSplatCapacity = numSplats;
            this._projCacheBuffer = new StorageBuffer(device, numSplats * CACHE_STRIDE * 4);
            this._depthBuffer = new StorageBuffer(device, numSplats * 4);
            this._splatPairStartBuffer = new StorageBuffer(device, numSplats * 4);
            this._splatPairCountBuffer = new StorageBuffer(device, numSplats * 4);
        }

        // Packed atomic counters: [0] = global pair counter, [1] = large splat count.
        if (!this._countersBuffer) {
            this._countersBuffer = new StorageBuffer(device, 8, BUFFERUSAGE_COPY_DST | BUFFERUSAGE_COPY_SRC);
        }

        // Large-splat ID buffer (grow-only)
        if (this._largeSplatIdsCapacity > this._allocatedLargeSplatCapacity) {
            this._largeSplatIdsBuffer?.destroy();
            this._allocatedLargeSplatCapacity = this._largeSplatIdsCapacity;
            this._largeSplatIdsBuffer = new StorageBuffer(device, this._largeSplatIdsCapacity * 4);
        }

        // Entry capacity (tileEntries + pairBuffer — both sized identically)
        const requiredEntryCapacity = Math.ceil(numSplats * this._tileEntryMultiplier);
        const needsGrow = requiredEntryCapacity > this._allocatedEntryCapacity;
        const needsShrink = this._allocatedEntryCapacity > 0 &&
            requiredEntryCapacity * 2 < this._allocatedEntryCapacity;
        if (needsGrow || needsShrink) {
            this._tileEntriesBuffer?.destroy();
            this._pairBuffer?.destroy();
            this._allocatedEntryCapacity = requiredEntryCapacity;
            this._tileEntriesBuffer = new StorageBuffer(device, requiredEntryCapacity * 4, BUFFERUSAGE_COPY_DST);
            this._pairBuffer = new StorageBuffer(device, requiredEntryCapacity * 4);
        }

        this._lastBufferSubmitVersion = device.submitVersion;
    }

    /**
     * Main color dispatch.
     */
    dispatch() {
        const set = this._mainSet;
        const outputTex = set.outputTexture;
        if (!outputTex) return;
        const width = outputTex.width;
        const height = outputTex.height;

        this._dispatchPipeline(set, width, height, false);

        this.tileComposite.update(
            this._lastDrawSlot, outputTex,
            set._rasterizeTileListBuffer, this._lastNumTilesX, width, height
        );
    }

    /**
     * Pick dispatch: runs the compute pick pipeline and returns the configured pick mesh instance.
     *
     * @param {object} cam - The camera.
     * @param {number} width - Pick target width.
     * @param {number} height - Pick target height.
     * @returns {MeshInstance|null} The pick mesh instance ready for the picker's render list.
     */
    dispatchPick(cam, width, height) {
        if (!this._pickSet) {
            this._pickSet = this._createDispatchSet(true);
        }

        const set = this._pickSet;
        set.resizeOutputTextures(width, height);

        this._dispatchPipeline(set, width, height, true);

        return this.tileComposite.prepareForPicking(
            this._lastDrawSlot, set.pickIdTexture, set.pickDepthTexture,
            set._rasterizeTileListBuffer, this._lastNumTilesX, width, height
        );
    }

    /** @type {number} */
    _lastDrawSlot = 0;

    /** @type {number} */
    _lastNumTilesX = 0;

    /**
     * Unified dispatch pipeline used by both color and pick paths.
     *
     * @param {GSplatLocalDispatchSet} set - The dispatch set to use.
     * @param {number} width - Render target width.
     * @param {number} height - Render target height.
     * @param {boolean} pickMode - Whether this is a pick dispatch.
     * @private
     */
    _dispatchPipeline(set, width, height, pickMode) {
        const numSplats = this._numSplats;
        if (!this._compactedSplatIds || !this._sortElementCountBuffer || numSplats === 0) return;

        const device = this.device;
        let numTilesX = Math.ceil(width / TILE_SIZE);
        let numTilesY = Math.ceil(height / TILE_SIZE);

        if (numTilesX * numTilesY > MAX_TILES) {
            Debug.warnOnce('GSplatComputeLocalRenderer: render target exceeds maximum supported tile count (65535). Tile coverage will be clamped, causing rendering artifacts at screen edges.');
            const scale = Math.sqrt(MAX_TILES / (numTilesX * numTilesY));
            numTilesX = Math.max(1, Math.floor(numTilesX * scale));
            numTilesY = Math.max(1, Math.floor(numTilesY * scale));
        }

        const numTiles = numTilesX * numTilesY;

        this._ensureSharedBuffers(numSplats);
        set.ensureTileBuffers(numTiles);

        const maxEntries = this._allocatedEntryCapacity;

        const ds = this._dataSource;
        const camera = this.cameraNode.camera;
        const cam = camera.camera;

        const view = cam.viewMatrix;
        const proj = cam.projectionMatrix;
        _viewProjMat.mul2(proj, view);
        _viewProjData.set(_viewProjMat.data);
        _viewData.set(view.data);
        const focal = width * proj.data[0];

        const alphaClip = pickMode ? this._alphaClip : (1.0 / 255.0);

        // Ensure fisheyeProj is up-to-date (culling may not have run this frame)
        this.fisheyeProj.update(this._fisheye, camera.fov, proj);

        const fisheyeEnabled = this.fisheyeProj.enabled;
        const createCountShader = (pick, fisheye) => this._createCountShaderAndFormat(pick, fisheye);
        const countCompute = set.getCountCompute(fisheyeEnabled, createCountShader);

        // Prep dispatch: compute indirect dispatch dimensions from the visible count.
        // Writes two dispatch slots: slot 0 for tile-count, slot 1 for place-entries
        // (both 1 splat/thread, 256-wide workgroups).
        this._placeEntryPrepCompute.setParameter('sortElementCount', this._sortElementCountBuffer);
        this._placeEntryPrepCompute.setParameter('dispatchArgs', this._placeEntryPrepDispatchBuffer);
        this._placeEntryPrepCompute.setupDispatch(1, 1, 1);
        device.computeDispatch([this._placeEntryPrepCompute], 'GSplatLocalDispatchPrep');

        // --- Pass 1: Per-tile count + projection cache + pair buffer writes ---
        set._tileSplatCountsBuffer.clear();
        this._countersBuffer.clear();

        countCompute.setParameter('compactedSplatIds', this._compactedSplatIds);
        countCompute.setParameter('sortElementCount', this._sortElementCountBuffer);
        countCompute.setParameter('projCache', this._projCacheBuffer);
        countCompute.setParameter('tileSplatCounts', set._tileSplatCountsBuffer);
        countCompute.setParameter('pairBuffer', this._pairBuffer);
        countCompute.setParameter('countersBuffer', this._countersBuffer);
        countCompute.setParameter('splatPairStart', this._splatPairStartBuffer);
        countCompute.setParameter('splatPairCount', this._splatPairCountBuffer);
        countCompute.setParameter('largeSplatIds', this._largeSplatIdsBuffer);
        countCompute.setParameter('depthBuffer', this._depthBuffer);
        for (const stream of ds.format.streams) {
            countCompute.setParameter(stream.name, ds.getTexture(stream.name));
        }
        for (const stream of ds.format.extraStreams) {
            countCompute.setParameter(stream.name, ds.getTexture(stream.name));
        }
        countCompute.setParameter('splatTextureSize', this._textureSize);
        countCompute.setParameter('numTilesX', numTilesX);
        countCompute.setParameter('numTilesY', numTilesY);
        countCompute.setParameter('viewProj', _viewProjData);
        countCompute.setParameter('viewMatrix', _viewData);
        countCompute.setParameter('focal', focal);
        countCompute.setParameter('viewportWidth', width);
        countCompute.setParameter('viewportHeight', height);
        countCompute.setParameter('nearClip', cam.nearClip);
        countCompute.setParameter('farClip', cam.farClip);
        countCompute.setParameter('minPixelSize', this._minPixelSize * 0.5);
        countCompute.setParameter('isOrtho', cam.projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0);
        countCompute.setParameter('exposure', this._exposure);
        countCompute.setParameter('alphaClip', alphaClip);
        countCompute.setParameter('minContribution', this._minContribution);

        if (fisheyeEnabled) {
            const fp = this.fisheyeProj;
            countCompute.setParameter('fisheye_k', fp.k);
            countCompute.setParameter('fisheye_inv_k', fp.invK);
            countCompute.setParameter('fisheye_projMat00', fp.projMat00);
            countCompute.setParameter('fisheye_projMat11', fp.projMat11);
        }

        countCompute.setupIndirectDispatch(0, this._placeEntryPrepDispatchBuffer);
        device.computeDispatch([countCompute], pickMode ? 'GSplatPickTileCount' : 'GSplatLocalTileCount');

        // --- Pass 1b: Large-splat prep + cooperative tile count ---
        // Compute indirect dispatch dimensions for the large-splat pass (one workgroup
        // per large splat), then dispatch. Writes to the same tileSplatCounts, pairBuffer,
        // and splatPairStart/Count as the main count pass.
        this._largeSplatPrepCompute.setParameter('countersBuffer', this._countersBuffer);
        this._largeSplatPrepCompute.setParameter('dispatchArgs', this._largeSplatDispatchBuffer);
        this._largeSplatPrepCompute.setParameter('largeSplatIds', this._largeSplatIdsBuffer);
        this._largeSplatPrepCompute.setupDispatch(1, 1, 1);
        device.computeDispatch([this._largeSplatPrepCompute], pickMode ? 'GSplatPickLargeSplatPrep' : 'GSplatLocalLargeSplatPrep');

        set.largeSplatCompute.setParameter('projCache', this._projCacheBuffer);
        set.largeSplatCompute.setParameter('tileSplatCounts', set._tileSplatCountsBuffer);
        set.largeSplatCompute.setParameter('pairBuffer', this._pairBuffer);
        set.largeSplatCompute.setParameter('countersBuffer', this._countersBuffer);
        set.largeSplatCompute.setParameter('splatPairStart', this._splatPairStartBuffer);
        set.largeSplatCompute.setParameter('splatPairCount', this._splatPairCountBuffer);
        set.largeSplatCompute.setParameter('largeSplatIds', this._largeSplatIdsBuffer);
        set.largeSplatCompute.setParameter('numTilesX', numTilesX);
        set.largeSplatCompute.setParameter('numTilesY', numTilesY);
        set.largeSplatCompute.setParameter('viewportWidth', width);
        set.largeSplatCompute.setParameter('viewportHeight', height);
        set.largeSplatCompute.setParameter('alphaClip', alphaClip);

        set.largeSplatCompute.setupIndirectDispatch(0, this._largeSplatDispatchBuffer);
        device.computeDispatch([set.largeSplatCompute], pickMode ? 'GSplatPickLargeTileCount' : 'GSplatLocalLargeTileCount');

        // --- Pass 2: Prefix sum ---
        set.prefixSumKernel.resize(set._tileSplatCountsBuffer, numTiles + 1);
        set.prefixSumKernel.dispatch(device);

        // --- Pass 3: Place entries (scatter-free) ---
        // Reads (tileIdx, localOffset) pairs written by the count pass and places splat
        // indices into tileEntries at positions determined by the prefix-summed tile offsets.
        // No atomics, no projCache reads, no intersection recomputation.
        set.placeEntriesCompute.setParameter('pairBuffer', this._pairBuffer);
        set.placeEntriesCompute.setParameter('splatPairStart', this._splatPairStartBuffer);
        set.placeEntriesCompute.setParameter('splatPairCount', this._splatPairCountBuffer);
        set.placeEntriesCompute.setParameter('tileSplatCounts', set._tileSplatCountsBuffer);
        set.placeEntriesCompute.setParameter('tileEntries', this._tileEntriesBuffer);
        set.placeEntriesCompute.setParameter('sortElementCount', this._sortElementCountBuffer);

        // Slot 1 of the prep buffer holds the full (1 splat/thread) dispatch dimensions.
        set.placeEntriesCompute.setupIndirectDispatch(1, this._placeEntryPrepDispatchBuffer);
        device.computeDispatch([set.placeEntriesCompute], pickMode ? 'GSplatPickPlaceEntries' : 'GSplatLocalPlaceEntries');

        // --- Pass 3b: Cooperative place entries for large splats ---
        // Reuses the same indirect dispatch as LargeTileCount (one workgroup per large splat).
        set.largePlaceEntriesCompute.setParameter('pairBuffer', this._pairBuffer);
        set.largePlaceEntriesCompute.setParameter('splatPairStart', this._splatPairStartBuffer);
        set.largePlaceEntriesCompute.setParameter('splatPairCount', this._splatPairCountBuffer);
        set.largePlaceEntriesCompute.setParameter('tileSplatCounts', set._tileSplatCountsBuffer);
        set.largePlaceEntriesCompute.setParameter('tileEntries', this._tileEntriesBuffer);
        set.largePlaceEntriesCompute.setParameter('largeSplatIds', this._largeSplatIdsBuffer);
        set.largePlaceEntriesCompute.setParameter('countersBuffer', this._countersBuffer);

        set.largePlaceEntriesCompute.setupIndirectDispatch(0, this._largeSplatDispatchBuffer);
        device.computeDispatch([set.largePlaceEntriesCompute], pickMode ? 'GSplatPickLargePlaceEntries' : 'GSplatLocalLargePlaceEntries');

        // --- Pass 3.5: Classify ---
        set._tileListCountsBuffer.clear();
        set._totalChunksBuffer.clear();
        set._chunkSortIndirectBuffer.clear();

        const indirectSlot = device.getIndirectDispatchSlot(3);
        const drawSlot = device.getIndirectDrawSlot(1);

        set.classifyCompute.setParameter('tileSplatCounts', set._tileSplatCountsBuffer);
        set.classifyCompute.setParameter('smallTileList', set._smallTileListBuffer);
        set.classifyCompute.setParameter('largeTileList', set._largeTileListBuffer);
        set.classifyCompute.setParameter('rasterizeTileList', set._rasterizeTileListBuffer);
        set.classifyCompute.setParameter('tileListCounts', set._tileListCountsBuffer);
        set.classifyCompute.setParameter('indirectDispatchArgs', device.indirectDispatchBuffer);
        set.classifyCompute.setParameter('largeTileOverflowBases', set._largeTileOverflowBasesBuffer);
        set.classifyCompute.setParameter('indirectDrawArgs', device.indirectDrawBuffer);
        set.classifyCompute.setParameter('numTiles', numTiles);
        set.classifyCompute.setParameter('dispatchSlotOffset', indirectSlot * 3);
        set.classifyCompute.setParameter('bufferCapacity', maxEntries);
        set.classifyCompute.setParameter('maxWorkgroupsPerDim', device.limits.maxComputeWorkgroupsPerDimension || 65535);
        set.classifyCompute.setParameter('drawSlot', drawSlot);

        set.classifyCompute.setupDispatch(1, 1, 1);
        device.computeDispatch([set.classifyCompute], pickMode ? 'GSplatPickClassify' : 'GSplatLocalClassify');

        // --- Pass 4b: Bucket pre-sort ---
        set.bucketSortCompute.setParameter('tileEntries', this._tileEntriesBuffer);
        set.bucketSortCompute.setParameter('largeTileOverflowBases', set._largeTileOverflowBasesBuffer);
        set.bucketSortCompute.setParameter('tileSplatCounts', set._tileSplatCountsBuffer);
        set.bucketSortCompute.setParameter('depthBuffer', this._depthBuffer);
        set.bucketSortCompute.setParameter('largeTileList', set._largeTileListBuffer);
        set.bucketSortCompute.setParameter('chunkRanges', set._chunkRangesBuffer);
        set.bucketSortCompute.setParameter('totalChunks', set._totalChunksBuffer);
        set.bucketSortCompute.setParameter('tileListCounts', set._tileListCountsBuffer);
        set.bucketSortCompute.setParameter('bufferCapacity', maxEntries);
        set.bucketSortCompute.setParameter('maxChunks', numTiles * MAX_CHUNKS_PER_TILE);

        set.bucketSortCompute.setupIndirectDispatch(indirectSlot + 1);
        device.computeDispatch([set.bucketSortCompute], pickMode ? 'GSplatPickBucketSort' : 'GSplatLocalBucketSort');

        // --- Pass 4b.5: Copy chunk sort indirect ---
        set.copyCompute.setParameter('totalChunks', set._totalChunksBuffer);
        set.copyCompute.setParameter('chunkSortIndirect', set._chunkSortIndirectBuffer);
        set.copyCompute.setParameter('maxChunks', numTiles * MAX_CHUNKS_PER_TILE);
        set.copyCompute.setParameter('maxWorkgroupsPerDim', device.limits.maxComputeWorkgroupsPerDimension || 65535);

        set.copyCompute.setupDispatch(1, 1, 1);
        device.computeDispatch([set.copyCompute], pickMode ? 'GSplatPickCopy' : 'GSplatLocalCopy');

        // --- Pass 4a: Small tile sort ---
        set.sortCompute.setParameter('tileEntries', this._tileEntriesBuffer);
        set.sortCompute.setParameter('tileSplatCounts', set._tileSplatCountsBuffer);
        set.sortCompute.setParameter('depthBuffer', this._depthBuffer);
        set.sortCompute.setParameter('smallTileList', set._smallTileListBuffer);
        set.sortCompute.setParameter('tileListCounts', set._tileListCountsBuffer);

        set.sortCompute.setupIndirectDispatch(indirectSlot);
        device.computeDispatch([set.sortCompute], pickMode ? 'GSplatPickTileSort' : 'GSplatLocalTileSort');

        // --- Pass 4c: Chunk sort ---
        set.chunkSortCompute.setParameter('tileEntries', this._tileEntriesBuffer);
        set.chunkSortCompute.setParameter('depthBuffer', this._depthBuffer);
        set.chunkSortCompute.setParameter('chunkRanges', set._chunkRangesBuffer);
        set.chunkSortCompute.setParameter('totalChunks', set._totalChunksBuffer);
        set.chunkSortCompute.setParameter('maxChunks', numTiles * MAX_CHUNKS_PER_TILE);

        set.chunkSortCompute.setupIndirectDispatch(0, set._chunkSortIndirectBuffer);
        device.computeDispatch([set.chunkSortCompute], pickMode ? 'GSplatPickChunkSort' : 'GSplatLocalChunkSort');

        // --- Pass 5: Rasterize ---
        // Select the shader variant based on pick mode and depth availability. Depth testing
        // against the scene linear depth texture is only used in color mode when the depth
        // prepass has run (indicated by sceneDepthMapLinear) and the texture is bound.
        const hasLinearDepth = cam.shaderParams.sceneDepthMapLinear;
        const sceneDepthMap = hasLinearDepth ? device.scope.resolve('uSceneDepthMap').value : null;
        const useDepth = !pickMode && sceneDepthMap;

        const fogParams = this._fogParams;
        const fogType = (fogParams && fogParams.type !== FOG_NONE) ? fogParams.type : 'none';
        const heatmap = !pickMode && this._debugMode === GSPLAT_DEBUG_HEATMAP;
        const rasterizeCompute = set.getRasterizeCompute(pickMode, useDepth, fogType, heatmap);

        rasterizeCompute.setParameter('screenWidth', width);
        rasterizeCompute.setParameter('screenHeight', height);
        rasterizeCompute.setParameter('numTilesX', numTilesX);
        rasterizeCompute.setParameter('nearClip', cam.nearClip);
        rasterizeCompute.setParameter('farClip', cam.farClip);
        rasterizeCompute.setParameter('alphaClip', alphaClip);

        if (fogType !== 'none') {
            _fogColorLinear.linear(fogParams.color);
            _fogColorArray[0] = _fogColorLinear.r;
            _fogColorArray[1] = _fogColorLinear.g;
            _fogColorArray[2] = _fogColorLinear.b;
            rasterizeCompute.setParameter('fog_color', _fogColorArray);
            rasterizeCompute.setParameter('fog_start', fogParams.start);
            rasterizeCompute.setParameter('fog_end', fogParams.end);
            rasterizeCompute.setParameter('fog_density', fogParams.density);
        }
        rasterizeCompute.setParameter('tileEntries', this._tileEntriesBuffer);
        rasterizeCompute.setParameter('tileSplatCounts', set._tileSplatCountsBuffer);
        rasterizeCompute.setParameter('projCache', this._projCacheBuffer);
        rasterizeCompute.setParameter('rasterizeTileList', set._rasterizeTileListBuffer);
        rasterizeCompute.setParameter('tileListCounts', set._tileListCountsBuffer);
        rasterizeCompute.setParameter('depthBuffer', this._depthBuffer);
        if (pickMode) {
            rasterizeCompute.setParameter('pickIdTexture', set.pickIdTexture);
            rasterizeCompute.setParameter('pickDepthTexture', set.pickDepthTexture);
        } else {
            rasterizeCompute.setParameter('outputTexture', set.outputTexture);
            if (useDepth) {
                rasterizeCompute.setParameter('sceneDepthMap', sceneDepthMap);
            }
        }

        rasterizeCompute.setupIndirectDispatch(indirectSlot + 2);
        device.computeDispatch([rasterizeCompute], pickMode ? 'GSplatPickRasterize' : 'GSplatLocalRasterize');

        this._lastDrawSlot = drawSlot;
        this._lastNumTilesX = numTilesX;

        this._scheduleReadback(numSplats, numTiles, set);
    }

    /**
     * @param {number} numSplats - Splat count at dispatch time.
     * @param {number} numTiles - Tile count at dispatch time.
     * @param {GSplatLocalDispatchSet} set - The dispatch set to readback from.
     * @private
     */
    _scheduleReadback(numSplats, numTiles, set) {
        if (numSplats === 0) return;

        const capturedNumSplats = numSplats;

        const readback1 = set._tileSplatCountsBuffer.read(numTiles * 4, 4);
        const readback2 = set._tileListCountsBuffer.read(3 * 4, 4);
        const readback3 = this._countersBuffer.read(4, 4);

        Promise.all([readback1, readback2, readback3]).then(([r1, r2, r3]) => {
            const totalEntries = new Uint32Array(r1.buffer, r1.byteOffset, 1)[0];
            const totalOverflow = new Uint32Array(r2.buffer, r2.byteOffset, 1)[0];
            const needed = totalEntries + totalOverflow;

            if (capturedNumSplats > 0) {
                this._tileEntryMultiplier = Math.max(this._tileEntryMultiplier, (needed / capturedNumSplats) * ENTRY_HEADROOM_MULTIPLIER);
                this._tileEntryMultiplier = Math.max(this._tileEntryMultiplier, INITIAL_TILE_ENTRY_MULTIPLIER);
            }

            this._lastReadbackEntryCount = needed;

            // Grow the large-splat ID buffer if demand exceeded capacity (grow-only)
            const largeSplatDemand = new Uint32Array(r3.buffer, r3.byteOffset, 1)[0];
            if (largeSplatDemand > this._largeSplatIdsCapacity) {
                this._largeSplatIdsCapacity = Math.ceil(largeSplatDemand * 1.2);
            }
        }).catch(() => {
            // readback failed, ignore
        });
    }

    /**
     * Invalidates all cached count resources on both dispatch sets. Called when the
     * work buffer format changes, making all compiled count shaders invalid.
     *
     * @private
     */
    _invalidateCountCompute() {
        this._mainSet.destroyCountResources();
        this._pickSet?.destroyCountResources();
    }

    // ---- Shader / BindGroupFormat creation ----

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

    /**
     * Creates all shared shaders and bind group formats (called once in constructor).
     *
     * @private
     */
    _createSharedShaders() {
        const device = this.device;

        // Count shader/format are created lazily by each dispatch set's getCountCompute()

        // --- PlaceEntries (replaces the old scatter pass) ---
        this._placeEntriesBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('pairBuffer', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('splatPairStart', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('splatPairCount', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('tileSplatCounts', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('tileEntries', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('sortElementCount', SHADERSTAGE_COMPUTE, true)
        ]);
        this._placeEntriesShader = new Shader(device, {
            name: 'GSplatLocalPlaceEntries',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatLocalPlaceEntriesSource,
            computeBindGroupFormat: this._placeEntriesBindGroupFormat
        });

        // --- PlaceEntryPrep: tiny 1-thread shader that reads the visible count and writes
        // dispatch args for place-entries into a local buffer. This avoids relying on the
        // device-level indirect dispatch buffer written earlier in the frame. ---
        {
            const maxDim = device.limits.maxComputeWorkgroupsPerDimension || 65535;
            const prepDefines = new Map();
            prepDefines.set('{MAX_DIM}', maxDim.toString());
            prepDefines.set('{SPLATS_PER_WG}', '256');
            prepDefines.set('{SPLATS_PER_WG_MINUS_1}', '255');

            this._placeEntryPrepBindGroupFormat = new BindGroupFormat(device, [
                new BindStorageBufferFormat('sortElementCount', SHADERSTAGE_COMPUTE, true),
                new BindStorageBufferFormat('dispatchArgs', SHADERSTAGE_COMPUTE)
            ]);
            this._placeEntryPrepShader = new Shader(device, {
                name: 'GSplatLocalPlaceEntryPrep',
                shaderLanguage: SHADERLANGUAGE_WGSL,
                cshader: computeGsplatLocalDispatchPrepSource,
                cdefines: prepDefines,
                computeBindGroupFormat: this._placeEntryPrepBindGroupFormat
            });

            this._placeEntryPrepDispatchBuffer = new StorageBuffer(device, 6 * 4, BUFFERUSAGE_INDIRECT);
            this._placeEntryPrepCompute = new Compute(device, this._placeEntryPrepShader);
        }

        // --- Large-splat cooperative tile count ---
        {
            const cincludes = this._createCommonIncludes();

            const ubf = new UniformBufferFormat(device, [
                new UniformFormat('numTilesX', UNIFORMTYPE_UINT),
                new UniformFormat('numTilesY', UNIFORMTYPE_UINT),
                new UniformFormat('viewportWidth', UNIFORMTYPE_FLOAT),
                new UniformFormat('viewportHeight', UNIFORMTYPE_FLOAT),
                new UniformFormat('alphaClip', UNIFORMTYPE_FLOAT)
            ]);

            this._largeSplatBindGroupFormat = new BindGroupFormat(device, [
                new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE, true),
                new BindStorageBufferFormat('tileSplatCounts', SHADERSTAGE_COMPUTE),
                new BindStorageBufferFormat('pairBuffer', SHADERSTAGE_COMPUTE),
                new BindStorageBufferFormat('countersBuffer', SHADERSTAGE_COMPUTE),
                new BindStorageBufferFormat('splatPairStart', SHADERSTAGE_COMPUTE),
                new BindStorageBufferFormat('splatPairCount', SHADERSTAGE_COMPUTE),
                new BindStorageBufferFormat('largeSplatIds', SHADERSTAGE_COMPUTE, true),
                new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
            ]);

            const cdefines = new Map();
            cdefines.set('{CACHE_STRIDE}', CACHE_STRIDE.toString());

            this._largeSplatShader = new Shader(device, {
                name: 'GSplatLocalTileCountLarge',
                shaderLanguage: SHADERLANGUAGE_WGSL,
                cshader: computeGsplatLocalTileCountLargeSource,
                cincludes,
                cdefines,
                computeBindGroupFormat: this._largeSplatBindGroupFormat,
                computeUniformBufferFormats: { uniforms: ubf }
            });
        }

        // --- Large-splat prep: reads countersBuffer[1] (large splat count) and computes indirect dispatch args ---
        {
            const maxDim = device.limits.maxComputeWorkgroupsPerDimension || 65535;
            const largePrepDefines = new Map();
            largePrepDefines.set('{MAX_DIM}', maxDim.toString());

            this._largeSplatPrepBindGroupFormat = new BindGroupFormat(device, [
                new BindStorageBufferFormat('countersBuffer', SHADERSTAGE_COMPUTE, true),
                new BindStorageBufferFormat('dispatchArgs', SHADERSTAGE_COMPUTE),
                new BindStorageBufferFormat('largeSplatIds', SHADERSTAGE_COMPUTE, true)
            ]);
            this._largeSplatPrepShader = new Shader(device, {
                name: 'GSplatLocalLargeSplatPrep',
                shaderLanguage: SHADERLANGUAGE_WGSL,
                cshader: computeGsplatLocalDispatchPrepLargeSource,
                cdefines: largePrepDefines,
                computeBindGroupFormat: this._largeSplatPrepBindGroupFormat
            });

            this._largeSplatDispatchBuffer = new StorageBuffer(device, 3 * 4, BUFFERUSAGE_INDIRECT);
            this._largeSplatPrepCompute = new Compute(device, this._largeSplatPrepShader);
        }

        // --- Large-splat cooperative place entries ---
        this._largePlaceEntriesBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('pairBuffer', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('splatPairStart', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('splatPairCount', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('tileSplatCounts', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('tileEntries', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('largeSplatIds', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('countersBuffer', SHADERSTAGE_COMPUTE, true)
        ]);
        this._largePlaceEntriesShader = new Shader(device, {
            name: 'GSplatLocalPlaceEntriesLarge',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatLocalPlaceEntriesLargeSource,
            computeBindGroupFormat: this._largePlaceEntriesBindGroupFormat
        });

        // --- Classify ---
        {
            const ubf = new UniformBufferFormat(device, [
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
            this._classifyShader = new Shader(device, {
                name: 'GSplatLocalClassify',
                shaderLanguage: SHADERLANGUAGE_WGSL,
                cshader: computeGsplatLocalClassifySource,
                computeBindGroupFormat: this._classifyBindGroupFormat,
                computeUniformBufferFormats: { uniforms: ubf }
            });
        }

        // --- Sort ---
        this._sortBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('tileEntries', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('tileSplatCounts', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('depthBuffer', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('smallTileList', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('tileListCounts', SHADERSTAGE_COMPUTE, true)
        ]);
        this._sortShader = new Shader(device, {
            name: 'GSplatLocalTileSort',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatLocalTileSortSource,
            cincludes: this._createBitonicIncludes(),
            computeBindGroupFormat: this._sortBindGroupFormat
        });

        // --- BucketSort ---
        {
            const ubf = new UniformBufferFormat(device, [
                new UniformFormat('bufferCapacity', UNIFORMTYPE_UINT),
                new UniformFormat('maxChunks', UNIFORMTYPE_UINT)
            ]);
            this._bucketSortBindGroupFormat = new BindGroupFormat(device, [
                new BindStorageBufferFormat('tileEntries', SHADERSTAGE_COMPUTE),
                new BindStorageBufferFormat('largeTileOverflowBases', SHADERSTAGE_COMPUTE, true),
                new BindStorageBufferFormat('tileSplatCounts', SHADERSTAGE_COMPUTE, true),
                new BindStorageBufferFormat('depthBuffer', SHADERSTAGE_COMPUTE, true),
                new BindStorageBufferFormat('largeTileList', SHADERSTAGE_COMPUTE, true),
                new BindStorageBufferFormat('chunkRanges', SHADERSTAGE_COMPUTE),
                new BindStorageBufferFormat('totalChunks', SHADERSTAGE_COMPUTE),
                new BindStorageBufferFormat('tileListCounts', SHADERSTAGE_COMPUTE, true),
                new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
            ]);
            this._bucketSortShader = new Shader(device, {
                name: 'GSplatLocalBucketSort',
                shaderLanguage: SHADERLANGUAGE_WGSL,
                cshader: computeGsplatLocalBucketSortSource,
                computeBindGroupFormat: this._bucketSortBindGroupFormat,
                computeUniformBufferFormats: { uniforms: ubf }
            });
        }

        // --- Copy ---
        {
            const ubf = new UniformBufferFormat(device, [
                new UniformFormat('maxChunks', UNIFORMTYPE_UINT),
                new UniformFormat('maxWorkgroupsPerDim', UNIFORMTYPE_UINT)
            ]);
            this._copyBindGroupFormat = new BindGroupFormat(device, [
                new BindStorageBufferFormat('totalChunks', SHADERSTAGE_COMPUTE, true),
                new BindStorageBufferFormat('chunkSortIndirect', SHADERSTAGE_COMPUTE),
                new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
            ]);
            this._copyShader = new Shader(device, {
                name: 'GSplatLocalCopy',
                shaderLanguage: SHADERLANGUAGE_WGSL,
                cshader: computeGsplatLocalCopySource,
                computeBindGroupFormat: this._copyBindGroupFormat,
                computeUniformBufferFormats: { uniforms: ubf }
            });
        }

        // --- ChunkSort ---
        {
            const ubf = new UniformBufferFormat(device, [
                new UniformFormat('maxChunks', UNIFORMTYPE_UINT)
            ]);
            this._chunkSortBindGroupFormat = new BindGroupFormat(device, [
                new BindStorageBufferFormat('tileEntries', SHADERSTAGE_COMPUTE),
                new BindStorageBufferFormat('depthBuffer', SHADERSTAGE_COMPUTE, true),
                new BindStorageBufferFormat('chunkRanges', SHADERSTAGE_COMPUTE, true),
                new BindStorageBufferFormat('totalChunks', SHADERSTAGE_COMPUTE, true),
                new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
            ]);
            this._chunkSortShader = new Shader(device, {
                name: 'GSplatLocalChunkSort',
                shaderLanguage: SHADERLANGUAGE_WGSL,
                cshader: computeGsplatLocalChunkSortSource,
                cincludes: this._createBitonicIncludes(),
                computeBindGroupFormat: this._chunkSortBindGroupFormat,
                computeUniformBufferFormats: { uniforms: ubf }
            });
        }

    }

    /**
     * Creates the count shader + shared bind group format.
     *
     * @param {boolean} pickMode - Whether to create the pick variant.
     * @param {boolean} fisheyeEnabled - Whether to include the GSPLAT_FISHEYE define and fisheye uniforms.
     * @returns {{ shader: Shader, bindGroupFormat: BindGroupFormat }} The shader and format.
     * @private
     */
    _createCountShaderAndFormat(pickMode, fisheyeEnabled) {
        const device = this.device;

        const uniforms = [
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
            new UniformFormat('exposure', UNIFORMTYPE_FLOAT),
            new UniformFormat('alphaClip', UNIFORMTYPE_FLOAT),
            new UniformFormat('minContribution', UNIFORMTYPE_FLOAT)
        ];
        if (fisheyeEnabled) {
            uniforms.push(
                new UniformFormat('fisheye_k', UNIFORMTYPE_FLOAT),
                new UniformFormat('fisheye_inv_k', UNIFORMTYPE_FLOAT),
                new UniformFormat('fisheye_projMat00', UNIFORMTYPE_FLOAT),
                new UniformFormat('fisheye_projMat11', UNIFORMTYPE_FLOAT)
            );
        }
        const uniformBufferFormat = new UniformBufferFormat(device, uniforms);

        const wbFormat = this._dataSource.format;

        const fixedBindings = [
            new BindStorageBufferFormat('compactedSplatIds', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('sortElementCount', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('tileSplatCounts', SHADERSTAGE_COMPUTE),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('pairBuffer', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('countersBuffer', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('splatPairStart', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('splatPairCount', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('largeSplatIds', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('depthBuffer', SHADERSTAGE_COMPUTE)
        ];

        const bindGroupFormat = new BindGroupFormat(device, [
            ...fixedBindings,
            ...wbFormat.getComputeBindFormats()
        ]);

        const cincludes = this._createCommonIncludes();
        cincludes.set('gsplatComputeSplatCS', computeSplatSource);
        cincludes.set('gsplatFormatDeclCS', wbFormat.getComputeInputDeclarations(fixedBindings.length));
        cincludes.set('gsplatFormatReadCS', wbFormat.getReadCode());

        const cdefines = new Map();
        cdefines.set('{CACHE_STRIDE}', CACHE_STRIDE.toString());
        if (fisheyeEnabled) {
            cdefines.set('GSPLAT_FISHEYE', '');
        }
        if (pickMode) {
            cdefines.set('PICK_MODE', '');
        }
        const colorStream = wbFormat.getStream('dataColor');
        if (colorStream && colorStream.format !== PIXELFORMAT_RGBA16U) {
            cdefines.set('GSPLAT_COLOR_FLOAT', '');
        }

        const suffix = fisheyeEnabled ? 'Fisheye' : '';
        const shader = new Shader(device, {
            name: pickMode ? `GSplatLocalTileCountPick${suffix}` : `GSplatLocalTileCount${suffix}`,
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatLocalTileCountSource,
            cincludes,
            cdefines,
            computeBindGroupFormat: bindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });

        return { shader, bindGroupFormat };
    }

    /**
     * Creates a dispatch set with its 8 Compute instances.
     *
     * @param {boolean} pickMode - Whether this set is for picking.
     * @returns {GSplatLocalDispatchSet} The populated dispatch set.
     * @private
     */
    _createDispatchSet(pickMode) {
        const device = this.device;
        const set = new GSplatLocalDispatchSet(device, pickMode);

        // Count compute is created lazily by set.getCountCompute()

        // PlaceEntries: shared shader (replaces the old atomic scatter pass)
        set.placeEntriesCompute = new Compute(device, this._placeEntriesShader, pickMode ? 'GSplatPickPlaceEntries' : 'GSplatLocalPlaceEntries');

        // LargeSplat: cooperative tile count for deferred large splats
        set.largeSplatCompute = new Compute(device, this._largeSplatShader, pickMode ? 'GSplatPickLargeTileCount' : 'GSplatLocalLargeTileCount');

        // LargePlaceEntries: cooperative place entries for deferred large splats
        set.largePlaceEntriesCompute = new Compute(device, this._largePlaceEntriesShader, pickMode ? 'GSplatPickLargePlaceEntries' : 'GSplatLocalLargePlaceEntries');

        // Classify: shared shader
        set.classifyCompute = new Compute(device, this._classifyShader, pickMode ? 'GSplatPickClassify' : 'GSplatLocalClassify');

        // Sort: shared shader
        set.sortCompute = new Compute(device, this._sortShader, pickMode ? 'GSplatPickTileSort' : 'GSplatLocalTileSort');

        // BucketSort: shared shader
        set.bucketSortCompute = new Compute(device, this._bucketSortShader, pickMode ? 'GSplatPickBucketSort' : 'GSplatLocalBucketSort');

        // Copy: shared shader
        set.copyCompute = new Compute(device, this._copyShader, pickMode ? 'GSplatPickCopy' : 'GSplatLocalCopy');

        // ChunkSort: shared shader
        set.chunkSortCompute = new Compute(device, this._chunkSortShader, pickMode ? 'GSplatPickChunkSort' : 'GSplatLocalChunkSort');

        return set;
    }
}

export { GSplatComputeLocalRenderer };
