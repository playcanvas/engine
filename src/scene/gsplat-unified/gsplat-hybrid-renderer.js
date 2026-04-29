import { SEMANTIC_POSITION, CULLFACE_NONE } from '../../platform/graphics/constants.js';
import {
    BLEND_NONE, BLEND_PREMULTIPLIED, BLEND_ADDITIVE, GSPLAT_FORWARD,
    SHADOWCAMERA_NAME
} from '../constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { GSplatResourceBase } from '../gsplat/gsplat-resource-base.js';
import { MeshInstance } from '../mesh-instance.js';
import { GSplatRenderer } from './gsplat-renderer.js';
import { CACHE_STRIDE } from './gsplat-projector-constants.js';

/**
 * @import { StorageBuffer } from '../../platform/graphics/storage-buffer.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Layer } from '../layer.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
 */

/**
 * Renders splats from a pre-projected cache built by the projector compute pass
 * (see {@link GSplatProjector}) and a globally radix-sorted index array. The
 * vertex shader is `gsplatHybridVS`; the fragment is the existing `gsplatPS`.
 *
 * Supports forward rendering and explicit pick/prepass paths. Shadow rendering is
 * intentionally not supported because the projection cache is camera-specific.
 *
 * @ignore
 */
class GSplatHybridRenderer extends GSplatRenderer {
    /** @type {ShaderMaterial} */
    _material;

    /** @type {MeshInstance} */
    meshInstance;

    /** @type {ShaderMaterial|null} */
    _pickMaterial = null;

    /** @type {MeshInstance|null} */
    _pickMeshInstance = null;

    /** @type {number} */
    originalBlendType = BLEND_ADDITIVE;

    /** @type {Set<string>} */
    _internalDefines = new Set();

