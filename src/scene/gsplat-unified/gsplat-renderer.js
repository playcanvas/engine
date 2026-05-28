import gsplatOutputVS from '../shader-lib/wgsl/chunks/gsplat/vert/gsplatOutput.js';
import { shaderChunksWGSL } from '../shader-lib/wgsl/collections/shader-chunks-wgsl.js';
import { FisheyeProjection } from '../graphics/fisheye-projection.js';

/**
 * @import { StorageBuffer } from '../../platform/graphics/storage-buffer.js'
 * @import { ShaderMaterial } from '../materials/shader-material.js'
 * @import { Layer } from '../layer.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
 * @import { FogParams } from '../fog-params.js'
 */

/**
 * Base class for splat renderers. Holds common state shared by all renderer
 * implementations (instanced-quad, compute-based, etc.). Derived classes
 * implement the actual rendering strategy.
 *
 * @ignore
 */
class GSplatRenderer {
    /** @type {GraphicsDevice} */
    device;

    /** @type {GraphNode} */
    node;

    /** @type {GraphNode} */
    cameraNode;

    /** @type {Layer} */
    layer;

    /** @type {GSplatWorkBuffer} */
    workBuffer;

    /** @type {number|undefined} */
    renderMode;

    /**
     * Cached work buffer format version for detecting extra stream changes.
     *
     * @protected
     */
    _workBufferFormatVersion = -1;

    /**
     * Fisheye projection helper shared by all renderer paths.
     * The manager calls update() during culling; renderers read the computed values
     * when binding uniforms.
     *
     * @type {FisheyeProjection}
     * @ignore
     */
    fisheyeProj = new FisheyeProjection();

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GraphNode} node - The graph node.
     * @param {GraphNode} cameraNode - The camera node.
     * @param {Layer} layer - The layer to add mesh instances to.
     * @param {GSplatWorkBuffer} workBuffer - The work buffer containing splat data.
     */
    constructor(device, node, cameraNode, layer, workBuffer) {
        this.device = device;
        this.node = node;
        this.cameraNode = cameraNode;
        this.layer = layer;
        this.workBuffer = workBuffer;
        this._workBufferFormatVersion = workBuffer?.format.extraStreamsVersion ?? -1;
    }

    destroy() {
    }

    /**
     * Sets the render mode for this renderer.
     *
     * @param {number} renderMode - Bitmask flags controlling render passes (GSPLAT_FORWARD, GSPLAT_SHADOW, or both).
     */
    setRenderMode(renderMode) {
        this.renderMode = renderMode;
    }

    /**
     * Returns the material used by this renderer, or null if not applicable.
     *
     * @type {ShaderMaterial|null}
     */
    get material() {
        return null;
    }

    /**
     * Sets the data source providing format and texture access. The base implementation updates
     * the workBuffer and notifies derived classes of the format change. Derived classes (e.g.
     * the compute renderer) may override this to decouple from the work buffer entirely.
     *
     * The source object must provide:
     * - `format` — a {@link GSplatFormat} describing the texture streams and shader read code.
     * - `getTexture(name)` — a function returning a {@link Texture} for a given stream name.
     *
     * @param {object} source - The data source (typically a {@link GSplatWorkBuffer}).
     */
    setDataSource(source) {
        this.workBuffer = source;
        this.onWorkBufferFormatChanged();
    }

    /**
     * Called when the work buffer format has changed. Derived classes reconfigure
     * their rendering resources (materials, pipelines, bindings, etc.).
     */
    onWorkBufferFormatChanged() {
    }

    /**
     * Updates the renderer with the current splat count and texture size.
     *
     * @param {number} count - The number of visible splats.
     * @param {number} textureSize - The work buffer texture size.
     */
    update(count, textureSize) {
    }

    /**
     * Configures the renderer to use GPU-sorted data for rendering.
     *
     * @param {number} drawSlot - The indirect draw slot index.
     * @param {StorageBuffer} sortedIds - Buffer containing sorted visible splat IDs.
     * @param {StorageBuffer} numSplatsBuffer - Buffer containing the visible splat count.
     * @param {number} textureSize - The work buffer texture size.
     */
    setGpuSortedRendering(drawSlot, sortedIds, numSplatsBuffer, textureSize) {
    }

    /**
     * Switches the renderer to CPU-sorted rendering mode.
     */
    setCpuSortedRendering() {
    }

    /**
     * Binds the current order data (texture or storage buffer) for CPU-sorted rendering.
     */
    setOrderData() {
    }

    /**
     * Per-frame update for the renderer (material syncing, parameter updates).
     *
     * @param {object} params - The gsplat parameters.
     * @param {number} [exposure] - Scene exposure value.
     * @param {FogParams} [fogParams] - Fog parameters.
     */
    frameUpdate(params, exposure, fogParams) {
    }

    /**
     * Updates the overdraw visualization mode.
     *
     * @param {object} params - The gsplat parameters.
     */
    updateOverdrawMode(params) {
    }

    /**
     * Populates a cincludes map with tonemapping, gamma, decode and gsplatOutput
     * shader chunks needed by compute tile-count shaders.
     *
     * @param {Map<string, string>} cincludes - The shader includes map to populate.
     * @protected
     */
    _createTonemapIncludes(cincludes) {
        cincludes.set('gsplatOutputVS', gsplatOutputVS);
        const chunkNames = [
            'tonemappingPS', 'tonemappingNonePS', 'tonemappingLinearPS', 'tonemappingFilmicPS',
            'tonemappingHejlPS', 'tonemappingAcesPS', 'tonemappingAces2PS', 'tonemappingNeutralPS',
            'decodePS', 'gammaPS'
        ];
        for (const name of chunkNames) {
            cincludes.set(name, shaderChunksWGSL[name]);
        }
    }
}

export { GSplatRenderer };
