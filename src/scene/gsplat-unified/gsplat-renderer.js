import { Debug } from '../../core/debug.js';
import { FisheyeProjection } from '../graphics/fisheye-projection.js';

/**
 * @import { StorageBuffer } from '../../platform/graphics/storage-buffer.js'
 * @import { ShaderMaterial } from '../materials/shader-material.js'
 * @import { Layer } from '../layer.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
 * @import { GSplatWorld } from './gsplat-world.js'
 * @import { GSplatWorldState } from './gsplat-world-state.js'
 * @import { GSplatVaryings } from './gsplat-varyings.js'
 * @import { MeshInstance } from '../mesh-instance.js'
 * @import { FogParams } from '../fog-params.js'
 */

/**
 * Per-call parameters for a renderer view (forward or pick), populated by the manager each frame
 * from the scene gsplat settings plus the view camera (and pick viewport). Reused per call to avoid
 * per-frame allocation; the renderer must not retain a reference to it.
 *
 * @typedef {object} GSplatRenderViewParams
 * @ignore
 * @property {GraphNode} cameraNode - The camera node for this view.
 * @property {boolean} radialSorting - Whether radial (vs linear) depth sorting is used.
 * @property {number} alphaClip - Alpha threshold for shadow/pick/prepass rendering.
 * @property {number} alphaClipForward - Alpha floor for the forward pass.
 * @property {number} minPixelSize - Minimum projected splat size.
 * @property {number} minContribution - Minimum visual contribution threshold.
 * @property {number} foveationStrength - Foveation strength.
 * @property {number} foveationCenter - Foveation center.
 * @property {boolean} antiAlias - Whether antialiasing is enabled.
 * @property {number} fisheye - Fisheye projection strength.
 * @property {ShaderMaterial} material - The scene gsplat template material.
 * @property {GSplatVaryings} varyings - User varying streams (provides the cache `words` count).
 * @property {number} [width] - Pick viewport width in pixels (picking only).
 * @property {number} [height] - Pick viewport height in pixels (picking only).
 */

/**
 * Base class for splat renderers. Holds common state shared by all renderer
 * implementations (instanced-quad, hybrid GPU-sort, etc.). Derived classes
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
     * Resolves the effective fisheye strength for this renderer's camera. Fisheye is not supported
     * in XR by any renderer (it overrides the per-eye perspective projection), so it is forced off
     * while an XR session is active. Warns once when a non-zero value is suppressed.
     *
     * @param {number} fisheye - Requested fisheye strength (typically `scene.gsplat.fisheye`).
     * @returns {number} The fisheye strength to use (0 while in XR, otherwise `fisheye`).
     */
    resolveFisheye(fisheye) {
        const xrActive = !!this.cameraNode.camera?.camera?.xrActive;
        if (xrActive && fisheye > 0) {
            Debug.warnOnce('GSplat: fisheye projection is not supported in XR; disabling it.');
            return 0;
        }
        return fisheye;
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
     * Whether this renderer runs the GPU sort/projection/cull pipeline itself (true) rather than
     * relying on the manager's CPU worker sorter (false). Drives the manager's per-frame branching.
     *
     * @type {boolean}
     */
    get usesGpuSort() {
        return false;
    }

    /**
     * Whether this renderer needs frustum-culling bounds uploaded to the work buffer (the GPU cull
     * path allocates them; the CPU path does not).
     *
     * @type {boolean}
     */
    get requiresBounds() {
        return false;
    }

    /**
     * Whether this renderer relies on the manager-owned CPU worker sorter.
     *
     * @type {boolean}
     */
    get requiresCpuSort() {
        return !this.usesGpuSort;
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
     * the workBuffer and notifies derived classes of the format change. Derived classes may
     * override this to react to the source change (e.g. re-pointing materials at the new
     * work-buffer textures).
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
     * Invalidates any cached cull/compaction upload state (e.g. after a work-buffer rebuild that
     * may have moved bounds indices). No-op for renderers without a GPU cull pipeline.
     */
    invalidateCullUpload() {
    }

    /**
     * Prepares the forward view for rendering. Renderers that run their own GPU pipeline (cull +
     * projection + sort) do their per-frame work here; CPU-sort renderers rely on the manager's
     * worker instead and leave this as a no-op.
     *
     * @param {GSplatWorld} world - The world providing the work buffer, bounds, and states.
     * @param {GSplatWorldState} worldState - The render-ready world state to draw.
     * @param {GSplatRenderViewParams} params - Per-call parameters for this view.
     * @returns {boolean} True if a GPU dispatch ran this call.
     */
    prepareRenderView(world, worldState, params) {
        return false;
    }

    /**
     * Prepares a pick view and returns the configured pick mesh instance. Only meaningful for
     * renderers with a GPU pipeline; others return null.
     *
     * @param {GSplatWorld} world - The world providing the work buffer, bounds, and states.
     * @param {GSplatWorldState} worldState - The render-ready world state.
     * @param {GSplatRenderViewParams} pickParams - Per-call parameters for the pick view.
     * @returns {MeshInstance|null} The pick mesh instance, or null.
     */
    preparePickingView(world, worldState, pickParams) {
        return null;
    }
}

export { GSplatRenderer };