    /** @type {boolean} */
    forceCopyMaterial = true;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GraphNode} node - The graph node.
     * @param {GraphNode} cameraNode - The camera node.
     * @param {Layer} layer - The layer to add mesh instances to.
     * @param {GSplatWorkBuffer} workBuffer - The work buffer (kept for parent compatibility;
     * the hybrid renderer does not bind work-buffer textures itself).
     */
    constructor(device, node, cameraNode, layer, workBuffer) {
        super(device, node, cameraNode, layer, workBuffer);

        this._material = new ShaderMaterial({
            uniqueName: 'UnifiedSplatHybridMaterial',
            vertexWGSL: '#include "gsplatHybridVS"',
            fragmentWGSL: '#include "gsplatPS"',
            attributes: {
                vertex_position: SEMANTIC_POSITION
            }
        });

        this._material.setDefine('{GSPLAT_INSTANCE_SIZE}', GSplatResourceBase.instanceSize);
        this._material.setDefine('{CACHE_STRIDE}', CACHE_STRIDE);

        this.configureMaterial();

        this._material.defines.forEach((value, key) => {
            this._internalDefines.add(key);
        });

        // Defines that may be added dynamically; preserve them when copying user material.
        this._internalDefines.add('{GSPLAT_INSTANCE_SIZE}');
        this._internalDefines.add('{CACHE_STRIDE}');
        this._internalDefines.add('GSPLAT_UNIFIED_ID');
        this._internalDefines.add('PICK_CUSTOM_ID');
        this._internalDefines.add('GSPLAT_OVERDRAW');
        this._internalDefines.add('GSPLAT_NO_FOG');

        this.meshInstance = this.createMeshInstance();
    }

    /**
     * Sets the render mode. The hybrid path does not add shadow casters; shadow cameras
     * need their own projection cache and remain unsupported here.
     *
     * @param {number} renderMode - Bitmask flags controlling render passes.
     */
    setRenderMode(renderMode) {
        const oldRenderMode = this.renderMode ?? 0;
        const wasForward = (oldRenderMode & GSPLAT_FORWARD) !== 0;
        const isForward = (renderMode & GSPLAT_FORWARD) !== 0;

        if (wasForward && !isForward) {
            this.layer.removeMeshInstances([this.meshInstance], true);
        }
        if (!wasForward && isForward) {
            this.layer.addMeshInstances([this.meshInstance], true);
        }

        super.setRenderMode(renderMode);
    }

    destroy() {
        if (this.renderMode && (this.renderMode & GSPLAT_FORWARD)) {
            this.layer.removeMeshInstances([this.meshInstance], true);
        }
        this._material.destroy();
        this._pickMaterial?.destroy();
        this.meshInstance.destroy();
        this._pickMeshInstance?.destroy();
        super.destroy();
    }

    get material() {
        return this._material;
    }

    onWorkBufferFormatChanged() {
        this.configureMaterial();
    }

    configureMaterial() {
        this._material.setDefine('SH_BANDS', '0');
        this._material.setDefine('GSPLAT_INDIRECT_DRAW', '');
        this._updateIdDefines(this._material);

        const dither = false;
        this._material.setDefine(`DITHER_${dither ? 'BLUENOISE' : 'NONE'}`, '');
        this._material.cull = CULLFACE_NONE;
        this._material.blendType = dither ? BLEND_NONE : BLEND_PREMULTIPLIED;
        this._material.depthWrite = !!dither;
        this._material.update();
    }

    update(count, textureSize) {
        // Indirect-draw path; the GPU-written instance count drives instancing. We just
        // need a non-zero instancingCount so the forward renderer issues the draw call.
        if (this.meshInstance.instancingCount <= 0) {
            this.meshInstance.instancingCount = 1;
        }
        this.meshInstance.visible = count > 0;
    }

    /**
     * Configures the renderer to draw from the projector's caches.
     *
     * @param {number} drawSlot - The indirect draw slot index.
     * @param {StorageBuffer} sortedIndices - Globally-sorted indices into projCache.
     * @param {StorageBuffer} projCache - Per-splat projection cache produced by the projector.
     * @param {StorageBuffer} numSplatsBuffer - GPU-written visible-splat count.
     */
    setHybridSortedRendering(drawSlot, sortedIndices, projCache, numSplatsBuffer) {
        this.meshInstance.setIndirect(null, drawSlot, 1);

        this._material.setParameter('sortedIndices', sortedIndices);
        this._material.setParameter('projCache', projCache);
        this._material.setParameter('numSplatsStorage', numSplatsBuffer);

        this.meshInstance.visible = true;

        if (this.meshInstance.instancingCount <= 0) {
            this.meshInstance.instancingCount = 1;
        }
    }

    /**
     * Configures and returns a transient pick mesh instance for the picker render pass.
     *
     * @param {number} drawSlot - The indirect draw slot index.
     * @param {StorageBuffer} sortedIndices - Globally-sorted indices into projCache.
     * @param {StorageBuffer} projCache - Per-splat projection cache produced by the projector.
     * @param {StorageBuffer} numSplatsBuffer - GPU-written visible-splat count.
     * @param {number} alphaClip - Fragment alpha threshold for picking.
     * @returns {MeshInstance} The pick mesh instance.
     */
    prepareForPicking(drawSlot, sortedIndices, projCache, numSplatsBuffer, alphaClip) {
        if (!this._pickMaterial) {
            this._pickMaterial = new ShaderMaterial({
                uniqueName: 'UnifiedSplatHybridPickMaterial',
                vertexWGSL: '#include "gsplatHybridVS"',
                fragmentWGSL: '#include "gsplatPS"',
                attributes: {
                    vertex_position: SEMANTIC_POSITION
                }
            });

            this._pickMaterial.setDefine('{GSPLAT_INSTANCE_SIZE}', GSplatResourceBase.instanceSize);
            this._pickMaterial.setDefine('{CACHE_STRIDE}', CACHE_STRIDE);
            this._pickMaterial.setDefine('SH_BANDS', '0');
            this._pickMaterial.setDefine('GSPLAT_INDIRECT_DRAW', '');
            this._pickMaterial.setDefine('DITHER_NONE', '');
            this._updateIdDefines(this._pickMaterial);
            this._pickMaterial.cull = CULLFACE_NONE;
            this._pickMaterial.blendType = BLEND_NONE;
            this._pickMaterial.depthWrite = false;
            this._pickMaterial.update();

            const mesh = GSplatResourceBase.createMesh(this.device);
            this._pickMeshInstance = new MeshInstance(mesh, this._pickMaterial);
            this._pickMeshInstance.node = this.node;
            this._pickMeshInstance.setInstancing(true, true);
            this._pickMeshInstance.instancingCount = 1;
        } else {
            if (this._updateIdDefines(this._pickMaterial)) {
                this._pickMaterial.update();
            }
        }

        const pickMaterial = /** @type {ShaderMaterial} */ (this._pickMaterial);
        const pickMeshInstance = /** @type {MeshInstance} */ (this._pickMeshInstance);

        pickMeshInstance.setIndirect(null, drawSlot, 1);
        pickMaterial.setParameter('sortedIndices', sortedIndices);
        pickMaterial.setParameter('projCache', projCache);
        pickMaterial.setParameter('numSplatsStorage', numSplatsBuffer);
        pickMaterial.setParameter('alphaClip', alphaClip);

        return pickMeshInstance;
    }

    /**
     * The hybrid path is GPU-driven only; CPU-sort is handled by the quad renderer
     * (the manager swaps renderers when the active mode changes).
     */
    setCpuSortedRendering() {
        this.meshInstance.setIndirect(null, -1);
        this.meshInstance.visible = false;
    }

    setOrderData() {
        // No-op: order is consumed via sortedIndices storage buffer set in
        // setHybridSortedRendering; nothing to bind from the work buffer.
    }

    frameUpdate(params) {
        this._material.setParameter('alphaClip', params.alphaClip);
        this._pickMaterial?.setParameter('alphaClip', params.alphaClip);

        if (params.colorRamp) {
            this._material.setParameter('colorRampIntensity', params.colorRampIntensity);
        }

        const noFog = !params.useFog;
        if (noFog !== this._lastNoFog) {
            this._lastNoFog = noFog;
            this._material.setDefine('GSPLAT_NO_FOG', noFog);
            this._material.update();
        }
    }

    /**
     * Updates pick ID defines to match the work-buffer format.
     *
     * @param {ShaderMaterial} material - Material to update.
     * @returns {boolean} True if the material defines changed.
     * @private
     */
    _updateIdDefines(material) {
        const hasPcId = !!this.workBuffer.format.getStream('pcId');
        const changed = material.getDefine('GSPLAT_UNIFIED_ID') !== hasPcId ||
            material.getDefine('PICK_CUSTOM_ID') !== hasPcId;
        material.setDefine('GSPLAT_UNIFIED_ID', hasPcId);
        material.setDefine('PICK_CUSTOM_ID', hasPcId);
        return changed;
    }

    updateOverdrawMode(params) {
        const overdrawEnabled = !!params.colorRamp;
        const wasOverdrawEnabled = this._material.getDefine('GSPLAT_OVERDRAW');

        if (overdrawEnabled) {
            this._material.setParameter('colorRamp', params.colorRamp);
            this._material.setParameter('colorRampIntensity', params.colorRampIntensity);
        }

        if (overdrawEnabled !== wasOverdrawEnabled) {
            this._material.setDefine('GSPLAT_OVERDRAW', overdrawEnabled);
            if (overdrawEnabled) {
                this.originalBlendType = this._material.blendType;
                this._material.blendType = BLEND_ADDITIVE;
            } else {
                this._material.blendType = this.originalBlendType;
            }
            this._material.update();
        }
    }

    createMeshInstance() {
        const mesh = GSplatResourceBase.createMesh(this.device);
        const meshInstance = new MeshInstance(mesh, this._material);
        meshInstance.node = this.node;
        meshInstance.setInstancing(true, true);
        meshInstance.instancingCount = 0;
        meshInstance.pick = false;

        const thisCamera = this.cameraNode.camera;
        meshInstance.isVisibleFunc = (camera) => {
            const renderMode = this.renderMode ?? 0;
            if (thisCamera.camera === camera && (renderMode & GSPLAT_FORWARD)) {
                return true;
            }
            // Hybrid renderer never participates in shadow casting.
            if (camera.node?.name === SHADOWCAMERA_NAME) {
                return false;
            }
            return false;
        };

        return meshInstance;
    }
}

export { GSplatHybridRenderer };
