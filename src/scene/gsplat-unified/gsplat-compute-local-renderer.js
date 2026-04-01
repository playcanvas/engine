import { Vec2 } from '../../core/math/vec2.js';
import { Compute } from '../../platform/graphics/compute.js';
import { Shader } from '../../platform/graphics/shader.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { BindGroupFormat, BindStorageBufferFormat, BindStorageTextureFormat, BindUniformBufferFormat } from '../../platform/graphics/bind-group-format.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import {
    BUFFERUSAGE_COPY_DST,
    PIXELFORMAT_R32U, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA16U,
    SHADERLANGUAGE_WGSL,
    SHADERSTAGE_COMPUTE,
    UNIFORMTYPE_FLOAT,
    UNIFORMTYPE_MAT4,
    UNIFORMTYPE_UINT
} from '../../platform/graphics/constants.js';
import { GSPLAT_FORWARD, PROJECTION_ORTHOGRAPHIC } from '../constants.js';
import { Mat4 } from '../../core/math/mat4.js';
import { GSplatRenderer } from './gsplat-renderer.js';
import { shaderChunksWGSL } from '../shader-lib/wgsl/collections/shader-chunks-wgsl.js';
import { FramePassGSplatComputeLocal } from './frame-pass-gsplat-compute-local.js';
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
import { GSplatLocalDispatchSet } from './gsplat-local-dispatch-set.js';
import computeSplatSource from '../shader-lib/wgsl/chunks/gsplat/vert/gsplatComputeSplat.js';

/**
 * @import { GraphNode } from '../graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Layer } from '../layer.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
 * @import { MeshInstance } from '../mesh-instance.js'
 */

const TILE_SIZE = 16;
const INITIAL_TILE_ENTRY_MULTIPLIER = 1.5;
const COUNT_WORKGROUP_SIZE = 256;
const CACHE_STRIDE = 8;
const MAX_CHUNKS_PER_TILE = 8;
const SHRINK_THRESHOLD = 10;
const _viewProjMat = new Mat4();
const _viewProjData = new Float32Array(16);
const _viewData = new Float32Array(16);
const _dispatchSize = new Vec2();

