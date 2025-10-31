import { Debug } from '../../core/debug.js';
import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_R32U, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA16U, PIXELFORMAT_RGBA32U, PIXELFORMAT_RG32U, BUFFERUSAGE_COPY_DST, SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { Texture } from '../../platform/graphics/texture.js';
import { UploadStream } from '../../platform/graphics/upload-stream.js';
import { QuadRender } from '../graphics/quad-render.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import glslGsplatCopyToWorkBufferPS from '../shader-lib/glsl/chunks/gsplat/frag/gsplatCopyToWorkbuffer.js';
import wgslGsplatCopyToWorkBufferPS from '../shader-lib/wgsl/chunks/gsplat/frag/gsplatCopyToWorkbuffer.js';
import { GSplatWorkBufferRenderPass } from './gsplat-work-buffer-render-pass.js';

let id = 0;

/**
 * @import { GSplatInfo } from "./gsplat-info.js"
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GraphNode } from '../graph-node.js';
 * @import { ShaderMaterial } from '../materials/shader-material.js'
 */

/**
 * A helper class to cache quad renders for work buffer rendering.
 *
 * @ignore
 */
class WorkBufferRenderInfo {
    /** @type {ShaderMaterial} */
    material;

    /** @type {QuadRender} */
    quadRender;

    constructor(device, key, material, colorTextureFormat) {
        this.device = device;
        this.material = material;

        const clonedDefines = new Map(material.defines);

        // when using fallback RGBA16U format
        const isColorUint = colorTextureFormat === PIXELFORMAT_RGBA16U;
        if (isColorUint) {
            clonedDefines.set('GSPLAT_COLOR_UINT', '');
        }

        const shader = ShaderUtils.createShader(this.device, {
            uniqueName: `SplatCopyToWorkBuffer:${key}`,
            attributes: { vertex_position: SEMANTIC_POSITION },
            vertexDefines: clonedDefines,
            fragmentDefines: clonedDefines,
            vertexChunk: 'fullscreenQuadVS',
            fragmentGLSL: glslGsplatCopyToWorkBufferPS,
            fragmentWGSL: wgslGsplatCopyToWorkBufferPS,
            fragmentOutputTypes: [isColorUint ? 'uvec4' : 'vec4', 'uvec4', 'uvec2']
        });

        this.quadRender = new QuadRender(shader);
    }

    destroy() {
        this.material?.destroy();
        this.quadRender?.destroy();
    }
}

/**
 * @ignore
 */
class GSplatWorkBuffer {
    /** @type {GraphicsDevice} */
    device;

    /** @type {number} */
    id = id++;

    /** @type {number} */
    colorTextureFormat;

    /** @type {Texture} */
    colorTexture;

    /** @type {Texture} */
    splatTexture0;

    /** @type {Texture} */
    splatTexture1;

    /** @type {RenderTarget} */
    renderTarget;

    /** @type {Texture} */
    orderTexture;

    /** @type {StorageBuffer} */
    orderBuffer;

    /** @type {number} */
    _textureSize = 1;

    /** @type {UploadStream} */
    uploadStream;

    /** @type {GSplatWorkBufferRenderPass} */
    renderPass;

    constructor(device) {
        this.device = device;

        // Detect compatible HDR format for color texture, fallback to RGBA16U if RGBA16F not supported
        this.colorTextureFormat = device.getRenderableHdrFormat([PIXELFORMAT_RGBA16F]) || PIXELFORMAT_RGBA16U;

        this.colorTexture = this.createTexture('splatColor', this.colorTextureFormat, 1, 1);
        this.splatTexture0 = this.createTexture('splatTexture0', PIXELFORMAT_RGBA32U, 1, 1);
        this.splatTexture1 = this.createTexture('splatTexture1', PIXELFORMAT_RG32U, 1, 1);

        this.renderTarget = new RenderTarget({
            name: `GsplatWorkBuffer-MRT-${this.id}`,
            colorBuffers: [this.colorTexture, this.splatTexture0, this.splatTexture1],
            depth: false,
            flipY: true
        });

        // Create upload stream for non-blocking uploads
        this.uploadStream = new UploadStream(device);

        // Use storage buffer on WebGPU, texture on WebGL
        if (device.isWebGPU) {
            this.orderBuffer = new StorageBuffer(device, 4, BUFFERUSAGE_COPY_DST);
        } else {
            this.orderTexture = this.createTexture('SplatGlobalOrder', PIXELFORMAT_R32U, 1, 1);
        }

        // Create the optimized render pass for batched splat rendering
        this.renderPass = new GSplatWorkBufferRenderPass(device, this);
        this.renderPass.init(this.renderTarget);
    }

    destroy() {
        this.renderPass?.destroy();
        this.colorTexture?.destroy();
        this.splatTexture0?.destroy();
        this.splatTexture1?.destroy();
        this.orderTexture?.destroy();
        this.orderBuffer?.destroy();
        this.renderTarget?.destroy();
        this.uploadStream.destroy();
    }

    get textureSize() {
        return this._textureSize;
    }

    setOrderData(data) {
        if (this.device.isWebGPU) {
            Debug.assert(data.length <= this._textureSize * this._textureSize);
            this.uploadStream.upload(data, this.orderBuffer, 0, data.length);
        } else {
            Debug.assert(data.length === this._textureSize * this._textureSize);
            this.uploadStream.upload(data, this.orderTexture, 0, data.length);
        }
    }

    createTexture(name, format, w, h) {
        return new Texture(this.device, {
            name: name,
            width: w,
            height: h,
            format: format,
            cubemap: false,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
    }

    /**
     * @param {number} textureSize - The texture size to resize to.
     */
    resize(textureSize) {
        Debug.assert(textureSize);
        this.renderTarget.resize(textureSize, textureSize);
        this._textureSize = textureSize;

        if (this.device.isWebGPU) {
            const newByteSize = textureSize * textureSize * 4;
            if (this.orderBuffer.byteSize < newByteSize) {
                this.orderBuffer.destroy();
                this.orderBuffer = new StorageBuffer(this.device, newByteSize, BUFFERUSAGE_COPY_DST);
            }
        } else {
            this.orderTexture.resize(textureSize, textureSize);
        }
    }

    /**
     * Render given splats to the work buffer.
     *
     * @param {GSplatInfo[]} splats - The splats to render.
     * @param {GraphNode} cameraNode - The camera node.
     * @param {number[][]|undefined} colorsByLod - Array of RGB colors per LOD. Index by lodIndex; if a
     * shorter array is provided, index 0 will be reused as fallback.
     */
    render(splats, cameraNode, colorsByLod) {
        // render splats using render pass
        if (this.renderPass.update(splats, cameraNode, colorsByLod)) {
            this.renderPass.render();
        }
    }
}

export { GSplatWorkBuffer, WorkBufferRenderInfo };
