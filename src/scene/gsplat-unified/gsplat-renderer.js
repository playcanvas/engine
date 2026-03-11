/**
 * @import { StorageBuffer } from '../../platform/graphics/storage-buffer.js'
 * @import { ShaderMaterial } from '../materials/shader-material.js'
 * @import { Layer } from '../layer.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
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
     * @type {number}
     * @protected
     */
    _workBufferFormatVersion = -1;

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
        this._workBufferFormatVersion = workBuffer.format.extraStreamsVersion;
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
     * Configures the renderer's material after a work buffer format change.
     */
    configureMaterial() {
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
     * Updates the renderer for indirect (GPU-driven) draw mode.
     *
     * @param {number} textureSize - The work buffer texture size.
     */
    updateIndirect(textureSize) {
    }

    /**
     * Configures indirect draw and binds compaction buffers.
     *
     * @param {number} drawSlot - The indirect draw slot index.
     * @param {StorageBuffer} compactedSplatIds - Buffer containing sorted visible splat IDs.
     * @param {StorageBuffer} numSplatsBuffer - Buffer containing the visible splat count.
     */
    setIndirectDraw(drawSlot, compactedSplatIds, numSplatsBuffer) {
    }

    /**
     * Disables indirect draw, restoring the renderer to direct (CPU-sorted) mode.
     */
    disableIndirectDraw() {
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
     */
    frameUpdate(params) {
    }

    /**
     * Updates the overdraw visualization mode.
     *
     * @param {object} params - The gsplat parameters.
     */
    updateOverdrawMode(params) {
    }

    destroy() {
    }
}

export { GSplatRenderer };