/**
 * Renders splats using a tiled compute pipeline with per-tile binning and local sorting.
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
    _minContribution = 2.0;

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

    // --- Shared shaders and bind group formats ---

    /** @type {Shader|null} */
    _countColorShader = null;

    /** @type {Shader|null} */
    _countPickShader = null;

    /** @type {BindGroupFormat|null} */
    _countBindGroupFormat = null;

    /** @type {BindGroupFormat|null} */
    _countPickBindGroupFormat = null;

    /** @type {Shader} */
    _scatterShader;

    /** @type {BindGroupFormat} */
    _scatterBindGroupFormat;

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

    /** @type {Shader} */
    _rasterizeColorShader;

    /** @type {Shader|null} */
    _rasterizePickShader = null;

    /** @type {BindGroupFormat} */
    _rasterizeColorBindGroupFormat;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GraphNode} node - The graph node.
     * @param {GraphNode} cameraNode - The camera node.
     * @param {Layer} layer - The layer to add mesh instances to.
     * @param {GSplatWorkBuffer} workBuffer - The work buffer containing splat data.
     */
    constructor(device, node, cameraNode, layer, workBuffer) {
        super(device, node, cameraNode, layer, workBuffer);

        this._createSharedShaders();
        this._mainSet = this._createDispatchSet(false);

        this.framePass = new FramePassGSplatComputeLocal(this);

        const thisCamera = cameraNode.camera;
        this.tileComposite = new GSplatTileComposite(device, node, (camera) => {
            const renderMode = this.renderMode ?? 0;
            return thisCamera.camera === camera && (renderMode & GSPLAT_FORWARD) !== 0 && this._mainSet._rasterizeTileListBuffer !== null;
        });
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

        this._countColorShader?.destroy();
        this._countPickShader?.destroy();
        this._countBindGroupFormat?.destroy();
        this._countPickBindGroupFormat?.destroy();
        this._scatterShader.destroy();
        this._scatterBindGroupFormat.destroy();
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
        this._rasterizeColorShader.destroy();
        this._rasterizePickShader?.destroy();
        this._rasterizeColorBindGroupFormat.destroy();

        this._projCacheBuffer?.destroy();
        this._tileEntriesBuffer?.destroy();

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
        this._minContribution = gsplat.minContribution;
        this._alphaClip = gsplat.alphaClip;
        this._exposure = exposure ?? 1.0;

        let needsRecreate = false;

        const formatHash = this.workBuffer.format.hash;
        if (formatHash !== this._formatHash) {
            needsRecreate = true;
        }

        if (needsRecreate || !this._countColorShader) {
            this._ensureCountCompute();
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
                this._tileEntryMultiplier = Math.max(INITIAL_TILE_ENTRY_MULTIPLIER, (readbackValue / numSplats) * 1.1);
                this._shrinkFrameCount = 0;
            }
        }

        if (!canResize) return;

        // Splat capacity (projCache)
        if (numSplats > this._allocatedSplatCapacity) {
            this._projCacheBuffer?.destroy();
            this._allocatedSplatCapacity = numSplats;
            this._projCacheBuffer = new StorageBuffer(device, numSplats * CACHE_STRIDE * 4);
        }

        // Entry capacity (tileEntries)
        const requiredEntryCapacity = Math.ceil(numSplats * this._tileEntryMultiplier);
        const needsGrow = requiredEntryCapacity > this._allocatedEntryCapacity;
        const needsShrink = this._allocatedEntryCapacity > 0 &&
            requiredEntryCapacity * 2 < this._allocatedEntryCapacity;
        if (needsGrow || needsShrink) {
            this._tileEntriesBuffer?.destroy();
            this._allocatedEntryCapacity = requiredEntryCapacity;
            this._tileEntriesBuffer = new StorageBuffer(device, requiredEntryCapacity * 4, BUFFERUSAGE_COPY_DST);
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

            // Create pick count compute (count shader must exist by now from frameUpdate)
            if (!this._countPickShader) {
                const { shader, bindGroupFormat } = this._createCountShaderAndFormat(true);
                this._countPickShader = shader;
                this._countPickBindGroupFormat = bindGroupFormat;
            }
            this._pickSet.countCompute = new Compute(this.device, this._countPickShader, 'GSplatPickTileCount');
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
        const numTilesX = Math.ceil(width / TILE_SIZE);
        const numTilesY = Math.ceil(height / TILE_SIZE);
        const numTiles = numTilesX * numTilesY;

        this._ensureSharedBuffers(numSplats);
        set.ensureTileBuffers(numTiles);

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

        const alphaClip = pickMode ? this._alphaClip : (1.0 / 255.0);

        // --- Pass 1: Per-tile count + projection cache ---
        set._tileSplatCountsBuffer.clear();

        set.countCompute.setParameter('compactedSplatIds', this._compactedSplatIds);
        set.countCompute.setParameter('sortElementCount', this._sortElementCountBuffer);
        set.countCompute.setParameter('projCache', this._projCacheBuffer);
        set.countCompute.setParameter('tileSplatCounts', set._tileSplatCountsBuffer);
        for (const stream of wb.format.streams) {
            set.countCompute.setParameter(stream.name, wb.getTexture(stream.name));
        }
        for (const stream of wb.format.extraStreams) {
            set.countCompute.setParameter(stream.name, wb.getTexture(stream.name));
        }
        set.countCompute.setParameter('splatTextureSize', this._textureSize);
        set.countCompute.setParameter('numTilesX', numTilesX);
        set.countCompute.setParameter('numTilesY', numTilesY);
        set.countCompute.setParameter('viewProj', _viewProjData);
        set.countCompute.setParameter('viewMatrix', _viewData);
        set.countCompute.setParameter('focal', focal);
        set.countCompute.setParameter('viewportWidth', width);
        set.countCompute.setParameter('viewportHeight', height);
        set.countCompute.setParameter('nearClip', cam.nearClip);
        set.countCompute.setParameter('farClip', cam.farClip);
        set.countCompute.setParameter('minPixelSize', this._minPixelSize * 0.5);
        set.countCompute.setParameter('isOrtho', cam.projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0);
        set.countCompute.setParameter('exposure', this._exposure);
        set.countCompute.setParameter('alphaClip', alphaClip);
        set.countCompute.setParameter('minContribution', this._minContribution);

        const countWorkgroups = Math.ceil(numSplats / COUNT_WORKGROUP_SIZE);
        Compute.calcDispatchSize(countWorkgroups, _dispatchSize);
        set.countCompute.setupDispatch(_dispatchSize.x, _dispatchSize.y, 1);
        device.computeDispatch([set.countCompute], pickMode ? 'GSplatPickTileCount' : 'GSplatLocalTileCount');

        // --- Pass 2: Prefix sum ---
        set.prefixSumKernel.resize(set._tileSplatCountsBuffer, numTiles + 1);
        set.prefixSumKernel.dispatch(device);

        // --- Pass 3: Scatter ---
        set._tileWriteCursorsBuffer.clear();

        set.scatterCompute.setParameter('projCache', this._projCacheBuffer);
        set.scatterCompute.setParameter('sortElementCount', this._sortElementCountBuffer);
        set.scatterCompute.setParameter('tileSplatCounts', set._tileSplatCountsBuffer);
        set.scatterCompute.setParameter('tileWriteCursors', set._tileWriteCursorsBuffer);
        set.scatterCompute.setParameter('tileEntries', this._tileEntriesBuffer);
        set.scatterCompute.setParameter('numTilesX', numTilesX);
        set.scatterCompute.setParameter('numTilesY', numTilesY);
        set.scatterCompute.setParameter('maxEntries', maxEntries);
        set.scatterCompute.setParameter('viewportWidth', width);
        set.scatterCompute.setParameter('viewportHeight', height);
        set.scatterCompute.setParameter('alphaClip', alphaClip);

        set.scatterCompute.setupDispatch(_dispatchSize.x, _dispatchSize.y, 1);
        device.computeDispatch([set.scatterCompute], pickMode ? 'GSplatPickScatter' : 'GSplatLocalScatter');

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
        set.bucketSortCompute.setParameter('projCache', this._projCacheBuffer);
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
        set.sortCompute.setParameter('projCache', this._projCacheBuffer);
        set.sortCompute.setParameter('smallTileList', set._smallTileListBuffer);
        set.sortCompute.setParameter('tileListCounts', set._tileListCountsBuffer);

        set.sortCompute.setupIndirectDispatch(indirectSlot);
        device.computeDispatch([set.sortCompute], pickMode ? 'GSplatPickTileSort' : 'GSplatLocalTileSort');

        // --- Pass 4c: Chunk sort ---
        set.chunkSortCompute.setParameter('tileEntries', this._tileEntriesBuffer);
        set.chunkSortCompute.setParameter('projCache', this._projCacheBuffer);
        set.chunkSortCompute.setParameter('chunkRanges', set._chunkRangesBuffer);
        set.chunkSortCompute.setParameter('totalChunks', set._totalChunksBuffer);
        set.chunkSortCompute.setParameter('maxChunks', numTiles * MAX_CHUNKS_PER_TILE);

        set.chunkSortCompute.setupIndirectDispatch(0, set._chunkSortIndirectBuffer);
        device.computeDispatch([set.chunkSortCompute], pickMode ? 'GSplatPickChunkSort' : 'GSplatLocalChunkSort');

        // --- Pass 5: Rasterize ---
        set.rasterizeCompute.setParameter('screenWidth', width);
        set.rasterizeCompute.setParameter('screenHeight', height);
        set.rasterizeCompute.setParameter('numTilesX', numTilesX);
        set.rasterizeCompute.setParameter('nearClip', cam.nearClip);
        set.rasterizeCompute.setParameter('farClip', cam.farClip);
        set.rasterizeCompute.setParameter('alphaClip', alphaClip);
        set.rasterizeCompute.setParameter('tileEntries', this._tileEntriesBuffer);
        set.rasterizeCompute.setParameter('tileSplatCounts', set._tileSplatCountsBuffer);
        set.rasterizeCompute.setParameter('projCache', this._projCacheBuffer);
        set.rasterizeCompute.setParameter('rasterizeTileList', set._rasterizeTileListBuffer);
        set.rasterizeCompute.setParameter('tileListCounts', set._tileListCountsBuffer);
        if (pickMode) {
            set.rasterizeCompute.setParameter('pickIdTexture', set.pickIdTexture);
            set.rasterizeCompute.setParameter('pickDepthTexture', set.pickDepthTexture);
        } else {
            set.rasterizeCompute.setParameter('outputTexture', set.outputTexture);
        }

        set.rasterizeCompute.setupIndirectDispatch(indirectSlot + 2);
        device.computeDispatch([set.rasterizeCompute], pickMode ? 'GSplatPickRasterize' : 'GSplatLocalRasterize');

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

        Promise.all([readback1, readback2]).then(([r1, r2]) => {
            const totalEntries = new Uint32Array(r1.buffer, r1.byteOffset, 1)[0];
            const totalOverflow = new Uint32Array(r2.buffer, r2.byteOffset, 1)[0];
            const needed = totalEntries + totalOverflow;

            if (capturedNumSplats > 0) {
                this._tileEntryMultiplier = Math.max(this._tileEntryMultiplier, (needed / capturedNumSplats) * 1.1);
                this._tileEntryMultiplier = Math.max(this._tileEntryMultiplier, INITIAL_TILE_ENTRY_MULTIPLIER);
            }

            this._lastReadbackEntryCount = needed;
        }).catch(() => {
            // readback failed, ignore
        });
    }

    /**
     * Creates or recreates the count shader, bind group format, and Compute instances
     * for all active dispatch sets. Called lazily on the first frame and whenever
     * the work buffer format changes.
     *
     * @private
     */
    _ensureCountCompute() {
        const device = this.device;

        this._mainSet.countCompute?.destroy();
        this._countColorShader?.destroy();
        this._countBindGroupFormat?.destroy();
        this._countPickShader?.destroy();
        this._countPickBindGroupFormat?.destroy();

        const { shader, bindGroupFormat } = this._createCountShaderAndFormat(false);
        this._countColorShader = shader;
        this._countBindGroupFormat = bindGroupFormat;
        this._mainSet.countCompute = new Compute(device, shader, 'GSplatLocalTileCount');

        if (this._pickSet) {
            this._pickSet.countCompute?.destroy();
            const { shader: pickShader, bindGroupFormat: pickBgf } = this._createCountShaderAndFormat(true);
            this._countPickShader = pickShader;
            this._countPickBindGroupFormat = pickBgf;
            this._pickSet.countCompute = new Compute(device, pickShader, 'GSplatPickTileCount');
        }
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

        // Count shader/format are created lazily in _ensureCountCompute()

        // --- Scatter ---
        {
            const ubf = new UniformBufferFormat(device, [
                new UniformFormat('numTilesX', UNIFORMTYPE_UINT),
                new UniformFormat('numTilesY', UNIFORMTYPE_UINT),
                new UniformFormat('maxEntries', UNIFORMTYPE_UINT),
                new UniformFormat('viewportWidth', UNIFORMTYPE_FLOAT),
                new UniformFormat('viewportHeight', UNIFORMTYPE_FLOAT),
                new UniformFormat('alphaClip', UNIFORMTYPE_FLOAT)
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
            this._scatterShader = new Shader(device, {
                name: 'GSplatLocalScatter',
                shaderLanguage: SHADERLANGUAGE_WGSL,
                cshader: computeGsplatLocalScatterSource,
                cincludes,
                computeBindGroupFormat: this._scatterBindGroupFormat,
                computeUniformBufferFormats: { uniforms: ubf }
            });
        }

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
            new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE, true),
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
                new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE, true),
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
                new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE, true),
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

        // --- Rasterize (color) ---
        const { shader: rasterizeColorShader, bindGroupFormat: rasterizeColorBGF } = this._createRasterizeShaderAndFormat(false);
        this._rasterizeColorShader = rasterizeColorShader;
        this._rasterizeColorBindGroupFormat = rasterizeColorBGF;
    }

    /**
     * Creates the count shader + shared bind group format.
     *
     * @param {boolean} pickMode - Whether to create the pick variant.
     * @returns {{ shader: Shader, bindGroupFormat: BindGroupFormat }} The shader and format.
     * @private
     */
    _createCountShaderAndFormat(pickMode) {
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
            new UniformFormat('exposure', UNIFORMTYPE_FLOAT),
            new UniformFormat('alphaClip', UNIFORMTYPE_FLOAT),
            new UniformFormat('minContribution', UNIFORMTYPE_FLOAT)
        ]);

        const wbFormat = this.workBuffer.format;

        const fixedBindings = [
            new BindStorageBufferFormat('compactedSplatIds', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('sortElementCount', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('tileSplatCounts', SHADERSTAGE_COMPUTE),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
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
        if (pickMode) {
            cdefines.set('PICK_MODE', '');
        }
        const colorStream = wbFormat.getStream('dataColor');
        if (colorStream && colorStream.format !== PIXELFORMAT_RGBA16U) {
            cdefines.set('GSPLAT_COLOR_FLOAT', '');
        }

        const shader = new Shader(device, {
            name: pickMode ? 'GSplatLocalTileCountPick' : 'GSplatLocalTileCount',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatLocalTileCountSource,
            cincludes,
            cdefines,
            computeBindGroupFormat: bindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });

        this._formatHash = this.workBuffer.format.hash;
        return { shader, bindGroupFormat };
    }

    /**
     * Creates the rasterize shader + bind group format.
     *
     * @param {boolean} pickMode - Whether to create the pick variant.
     * @returns {{ shader: Shader, bindGroupFormat: BindGroupFormat }} The shader and format.
     * @private
     */
    _createRasterizeShaderAndFormat(pickMode) {
        const device = this.device;

        const ubf = new UniformBufferFormat(device, [
            new UniformFormat('screenWidth', UNIFORMTYPE_UINT),
            new UniformFormat('screenHeight', UNIFORMTYPE_UINT),
            new UniformFormat('numTilesX', UNIFORMTYPE_UINT),
            new UniformFormat('nearClip', UNIFORMTYPE_FLOAT),
            new UniformFormat('farClip', UNIFORMTYPE_FLOAT),
            new UniformFormat('alphaClip', UNIFORMTYPE_FLOAT)
        ]);

        const sharedBindings = [
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('tileEntries', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('tileSplatCounts', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('rasterizeTileList', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('tileListCounts', SHADERSTAGE_COMPUTE, true)
        ];

        const outputBindings = pickMode ? [
            new BindStorageTextureFormat('pickIdTexture', PIXELFORMAT_R32U),
            new BindStorageTextureFormat('pickDepthTexture', PIXELFORMAT_RGBA16F)
        ] : [
            new BindStorageTextureFormat('outputTexture', PIXELFORMAT_RGBA16F)
        ];

        const bgf = new BindGroupFormat(device, [...sharedBindings, ...outputBindings]);

        const cdefines = pickMode ? new Map([['PICK_MODE', '']]) : undefined;
        const cincludes = pickMode ? undefined : new Map([['decodePS', shaderChunksWGSL.decodePS]]);

        const shader = new Shader(device, {
            name: pickMode ? 'GSplatLocalRasterizePick' : 'GSplatLocalRasterize',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatLocalRasterizeSource,
            cdefines,
            cincludes,
            computeBindGroupFormat: bgf,
            computeUniformBufferFormats: { uniforms: ubf }
        });

        return { shader, bindGroupFormat: bgf };
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

        // Count compute is created lazily by _ensureCountCompute()

        // Scatter: shared shader
        set.scatterCompute = new Compute(device, this._scatterShader, pickMode ? 'GSplatPickScatter' : 'GSplatLocalScatter');

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

        // Rasterize: mode-specific shader and BGF
        if (pickMode) {
            if (!this._rasterizePickShader) {
                const { shader, bindGroupFormat } = this._createRasterizeShaderAndFormat(true);
                this._rasterizePickShader = shader;
                set.rasterizeBindGroupFormat = bindGroupFormat;
            }
            set.rasterizeCompute = new Compute(device, this._rasterizePickShader, 'GSplatPickRasterize');
        } else {
            set.rasterizeCompute = new Compute(device, this._rasterizeColorShader, 'GSplatLocalRasterize');
        }

        return set;
    }
}

export { GSplatComputeLocalRenderer };
