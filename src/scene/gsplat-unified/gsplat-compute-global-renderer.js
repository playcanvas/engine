import { Vec2 } from '../../core/math/vec2.js';
import { Compute } from '../../platform/graphics/compute.js';
import { Shader } from '../../platform/graphics/shader.js';
import { Texture } from '../../platform/graphics/texture.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { BindGroupFormat, BindStorageBufferFormat, BindStorageTextureFormat, BindTextureFormat, BindUniformBufferFormat } from '../../platform/graphics/bind-group-format.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import {
    CULLFACE_NONE,
    FILTER_NEAREST,
    PIXELFORMAT_RGBA8,
    SAMPLETYPE_UINT,
    SEMANTIC_POSITION,
    SHADERLANGUAGE_WGSL,
    SHADERSTAGE_COMPUTE,
    BUFFERUSAGE_COPY_DST,
    UNIFORMTYPE_FLOAT,
    UNIFORMTYPE_MAT4,
    UNIFORMTYPE_UINT
} from '../../platform/graphics/constants.js';
import { BLEND_PREMULTIPLIED, GSPLAT_FORWARD } from '../constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { MeshInstance } from '../mesh-instance.js';
import { Mesh } from '../mesh.js';
import { Mat4 } from '../../core/math/mat4.js';
import { GSplatRenderer } from './gsplat-renderer.js';
import { FramePassGSplatComputeGlobal } from './frame-pass-gsplat-compute-global.js';
import { PrefixSumKernel } from '../graphics/prefix-sum-kernel.js';
import { ComputeRadixSort, RADIX_SORT_ELEMENTS_PER_WORKGROUP } from '../graphics/compute-radix-sort.js';
import { computeGsplatTileRasterizeSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-tile-rasterize.js';
import { computeGsplatTileCountSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-tile-count.js';
import { computeGsplatTileExpandSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-tile-expand.js';
import { computeGsplatTilePrepareSortSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-tile-prepare-sort.js';
import { computeGsplatCommonSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-common.js';
import { computeGsplatTileIntersectSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-tile-intersect.js';
import { computeGsplatTileRangesSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-tile-ranges.js';

/**
 * @import { GraphNode } from '../graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Layer } from '../layer.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
 */

const TILE_SIZE = 16;
// Multiplier for entry buffer allocation: maxEntries = numSplats * TILE_OVERLAP_FACTOR.
// Must be large enough to cover the average number of tiles each splat overlaps; if too low,
// distant/large splats that span many tiles will be silently dropped.
const TILE_OVERLAP_FACTOR = 4;
const COUNT_WORKGROUP_SIZE = 256;
const SORT_ELEMENTS_PER_WORKGROUP = RADIX_SORT_ELEMENTS_PER_WORKGROUP;
const _viewProjMat = new Mat4();
const _viewProjData = new Float32Array(16);
const _viewData = new Float32Array(16);
const _dispatchSize = new Vec2();

/**
 * Renders splats using a WebGPU compute shader pipeline with globally sorted per-tile splat
 * distribution. Takes depth-sorted splats as input, bins them into screen-space tiles and
 * radix-sorts by tile ID so that each tile receives a contiguous, depth-ordered span of entries.
 * The pipeline consists of 7 compute passes:
 *
 *   1. Tile count: each splat is projected, culled, and its overlapping tile count written to
 *      a per-splat count buffer. A projection cache (screen position, 2D covariance, color) is
 *      stored for later passes.
 *   2. Prefix sum: an exclusive prefix sum over per-splat tile counts produces output offsets
 *      and the total entry count.
 *   3. Expand: each splat reads its offset range and emits (tileKey, splatId) pairs into flat
 *      arrays — one entry per overlapping tile.
 *   4. Prepare sort: reads the total entry count from the prefix sum, writes indirect dispatch
 *      arguments and clamps to the allocated buffer capacity.
 *   5. Radix sort: a GPU radix sort over tile keys, carrying splat IDs as values, producing
 *      globally sorted (key, value) arrays grouped by tile.
 *   6. Tile ranges: binary search over sorted keys to find (start, end) entry indices for each
 *      tile.
 *   7. Rasterize: one workgroup per tile iterates its entry range, evaluates each Gaussian from
 *      the projection cache, and blends front-to-back into an output texture using premultiplied
 *      alpha. Threads exit early once their pixel's transmittance drops below a threshold.
 *
 * The result is composited into the scene via a full-screen quad with premultiplied blending.
 *
 * @ignore
 */
class GSplatComputeGlobalRenderer extends GSplatRenderer {
    /** @type {Texture} */
    outputTexture;

    /** @type {Compute} */
    countCompute;

    /** @type {Compute} */
    expandCompute;

    /** @type {Compute} */
    prepareSortCompute;

    /** @type {Compute} */
    rasterizeCompute;

    /** @type {Compute} */
    tileRangesCompute;

    /** @type {PrefixSumKernel} */
    prefixSumKernel;

    /** @type {ComputeRadixSort} */
    radixSort;

    /** @type {FramePassGSplatComputeGlobal} */
    framePass;

    /** @type {ShaderMaterial} */
    _material;

    /** @type {MeshInstance} */
    meshInstance;

    /** @type {boolean} */
    _needsFramePassRegister = false;

    /** @type {number} */
    _numSplats = 0;

    /** @type {number} */
    _textureSize = 0;

    /** @type {number} */
    _minPixelSize = 2.0;

    /** @type {StorageBuffer|null} Per-splat tile counts (numSplats + 1 elements) */
    _splatTileCountsBuffer = null;

    /** @type {StorageBuffer|null} Tile keys for sorting (maxEntries elements) */
    _tileKeysBuffer = null;

    /** @type {StorageBuffer|null} Splat IDs for sorting (maxEntries elements) */
    _tileSplatIdsBuffer = null;

    /** @type {StorageBuffer|null} Single u32: actual number of entries from prefix sum */
    _sortElementCountBuffer = null;

    /** @type {StorageBuffer|null} Projection cache: 7 u32 per splat (screen, cov2d, f16x4 color+alpha) */
    _projCacheBuffer = null;

    /** @type {StorageBuffer|null} Per-tile (start, end) range pairs: 2 u32 per tile */
    _tileRangesBuffer = null;

    /** @type {number} */
    _allocatedSplatCapacity = 0;

    /** @type {number} */
    _allocatedMaxEntries = 0;

    /** @type {number} */
    _allocatedTileCapacity = 0;

    /** @type {BindGroupFormat} */
    _countBindGroupFormat;

    /** @type {BindGroupFormat} */
    _expandBindGroupFormat;

    /** @type {BindGroupFormat} */
    _prepareSortBindGroupFormat;

    /** @type {BindGroupFormat} */
    _tileRangesBindGroupFormat;

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
            name: 'GSplatComputeOutput',
            width: 4,
            height: 4,
            format: PIXELFORMAT_RGBA8,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            storage: true
        });

        this.prefixSumKernel = new PrefixSumKernel(device);
        this.radixSort = new ComputeRadixSort(device);

        this._sortElementCountBuffer = new StorageBuffer(device, 4, BUFFERUSAGE_COPY_DST);

        this._createCountCompute();
        this._createExpandCompute();
        this._createPrepareSortCompute();
        this._createTileRangesCompute();
        this._createRasterizeCompute();
        this.framePass = new FramePassGSplatComputeGlobal(this);
        this._createCompositeMaterial();
        this.meshInstance = this._createMeshInstance();
    }

    destroy() {
        this._unregisterFramePass();

        if (this.renderMode) {
            if (this.renderMode & GSPLAT_FORWARD) {
                this.layer.removeMeshInstances([this.meshInstance], true);
            }
        }

        this.countCompute.shader.destroy();
        this._countBindGroupFormat.destroy();
        this.expandCompute.shader.destroy();
        this._expandBindGroupFormat.destroy();
        this.prepareSortCompute.shader.destroy();
        this._prepareSortBindGroupFormat.destroy();
        this.tileRangesCompute.shader.destroy();
        this._tileRangesBindGroupFormat.destroy();
        this.rasterizeCompute.shader.destroy();
        this._rasterizeBindGroupFormat.destroy();
        this.prefixSumKernel.destroy();
        this.radixSort.destroy();

        this._splatTileCountsBuffer?.destroy();
        this._projCacheBuffer?.destroy();
        this._tileKeysBuffer?.destroy();
        this._tileSplatIdsBuffer?.destroy();
        this._sortElementCountBuffer?.destroy();
        this._tileRangesBuffer?.destroy();

        this.outputTexture.destroy();
        this._material.destroy();
        this.meshInstance.destroy();

        super.destroy();
    }

    get material() {
        return this._material;
    }

    setRenderMode(renderMode) {
        const oldRenderMode = this.renderMode ?? 0;
        const wasForward = (oldRenderMode & GSPLAT_FORWARD) !== 0;
        const isForward = (renderMode & GSPLAT_FORWARD) !== 0;

        if (!wasForward && isForward) {
            this.layer.addMeshInstances([this.meshInstance], true);
            this._registerFramePass();
        }

        if (wasForward && !isForward) {
            this.layer.removeMeshInstances([this.meshInstance], true);
            this._unregisterFramePass();
        }

        super.setRenderMode(renderMode);
    }

    frameUpdate(gsplat) {
        if (this._needsFramePassRegister) {
            this._registerFramePass();
        }
        this._minPixelSize = gsplat.minPixelSize;
    }

    update(count, textureSize) {
        this._numSplats = count;
        this._textureSize = textureSize;
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
     * Ensure buffers are large enough for the current splat count.
     *
     * @param {number} numSplats - Total number of splats.
     * @private
     */
    _ensureBuffers(numSplats) {
        const CACHE_STRIDE = 7;
        const requiredSplatSlots = numSplats + 1;
        if (requiredSplatSlots > this._allocatedSplatCapacity) {
            this._splatTileCountsBuffer?.destroy();
            this._projCacheBuffer?.destroy();
            this._allocatedSplatCapacity = requiredSplatSlots;
            this._splatTileCountsBuffer = new StorageBuffer(this.device, requiredSplatSlots * 4, BUFFERUSAGE_COPY_DST);
            this._projCacheBuffer = new StorageBuffer(this.device, numSplats * CACHE_STRIDE * 4);
            this.prefixSumKernel.destroyPasses();
        }

        const requiredMaxEntries = numSplats * TILE_OVERLAP_FACTOR;
        if (requiredMaxEntries > this._allocatedMaxEntries) {
            this._tileKeysBuffer?.destroy();
            this._tileSplatIdsBuffer?.destroy();
            this._allocatedMaxEntries = requiredMaxEntries;
            this._tileKeysBuffer = new StorageBuffer(this.device, requiredMaxEntries * 4);
            this._tileSplatIdsBuffer = new StorageBuffer(this.device, requiredMaxEntries * 4);
        }
    }

    dispatch() {
        const width = this.outputTexture.width;
        const height = this.outputTexture.height;
        const numSplats = this._numSplats ?? 0;

        if (numSplats === 0) return;

        const numTilesX = Math.ceil(width / TILE_SIZE);
        const numTilesY = Math.ceil(height / TILE_SIZE);
        const numTiles = numTilesX * numTilesY;
        const maxEntries = numSplats * TILE_OVERLAP_FACTOR;

        this._ensureBuffers(numSplats);

        if (numTiles > this._allocatedTileCapacity) {
            this._tileRangesBuffer?.destroy();
            this._allocatedTileCapacity = numTiles;
            this._tileRangesBuffer = new StorageBuffer(this.device, numTiles * 2 * 4);
        }

        const wb = this.workBuffer;
        const camera = this.cameraNode.camera;
        const cam = camera.camera;

        const view = cam.viewMatrix;
        const proj = cam.projectionMatrix;
        _viewProjMat.mul2(proj, view);
        _viewProjData.set(_viewProjMat.data);
        _viewData.set(view.data);
        const focal = width * proj.data[0] * 0.5;

        // Number of bits needed to represent tile IDs
        const numSortBits = Math.max(4, Math.ceil(Math.log2(Math.max(1, numTiles)) / 4) * 4);

        // --- Pass 1: Per-splat tile count + projection cache write ---
        this._splatTileCountsBuffer.clear();

        this.countCompute.setParameter('splatOrder', wb.orderBuffer);
        this.countCompute.setParameter('dataTransformA', wb.getTexture('dataTransformA'));
        this.countCompute.setParameter('dataTransformB', wb.getTexture('dataTransformB'));
        this.countCompute.setParameter('dataColor', wb.getTexture('dataColor'));
        this.countCompute.setParameter('splatTileCounts', this._splatTileCountsBuffer);
        this.countCompute.setParameter('projCache', this._projCacheBuffer);
        this.countCompute.setParameter('numSplats', numSplats);
        this.countCompute.setParameter('splatTextureSize', this._textureSize ?? 0);
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

        const countWorkgroups = Math.ceil(numSplats / COUNT_WORKGROUP_SIZE);
        Compute.calcDispatchSize(countWorkgroups, _dispatchSize);
        this.countCompute.setupDispatch(_dispatchSize.x, _dispatchSize.y, 1);
        this.device.computeDispatch([this.countCompute], 'GSplatTileCount');

        // --- Pass 2: Prefix sum over per-splat counts ---
        this.prefixSumKernel.resize(this._splatTileCountsBuffer, numSplats + 1);
        this.prefixSumKernel.dispatch(this.device);

        // --- Pass 3: Deterministic key+value expansion from projection cache ---
        this.expandCompute.setParameter('splatOffsets', this._splatTileCountsBuffer);
        this.expandCompute.setParameter('projCache', this._projCacheBuffer);
        this.expandCompute.setParameter('tileKeys', this._tileKeysBuffer);
        this.expandCompute.setParameter('tileSplatIds', this._tileSplatIdsBuffer);
        this.expandCompute.setParameter('numSplats', numSplats);
        this.expandCompute.setParameter('numTilesX', numTilesX);
        this.expandCompute.setParameter('numTilesY', numTilesY);
        this.expandCompute.setParameter('maxEntries', maxEntries);
        this.expandCompute.setParameter('viewportWidth', width);
        this.expandCompute.setParameter('viewportHeight', height);

        this.expandCompute.setupDispatch(_dispatchSize.x, _dispatchSize.y, 1);
        this.device.computeDispatch([this.expandCompute], 'GSplatTileExpand');

        // --- Pass 4: Prepare indirect sort dispatch args ---
        const indirectDispatchSlot = this.device.getIndirectDispatchSlot(1);
        const maxWorkgroupsPerDim = this.device.limits.maxComputeWorkgroupsPerDimension || 65535;

        this.prepareSortCompute.setParameter('splatTileCounts', this._splatTileCountsBuffer);
        this.prepareSortCompute.setParameter('indirectDispatchArgs', this.device.indirectDispatchBuffer);
        this.prepareSortCompute.setParameter('sortElementCountBuf', this._sortElementCountBuffer);
        this.prepareSortCompute.setParameter('numSplats', numSplats);
        this.prepareSortCompute.setParameter('dispatchSlotOffset', indirectDispatchSlot * 3);
        this.prepareSortCompute.setParameter('maxWorkgroupsPerDim', maxWorkgroupsPerDim);
        this.prepareSortCompute.setParameter('sortThreadsPerWorkgroup', SORT_ELEMENTS_PER_WORKGROUP);
        this.prepareSortCompute.setParameter('maxEntries', maxEntries);

        this.prepareSortCompute.setupDispatch(1);
        this.device.computeDispatch([this.prepareSortCompute], 'GSplatTilePrepareSortArgs');

        // --- Pass 5: Stable radix sort by tile ID ---
        this.radixSort.sortIndirect(
            this._tileKeysBuffer,
            maxEntries,
            numSortBits,
            indirectDispatchSlot,
            this._sortElementCountBuffer,
            this._tileSplatIdsBuffer
        );

        // --- Pass 6: Extract per-tile ranges via binary search ---
        const sortedKeys = this.radixSort.sortedKeys;
        const sortedValues = this.radixSort.sortedIndices;

        this.tileRangesCompute.setParameter('sortedKeys', sortedKeys);
        this.tileRangesCompute.setParameter('sortedEntryCount', this._sortElementCountBuffer);
        this.tileRangesCompute.setParameter('tileRanges', this._tileRangesBuffer);
        this.tileRangesCompute.setParameter('numTiles', numTiles);

        const rangeWorkgroups = Math.ceil(numTiles / 256);
        this.tileRangesCompute.setupDispatch(rangeWorkgroups);
        this.device.computeDispatch([this.tileRangesCompute], 'GSplatTileRanges');

        // --- Pass 7: Tile rasterize using precomputed ranges ---
        this.rasterizeCompute.setParameter('outputTexture', this.outputTexture);
        this.rasterizeCompute.setParameter('sortedValues', sortedValues);
        this.rasterizeCompute.setParameter('tileRanges', this._tileRangesBuffer);
        this.rasterizeCompute.setParameter('projCache', this._projCacheBuffer);
        this.rasterizeCompute.setParameter('screenWidth', width);
        this.rasterizeCompute.setParameter('screenHeight', height);
        this.rasterizeCompute.setParameter('numTilesX', numTilesX);

        this.rasterizeCompute.setupDispatch(numTilesX, numTilesY, 1);
        this.device.computeDispatch([this.rasterizeCompute], 'GSplatTileRasterize');
    }

    /** @private */
    _createCommonIncludes() {
        const cincludes = new Map();
        cincludes.set('gsplatCommonCS', computeGsplatCommonSource);
        cincludes.set('gsplatTileIntersectCS', computeGsplatTileIntersectSource);
        return cincludes;
    }

    /** @private */
    _createCountCompute() {
        const device = this.device;

        const uniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('numSplats', UNIFORMTYPE_UINT),
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
            new UniformFormat('minPixelSize', UNIFORMTYPE_FLOAT)
        ]);

        this._countBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('splatOrder', SHADERSTAGE_COMPUTE, true),
            new BindTextureFormat('dataTransformA', SHADERSTAGE_COMPUTE, undefined, SAMPLETYPE_UINT, false),
            new BindTextureFormat('dataTransformB', SHADERSTAGE_COMPUTE, undefined, SAMPLETYPE_UINT, false),
            new BindTextureFormat('dataColor', SHADERSTAGE_COMPUTE, undefined, SAMPLETYPE_UINT, false),
            new BindStorageBufferFormat('splatTileCounts', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ]);

        const shader = new Shader(device, {
            name: 'GSplatTileCount',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatTileCountSource,
            cincludes: this._createCommonIncludes(),
            computeBindGroupFormat: this._countBindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });

        this.countCompute = new Compute(device, shader, 'GSplatTileCount');
    }

    /** @private */
    _createExpandCompute() {
        const device = this.device;

        const uniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('numSplats', UNIFORMTYPE_UINT),
            new UniformFormat('numTilesX', UNIFORMTYPE_UINT),
            new UniformFormat('numTilesY', UNIFORMTYPE_UINT),
            new UniformFormat('maxEntries', UNIFORMTYPE_UINT),
            new UniformFormat('viewportWidth', UNIFORMTYPE_FLOAT),
            new UniformFormat('viewportHeight', UNIFORMTYPE_FLOAT)
        ]);

        this._expandBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('splatOffsets', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('tileKeys', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('tileSplatIds', SHADERSTAGE_COMPUTE),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ]);

        const shader = new Shader(device, {
            name: 'GSplatTileExpand',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatTileExpandSource,
            cincludes: this._createCommonIncludes(),
            computeBindGroupFormat: this._expandBindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });

        this.expandCompute = new Compute(device, shader, 'GSplatTileExpand');
    }

    /** @private */
    _createPrepareSortCompute() {
        const device = this.device;

        const uniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('numSplats', UNIFORMTYPE_UINT),
            new UniformFormat('dispatchSlotOffset', UNIFORMTYPE_UINT),
            new UniformFormat('maxWorkgroupsPerDim', UNIFORMTYPE_UINT),
            new UniformFormat('sortThreadsPerWorkgroup', UNIFORMTYPE_UINT),
            new UniformFormat('maxEntries', UNIFORMTYPE_UINT)
        ]);

        this._prepareSortBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('splatTileCounts', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('indirectDispatchArgs', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('sortElementCountBuf', SHADERSTAGE_COMPUTE),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ]);

        const shader = new Shader(device, {
            name: 'GSplatTilePrepareSortArgs',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatTilePrepareSortSource,
            computeBindGroupFormat: this._prepareSortBindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });

        this.prepareSortCompute = new Compute(device, shader, 'GSplatTilePrepareSortArgs');
    }

    /** @private */
    _createTileRangesCompute() {
        const device = this.device;

        const uniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('numTiles', UNIFORMTYPE_UINT)
        ]);

        this._tileRangesBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('sortedKeys', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('sortedEntryCount', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('tileRanges', SHADERSTAGE_COMPUTE),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ]);

        const shader = new Shader(device, {
            name: 'GSplatTileRanges',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatTileRangesSource,
            computeBindGroupFormat: this._tileRangesBindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });

        this.tileRangesCompute = new Compute(device, shader, 'GSplatTileRanges');
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
            new BindStorageBufferFormat('sortedValues', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('tileRanges', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE, true),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ]);

        const shader = new Shader(device, {
            name: 'GSplatTileRasterize',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatTileRasterizeSource,
            computeBindGroupFormat: this._rasterizeBindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });

        this.rasterizeCompute = new Compute(device, shader, 'GSplatTileRasterize');
    }

    /** @private */
    _createCompositeMaterial() {
        this._material = new ShaderMaterial({
            uniqueName: 'GSplatComputeComposite',
            vertexGLSL: '#include "fullscreenQuadVS"',
            fragmentGLSL: '#include "outputTex2DPS"',
            vertexWGSL: '#include "fullscreenQuadVS"',
            fragmentWGSL: '#include "outputTex2DPS"',
            attributes: {
                vertex_position: SEMANTIC_POSITION
            }
        });

        this._material.setParameter('source', this.outputTexture);
        this._material.blendType = BLEND_PREMULTIPLIED;
        this._material.cull = CULLFACE_NONE;
        this._material.depthWrite = false;
        this._material.update();
    }

    /**
     * @returns {MeshInstance} The compositing mesh instance.
     * @private
     */
    _createMeshInstance() {
        const mesh = new Mesh(this.device);
        mesh.setPositions(new Float32Array([
            -1, -1,
            1, -1,
            1, 1,
            -1, 1
        ]), 2);
        mesh.setIndices(new Uint32Array([0, 1, 2, 0, 2, 3]));
        mesh.update();

        const meshInstance = new MeshInstance(mesh, this._material);
        meshInstance.node = this.node;

        const thisCamera = this.cameraNode.camera;
        meshInstance.isVisibleFunc = (camera) => {
            const renderMode = this.renderMode ?? 0;
            if (thisCamera.camera === camera && (renderMode & GSPLAT_FORWARD)) {
                return true;
            }
            return false;
        };

        return meshInstance;
    }
}

export { GSplatComputeGlobalRenderer };
