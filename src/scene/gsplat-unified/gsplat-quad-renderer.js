import { SEMANTIC_POSITION, CULLFACE_NONE, PIXELFORMAT_RGBA16U } from '../../platform/graphics/constants.js';
import {
    BLEND_NONE, BLEND_PREMULTIPLIED, BLEND_ADDITIVE, GSPLAT_FORWARD, GSPLAT_SHADOW,
    SHADOWCAMERA_NAME
} from '../constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { GSplatResourceBase } from '../gsplat/gsplat-resource-base.js';
import { MeshInstance } from '../mesh-instance.js';
import { GSplatRenderer } from './gsplat-renderer.js';

/**
 * @import { StorageBuffer } from '../../platform/graphics/storage-buffer.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Layer } from '../layer.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
 */

/**
 * Renders splats from the work buffer using instanced quad rendering.
 *
 * @ignore
 */
class GSplatQuadRenderer extends GSplatRenderer {
    /** @type {ShaderMaterial} */
    _material;

    /** @type {MeshInstance} */
    meshInstance;

    /** @type {number} */
    originalBlendType = BLEND_ADDITIVE;

    /** @type {Set<string>} */
    _internalDefines = new Set();

    /** @type {boolean} */
    forceCopyMaterial = true;

    /** @private */
    _lastFisheyeEnabled = false;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GraphNode} node - The graph node.
     * @param {GraphNode} cameraNode - The camera node.
     * @param {Layer} layer - The layer to add mesh instances to.
     * @param {GSplatWorkBuffer} workBuffer - The work buffer containing splat data.
     */
    constructor(device, node, cameraNode, layer, workBuffer) {
        super(device, node, cameraNode, layer, workBuffer);

        this._material = new ShaderMaterial({
            uniqueName: 'UnifiedSplatMaterial',
            vertexGLSL: '#include "gsplatVS"',
            fragmentGLSL: '#include "gsplatPS"',
            vertexWGSL: '#include "gsplatVS"',
            fragmentWGSL: '#include "gsplatPS"',
            attributes: {
                vertex_position: SEMANTIC_POSITION
            }
        });

        this._material.setDefine('{GSPLAT_INSTANCE_SIZE}', GSplatResourceBase.instanceSize);

        this.configureMaterial();

        // Capture internal define names to protect them from being cleared
        this._material.defines.forEach((value, key) => {
            this._internalDefines.add(key);
        });

        // Also protect defines that may be added dynamically
        this._internalDefines.add('{GSPLAT_INSTANCE_SIZE}');
        this._internalDefines.add('GSPLAT_UNIFIED_ID');
        this._internalDefines.add('PICK_CUSTOM_ID');
        this._internalDefines.add('GSPLAT_INDIRECT_DRAW');
        this._internalDefines.add('GSPLAT_SEPARATE_OPACITY');
        this._internalDefines.add('GSPLAT_FISHEYE');

        this.meshInstance = this.createMeshInstance();
    }

    /**
     * Sets the render mode for this renderer, managing layer array membership.
     *
     * @param {number} renderMode - Bitmask flags controlling render passes (GSPLAT_FORWARD, GSPLAT_SHADOW, or both).
     */
    setRenderMode(renderMode) {
        const oldRenderMode = this.renderMode ?? 0;

        // Calculate what changed
        const wasForward = (oldRenderMode & GSPLAT_FORWARD) !== 0;
        const wasShadow = (oldRenderMode & GSPLAT_SHADOW) !== 0;
        const isForward = (renderMode & GSPLAT_FORWARD) !== 0;
        const isShadow = (renderMode & GSPLAT_SHADOW) !== 0;

        // Update mesh instance castShadow state FIRST, before adding to arrays
        this.meshInstance.castShadow = isShadow;

        // Remove from old arrays if needed
        if (wasForward && !isForward) {
            this.layer.removeMeshInstances([this.meshInstance], true);
        }
        if (wasShadow && !isShadow) {
            this.layer.removeShadowCasters([this.meshInstance]);
        }

        // Add to new arrays if needed
        if (!wasForward && isForward) {
            this.layer.addMeshInstances([this.meshInstance], true);
        }
        if (!wasShadow && isShadow) {
            this.layer.addShadowCasters([this.meshInstance]);
        }

        super.setRenderMode(renderMode);
    }

    destroy() {
        // Remove mesh instance from appropriate layer arrays based on render mode
        if (this.renderMode) {
            if (this.renderMode & GSPLAT_FORWARD) {
                this.layer.removeMeshInstances([this.meshInstance], true);
            }
            if (this.renderMode & GSPLAT_SHADOW) {
                this.layer.removeShadowCasters([this.meshInstance]);
            }
        }

        this._material.destroy();
        this.meshInstance.destroy();

        super.destroy();
    }

    get material() {
        return this._material;
    }

    onWorkBufferFormatChanged() {
        this.configureMaterial();
    }

    configureMaterial() {
        const { workBuffer } = this;

        // Inject format's shader chunks (uses workBuffer.format)
        this._injectFormatChunks();

        // Set defines
        this._material.setDefine('SH_BANDS', '0');
        this._material.setDefine('GSPLAT_SEPARATE_OPACITY', '');

        // Set GSPLAT_COLOR_FLOAT define based on work buffer's color format
        const colorStream = workBuffer.format.getStream('dataColor');
        if (colorStream && colorStream.format !== PIXELFORMAT_RGBA16U) {
            this._material.setDefine('GSPLAT_COLOR_FLOAT', '');
        }

        // Enable unified ID defines when pcId stream exists
        this._updateIdDefines();

        // Bind work buffer textures from the texture map
        this._bindWorkBufferTextures();

        // set instance properties
        const dither = false;
        this._material.setParameter('numSplats', 0);

        this.setOrderData();

        this._material.setDefine(`DITHER_${dither ? 'BLUENOISE' : 'NONE'}`, '');
        this._material.cull = CULLFACE_NONE;
        this._material.blendType = dither ? BLEND_NONE : BLEND_PREMULTIPLIED;
        this._material.depthWrite = !!dither;
        this._material.update();
    }

    /**
     * Binds work buffer textures to the material.
     *
     * @private
     */
    _bindWorkBufferTextures() {
        const { workBuffer } = this;

        for (const stream of workBuffer.format.resourceStreams) {
            const texture = workBuffer.getTexture(stream.name);
            if (texture) {
                this._material.setParameter(stream.name, texture);
            }
        }
    }

    /**
     * Injects format shader chunks into the material.
     * Called during initialization and after copying settings from user material.
     *
     * @private
     */
    _injectFormatChunks() {
        const chunks = this.device.isWebGPU ? this._material.shaderChunks.wgsl : this._material.shaderChunks.glsl;
        const wbFormat = this.workBuffer.format;

        // Use work buffer format for declarations and read code
        // getInputDeclarations() returns all streams (base + extra)
        chunks.set('gsplatDeclarationsVS', wbFormat.getInputDeclarations());
        chunks.set('gsplatReadVS', wbFormat.getReadCode());
    }

    update(count, textureSize) {

        // limit splat render count to exclude those behind the camera
        this.meshInstance.instancingCount = Math.ceil(count / GSplatResourceBase.instanceSize);

        // update splat count on the material
        this._material.setParameter('numSplats', count);
        this._material.setParameter('splatTextureSize', textureSize);

        // disable rendering if no splats to render
        this.meshInstance.visible = count > 0;
    }

    /**
     * Configures the renderer to use GPU-sorted data for rendering.
     *
     * @param {number} drawSlot - The indirect draw slot index in the device's buffer.
     * @param {StorageBuffer} sortedIds - Buffer containing sorted visible splat IDs.
     * @param {StorageBuffer} numSplatsBuffer - Buffer containing numSplats for vertex shader.
     * @param {number} textureSize - The work buffer texture size.
     */
    setGpuSortedRendering(drawSlot, sortedIds, numSplatsBuffer, textureSize) {
        this.meshInstance.setIndirect(null, drawSlot, 1);

        // Bind compaction buffers for vertex shader
        this._material.setParameter('compactedSplatIds', sortedIds);
        this._material.setParameter('numSplatsStorage', numSplatsBuffer);

        // Set GSPLAT_INDIRECT_DRAW define if not already set
        if (!this._material.getDefine('GSPLAT_INDIRECT_DRAW')) {
            this._material.setDefine('GSPLAT_INDIRECT_DRAW', true);
            this._material.update();
        }

        this._material.setParameter('splatTextureSize', textureSize);
        this.meshInstance.visible = true;

        // Ensure instancingCount is non-zero so the forward/shadow renderers don't
        // skip this draw call. The actual instance count is GPU-driven via indirect args.
        if (this.meshInstance.instancingCount <= 0) {
            this.meshInstance.instancingCount = 1;
        }
    }

    /**
     * Switches the renderer to CPU-sorted rendering mode.
     */
    setCpuSortedRendering() {
        this.meshInstance.setIndirect(null, -1);

        if (this._material.getDefine('GSPLAT_INDIRECT_DRAW')) {
            this._material.setDefine('GSPLAT_INDIRECT_DRAW', false);
            this._material.update();
        }

        // Restore order data from work buffer (CPU upload path)
        this.setOrderData();

        // Hide until update() is called with valid CPU sort data
        this.meshInstance.visible = false;
    }

    setOrderData() {
        // Set the appropriate order data resource based on device type
        if (this.device.isWebGPU) {
            this._material.setParameter('splatOrder', this.workBuffer.orderBuffer);
        } else {
            this._material.setParameter('splatOrder', this.workBuffer.orderTexture);
        }
    }

    frameUpdate(params) {

        // Update colorRampIntensity parameter every frame when overdraw is enabled
        if (params.colorRamp) {
            this._material.setParameter('colorRampIntensity', params.colorRampIntensity);
        }

        // Update fisheye projection
        const cam = this.cameraNode.camera;
        this.fisheyeProj.update(params.fisheye, cam.fov, cam.projectionMatrix);

        const fisheyeEnabled = this.fisheyeProj.enabled;
        if (fisheyeEnabled !== this._lastFisheyeEnabled) {
            this._lastFisheyeEnabled = fisheyeEnabled;
            this._material.setDefine('GSPLAT_FISHEYE', fisheyeEnabled);
            this._material.update();
        }

        if (fisheyeEnabled) {
            const fp = this.fisheyeProj;
            this._material.setParameter('fisheye_k', fp.k);
            this._material.setParameter('fisheye_inv_k', fp.invK);
            this._material.setParameter('fisheye_projMat00', fp.projMat00);
            this._material.setParameter('fisheye_projMat11', fp.projMat11);
        }

        const noFog = !params.useFog;
        if (noFog !== this._lastNoFog) {
            this._lastNoFog = noFog;
            this._material.setDefine('GSPLAT_NO_FOG', noFog);
            this._material.update();
        }

        // Check if work buffer format has changed (extra streams added)
        this._syncWithWorkBufferFormat();

        // Copy material settings from params.material if dirty or on first update
        if (this.forceCopyMaterial || params.material.dirty) {
            this.copyMaterialSettings(params.material);
            this.forceCopyMaterial = false;
        }
    }

    /**
     * Updates the ID-related defines based on whether pcId stream exists.
     *
     * @private
     */
    _updateIdDefines() {
        // GSPLAT_UNIFIED_ID enables reading component ID from work buffer
        // PICK_CUSTOM_ID prevents pick.js from declaring meshInstanceId uniform
        const hasPcId = !!this.workBuffer.format.getStream('pcId');
        this._material.setDefine('GSPLAT_UNIFIED_ID', hasPcId);
        this._material.setDefine('PICK_CUSTOM_ID', hasPcId);
    }

    /**
     * Syncs with work buffer format when extra streams are added.
     *
     * @private
     */
    _syncWithWorkBufferFormat() {
        const wbFormat = this.workBuffer.format;
        if (this._workBufferFormatVersion !== wbFormat.extraStreamsVersion) {
            this._workBufferFormatVersion = wbFormat.extraStreamsVersion;

            // Sync work buffer textures with format
            this.workBuffer.syncWithFormat();

            // Re-inject format chunks with extra stream declarations
            this._injectFormatChunks();

            // Bind any new textures from the work buffer
            this._bindWorkBufferTextures();

            // Enable unified ID defines when pcId stream exists
            this._updateIdDefines();

            this._material.update();
        }
    }

    /**
     * Copies material settings from a source material to the internal material.
     * Preserves internal defines while copying user defines, parameters, and shader chunks.
     *
     * @param {ShaderMaterial} sourceMaterial - The source material to copy settings from.
     * @private
     */
    copyMaterialSettings(sourceMaterial) {
        // Clear user defines (preserve internal defines)
        const keysToDelete = [];
        this._material.defines.forEach((value, key) => {
            if (!this._internalDefines.has(key)) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(key => this._material.defines.delete(key));

        // Copy defines from source material
        sourceMaterial.defines.forEach((value, key) => {
            this._material.defines.set(key, value);
        });

        // Copy parameters
        const srcParams = sourceMaterial.parameters;
        for (const paramName in srcParams) {
            if (srcParams.hasOwnProperty(paramName)) {
                this._material.setParameter(paramName, srcParams[paramName].data);
            }
        }

        // Copy shader chunks if they exist
        if (sourceMaterial.hasShaderChunks) {
            this._material.shaderChunks.copy(sourceMaterial.shaderChunks);
        }

        // Re-inject format chunks that may have been overwritten by copy
        this._injectFormatChunks();

        this._material.update();
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
                // TODO: when overdraw mode is enabled, we could disable sorting of splats,
                // as additive blend mode does not require them to be sorted

                // Store the current blend type before switching to additive
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

        // only start rendering the splat after we've received the splat order data
        meshInstance.instancingCount = 0;

        // custom culling to only disable rendering for matching camera
        // TODO: consider using aabb as well to avoid rendering off-screen splats
        const thisCamera = this.cameraNode.camera;
        meshInstance.isVisibleFunc = (camera) => {
            const renderMode = this.renderMode ?? 0;

            // visible for main camera in forward rendering mode
            if (thisCamera.camera === camera && (renderMode & GSPLAT_FORWARD)) {
                return true;
            }

            // visible for shadow cameras in shadow rendering mode
            if (renderMode & GSPLAT_SHADOW) {
                return camera.node?.name === SHADOWCAMERA_NAME;
            }

            return false;
        };

        return meshInstance;
    }
}

export { GSplatQuadRenderer };
