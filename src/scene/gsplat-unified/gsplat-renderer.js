import { SEMANTIC_POSITION, SEMANTIC_ATTR13, CULLFACE_NONE, PIXELFORMAT_RGBA16U } from '../../platform/graphics/constants.js';
import { BLEND_NONE, BLEND_PREMULTIPLIED, BLEND_ADDITIVE } from '../constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { GSplatResourceBase } from '../gsplat/gsplat-resource-base.js';
import { MeshInstance } from '../mesh-instance.js';
import { math } from '../../core/math/math.js';

/**
 * @import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js'
 * @import { Layer } from '../layer.js'
 * @import { GraphNode } from '../graph-node.js'
 */

/**
 * Class that renders the splats from the work buffer.
 *
 * @ignore
 */
class GSplatRenderer {
    /** @type {ShaderMaterial} */
    _material;

    /** @type {MeshInstance} */
    meshInstance;

    /** @type {VertexBuffer|null} */
    instanceIndices = null;

    /** @type {number} */
    instanceIndicesCount = 0;

    /** @type {Layer} */
    layer;

    /** @type {GraphNode} */
    cameraNode;

    viewportParams = [0, 0];

    /** @type {number} */
    originalBlendType = BLEND_ADDITIVE;

    constructor(device, node, cameraNode, layer, workBuffer) {
        this.device = device;
        this.node = node;
        this.cameraNode = cameraNode;
        this.layer = layer;
        this.workBuffer = workBuffer;

        // construct the material which renders the splats from the work buffer
        this._material = new ShaderMaterial({
            uniqueName: 'UnifiedSplatMaterial',
            vertexGLSL: '#include "gsplatVS"',
            fragmentGLSL: '#include "gsplatPS"',
            vertexWGSL: '#include "gsplatVS"',
            fragmentWGSL: '#include "gsplatPS"',
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                vertex_id_attrib: SEMANTIC_ATTR13
            }
        });

        this.configureMaterial();

        this.meshInstance = this.createMeshInstance();
        layer.addMeshInstances([this.meshInstance]);
    }

    destroy() {
        this.layer.removeMeshInstances([this.meshInstance]);
        this._material.destroy();
        this.meshInstance.destroy();
    }

    get material() {
        return this._material;
    }

    configureMaterial() {
        const { device, workBuffer } = this;

        // input format
        this._material.setDefine('GSPLAT_WORKBUFFER_DATA', true);
        this._material.setDefine('STORAGE_ORDER', device.isWebGPU);

        // Check if using RGBA16U format (fallback for when RGBA16F not supported)
        const isColorUint = workBuffer.colorTextureFormat === PIXELFORMAT_RGBA16U;
        this._material.setDefine('GSPLAT_COLOR_UINT', isColorUint);

        // input textures (work buffer textures)
        this._material.setParameter('splatColor', workBuffer.colorTexture);
        this._material.setParameter('splatTexture0', workBuffer.splatTexture0);
        this._material.setParameter('splatTexture1', workBuffer.splatTexture1);
        this._material.setDefine('SH_BANDS', '0');

        // set instance properties
        const dither = false;
        this._material.setParameter('numSplats', 0);

        // Set order data - texture for WebGL only at init time, it does not need to be updated
        if (workBuffer.orderTexture) {
            this._material.setParameter('splatOrder', workBuffer.orderTexture);
        }

        this._material.setParameter('alphaClip', 0.3);
        this._material.setDefine(`DITHER_${dither ? 'BLUENOISE' : 'NONE'}`, '');
        this._material.cull = CULLFACE_NONE;
        this._material.blendType = dither ? BLEND_NONE : BLEND_PREMULTIPLIED;
        this._material.depthWrite = !!dither;
        this._material.update();
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

    frameUpdate(params) {

        // Set the appropriate order data resource based on device type
        if (this.device.isWebGPU) {
            this._material.setParameter('splatOrder', this.workBuffer.orderBuffer);
        } else {
            this._material.setParameter('splatOrder', this.workBuffer.orderTexture);
        }

        // Update colorRampIntensity parameter every frame when overdraw is enabled
        if (params.colorRamp) {
            this._material.setParameter('colorRampIntensity', params.colorRampIntensity);
        }
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

    setMaxNumSplats(numSplats) {

        // round up to the nearest multiple of instanceSize (same as createInstanceIndices does internally)
        const roundedNumSplats = math.roundUp(numSplats, GSplatResourceBase.instanceSize);

        if (this.instanceIndicesCount < roundedNumSplats) {
            this.instanceIndicesCount = roundedNumSplats;

            // destroy old instance indices
            this.instanceIndices?.destroy();

            // create new instance indices
            this.instanceIndices = GSplatResourceBase.createInstanceIndices(this.device, numSplats);
            this.meshInstance.setInstancing(this.instanceIndices, true);

            // update texture size uniform
            this._material.setParameter('splatTextureSize', this.workBuffer.textureSize);
        }
    }

    createMeshInstance() {

        const mesh = GSplatResourceBase.createMesh(this.device);
        const textureSize = this.workBuffer.textureSize;
        const instanceIndices = GSplatResourceBase.createInstanceIndices(this.device, textureSize * textureSize);
        const meshInstance = new MeshInstance(mesh, this._material);
        meshInstance.node = this.node;
        meshInstance.setInstancing(instanceIndices, true);

        // only start rendering the splat after we've received the splat order data
        meshInstance.instancingCount = 0;

        // custom culling to only disable rendering for matching camera
        // TODO: consider using aabb as well to avoid rendering off-screen splats
        const thisCamera = this.cameraNode.camera;
        meshInstance.isVisibleFunc = (camera) => {
            const vis = thisCamera.camera === camera;
            return vis;
        };

        return meshInstance;
    }

    updateViewport(cameraNode) {
        const camera = cameraNode.camera;
        const cameraRect = camera.rect;
        const renderTarget = camera?.renderTarget;
        const { width, height } = renderTarget ?? this.device;

        const viewport = this.viewportParams;
        viewport[0] = width * cameraRect.z;
        viewport[1] = height * cameraRect.w;

        // adjust viewport for stereoscopic VR sessions
        const xr = camera?.camera?.xr;
        if (xr?.active && xr.views.list.length === 2) {
            viewport[0] *= 0.5;
        }

        this._material.setParameter('viewport', viewport);
    }
}

export { GSplatRenderer };
