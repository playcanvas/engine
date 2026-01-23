import { Debug } from '../../core/debug.js';
import { ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_R32U, PIXELFORMAT_RGBA16U, BUFFERUSAGE_COPY_DST, SEMANTIC_POSITION, getGlslShaderType } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { Texture } from '../../platform/graphics/texture.js';
import { UploadStream } from '../../platform/graphics/upload-stream.js';
import { QuadRender } from '../graphics/quad-render.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import glslGsplatCopyToWorkBufferPS from '../shader-lib/glsl/chunks/gsplat/frag/gsplatCopyToWorkbuffer.js';
import wgslGsplatCopyToWorkBufferPS from '../shader-lib/wgsl/chunks/gsplat/frag/gsplatCopyToWorkbuffer.js';
import { GSplatWorkBufferRenderPass } from './gsplat-work-buffer-render-pass.js';
import { GSplatStreams } from '../gsplat/gsplat-streams.js';

let id = 0;

/**
 * @import { GSplatFormat } from '../gsplat/gsplat-format.js'
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

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {string} key - Cache key for this render info.
     * @param {ShaderMaterial} material - The material to use.
     * @param {boolean} colorOnly - Whether to render only color (not full MRT).
     * @param {GSplatFormat} format - The work buffer format descriptor.
     */
    constructor(device, key, material, colorOnly, format) {
        this.device = device;
        this.material = material;

        const clonedDefines = new Map(material.defines);

        // Derive color format from format's splatColor stream
        const colorStream = format.getStream('splatColor');
        const isColorUint = colorStream.format === PIXELFORMAT_RGBA16U;
        if (isColorUint) {
            clonedDefines.set('GSPLAT_COLOR_UINT', '');
        }

        // when rendering only color (not full MRT)
        if (colorOnly) {
            clonedDefines.set('GSPLAT_COLOR_ONLY', '');
        }

        // Get custom shader chunks from material (for container support)
        const fragmentIncludes = material.hasShaderChunks ?
            (device.isWebGPU ? material.shaderChunks.wgsl : material.shaderChunks.glsl) :
            undefined;

        // Get streams to output - color-only mode uses just splatColor, otherwise all streams
        const outputStreams = colorOnly ? [colorStream] : [...format.streams, ...format.extraStreams];

        // Build fragmentOutputTypes from streams
        const fragmentOutputTypes = [];
        for (const stream of outputStreams) {
            const info = getGlslShaderType(stream.format);
            fragmentOutputTypes.push(info.returnType);
        }

        const shader = ShaderUtils.createShader(device, {
            uniqueName: `SplatCopyToWorkBuffer:${key}`,
            attributes: { vertex_position: SEMANTIC_POSITION },
            vertexDefines: clonedDefines,
            fragmentDefines: clonedDefines,
            vertexChunk: 'fullscreenQuadVS',
            fragmentGLSL: glslGsplatCopyToWorkBufferPS,
            fragmentWGSL: wgslGsplatCopyToWorkBufferPS,
            fragmentIncludes: fragmentIncludes,
            fragmentOutputTypes: fragmentOutputTypes
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

    /** @type {GSplatFormat} */
    format;

    /** @type {number} */
    id = id++;

    /**
     * Manages textures for format streams.
     *
     * @type {GSplatStreams}
     */
    streams;

    /**
     * Main MRT render target for all work buffer streams.
     *
     * @type {RenderTarget}
     */
    renderTarget;

    /**
     * Color-only render target for updating just the splatColor stream.
     *
     * @type {RenderTarget}
     */
    colorRenderTarget;

    /** @type {Texture|undefined} */
    orderTexture;

    /** @type {StorageBuffer|undefined} */
    orderBuffer;

    /** @type {UploadStream} */
    uploadStream;

    /** @type {GSplatWorkBufferRenderPass} */
    renderPass;

    /** @type {GSplatWorkBufferRenderPass} */
    colorRenderPass;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatFormat} format - The work buffer format descriptor.
     */
    constructor(device, format) {
        this.device = device;
        this.format = format;

        // Create streams manager and initialize with format
        this.streams = new GSplatStreams(device);
        this.streams.init(format, 1);

        // Build render targets from textures
        this._createRenderTargets();

        // Create upload stream for non-blocking uploads
        this.uploadStream = new UploadStream(device);

        // Use storage buffer on WebGPU, texture on WebGL
        if (device.isWebGPU) {
            this.orderBuffer = new StorageBuffer(device, 4, BUFFERUSAGE_COPY_DST);
        } else {
            this.orderTexture = new Texture(device, {
                name: 'SplatGlobalOrder',
                width: 1,
                height: 1,
                format: PIXELFORMAT_R32U,
                mipmaps: false,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            });
        }

        // Create the optimized render pass for batched splat rendering
        this.renderPass = new GSplatWorkBufferRenderPass(device, this);
        this.renderPass.init(this.renderTarget);

        // Create the color-only render pass for updating just the color texture
        this.colorRenderPass = new GSplatWorkBufferRenderPass(device, this, true);
        this.colorRenderPass.init(this.colorRenderTarget);
    }

    /**
     * Creates or recreates render targets from current textures.
     *
     * @private
     */
    _createRenderTargets() {
        // Work buffer does not support instance-level streams
        Debug.assert(this.format.instanceStreams.length === 0,
            'Work buffer format does not support instance-level streams (GSPLAT_STREAM_INSTANCE)');

        // Destroy existing render targets
        this.renderTarget?.destroy();
        this.colorRenderTarget?.destroy();

        // Collect all textures in order for MRT
        const colorBuffers = this.streams.getTexturesInOrder();
        this.renderTarget = new RenderTarget({
            name: `GsplatWorkBuffer-MRT-${this.id}`,
            colorBuffers: colorBuffers,
            depth: false,
            flipY: true
        });

        // Color-only render target uses just the first texture (splatColor)
        const colorTexture = this.streams.getTexture('splatColor');
        this.colorRenderTarget = new RenderTarget({
            name: `GsplatWorkBuffer-Color-${this.id}`,
            colorBuffer: colorTexture,
            depth: false,
            flipY: true
        });

        // Reinitialize render passes
        this.renderPass?.init(this.renderTarget);
        this.colorRenderPass?.init(this.colorRenderTarget);
    }

    /**
     * Syncs textures and render targets with the format when extra streams are added.
     * Call this before rendering to ensure all streams have textures.
     */
    syncWithFormat() {
        const prevVersion = this.streams._formatVersion;
        this.streams.syncWithFormat(this.format);

        // If format changed, recreate render targets to include new textures
        if (prevVersion !== this.streams._formatVersion) {
            this._createRenderTargets();
        }
    }

    /**
     * Gets a texture by name.
     *
     * @param {string} name - The texture name.
     * @returns {Texture|undefined} The texture, or undefined if not found.
     */
    getTexture(name) {
        return this.streams.getTexture(name);
    }

    destroy() {
        this.renderPass?.destroy();
        this.colorRenderPass?.destroy();
        this.streams.destroy();
        this.orderTexture?.destroy();
        this.orderBuffer?.destroy();
        this.renderTarget?.destroy();
        this.colorRenderTarget?.destroy();
        this.uploadStream.destroy();
    }

    get textureSize() {
        return this.streams.textureDimensions.x;
    }

    setOrderData(data) {
        const size = this.textureSize;
        if (this.device.isWebGPU) {
            Debug.assert(data.length <= size * size);
            this.uploadStream.upload(data, this.orderBuffer, 0, data.length);
        } else {
            Debug.assert(data.length === size * size);
            this.uploadStream.upload(data, this.orderTexture, 0, data.length);
        }
    }

    /**
     * @param {number} textureSize - The texture size to resize to.
     */
    resize(textureSize) {
        Debug.assert(textureSize);
        this.renderTarget.resize(textureSize, textureSize);
        this.colorRenderTarget.resize(textureSize, textureSize);
        this.streams.resize(textureSize, textureSize);

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

    /**
     * Render only the color data to the work buffer (not geometry/covariance).
     *
     * @param {GSplatInfo[]} splats - The splats to render.
     * @param {GraphNode} cameraNode - The camera node.
     * @param {number[][]|undefined} colorsByLod - Array of RGB colors per LOD. Index by lodIndex; if a
     * shorter array is provided, index 0 will be reused as fallback.
     */
    renderColor(splats, cameraNode, colorsByLod) {
        // render only color using color-only render pass
        if (this.colorRenderPass.update(splats, cameraNode, colorsByLod)) {
            this.colorRenderPass.render();
        }
    }
}

export { GSplatWorkBuffer, WorkBufferRenderInfo };
