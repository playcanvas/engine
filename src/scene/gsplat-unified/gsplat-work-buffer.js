import { Debug } from '../../core/debug.js';
import { Frustum } from '../../core/shape/frustum.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec2 } from '../../core/math/vec2.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_R32U, PIXELFORMAT_RGBA16U, PIXELFORMAT_RGBA32F,
    BUFFERUSAGE_COPY_DST, SEMANTIC_POSITION, getGlslShaderType
} from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { Texture } from '../../platform/graphics/texture.js';
import { TextureUtils } from '../../platform/graphics/texture-utils.js';
import { UploadStream } from '../../platform/graphics/upload-stream.js';
import { QuadRender } from '../graphics/quad-render.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import glslGsplatCopyToWorkBufferPS from '../shader-lib/glsl/chunks/gsplat/frag/gsplatCopyToWorkbuffer.js';
import wgslGsplatCopyToWorkBufferPS from '../shader-lib/wgsl/chunks/gsplat/frag/gsplatCopyToWorkbuffer.js';
import { GSplatNodeCullRenderPass } from './gsplat-node-cull-render-pass.js';
import { GSplatWorkBufferRenderPass } from './gsplat-work-buffer-render-pass.js';
import { GSplatStreams } from '../gsplat/gsplat-streams.js';

let id = 0;
const tmpSize = new Vec2();
const _viewProjMat = new Mat4();
const _frustum = new Frustum();
const _frustumPlanes = new Float32Array(24);

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

        // Derive color format from format's dataColor stream
        // GSPLAT_COLOR_UINT is for WRITING to work buffer when using RGBA16U format
        // (converts float color to packed half-float format)
        const colorStream = format.getStream('dataColor');
        if (colorStream.format === PIXELFORMAT_RGBA16U) {
            clonedDefines.set('GSPLAT_COLOR_UINT', '');
        }

        // when rendering only color (not full MRT)
        if (colorOnly) {
            clonedDefines.set('GSPLAT_COLOR_ONLY', '');
        }

        // Enable ID output when pcId stream exists in format
        if (format.getStream('pcId')) {
            clonedDefines.set('GSPLAT_ID', '');
        }

        // Enable node index output when pcNodeIndex stream exists in format
        if (format.getStream('pcNodeIndex')) {
            clonedDefines.set('GSPLAT_NODE_INDEX', '');
        }

        // Get custom shader chunks from material (for container support)
        const fragmentIncludes = material.hasShaderChunks ?
            (device.isWebGPU ? material.shaderChunks.wgsl : material.shaderChunks.glsl) :
            undefined;

        // Get streams to output - color-only mode uses just dataColor, otherwise all streams
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
     * Color-only render target for updating just the dataColor stream.
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
     * RGBA32F texture storing local-space bounding spheres for all selected nodes
     * across all GSplatInfos. Each texel is (center.x, center.y, center.z, radius).
     * Created lazily on first use and resized as needed.
     *
     * @type {Texture|null}
     */
    boundsSphereTexture = null;

    /**
     * R32U texture mapping each bounds entry to its GSplatInfo index (for transform lookup).
     * Same dimensions as boundsSphereTexture. Created lazily on first use and resized as needed.
     *
     * @type {Texture|null}
     */
    boundsTransformIndexTexture = null;

    /**
     * R32U texture storing per-node visibility as packed bitmasks.
     * Each texel packs 32 visibility bits, so width is boundsSphereTexture.width / 32.
     * Written by the culling render pass.
     *
     * @type {Texture|null}
     */
    nodeVisibilityTexture = null;

    /**
     * Render target wrapping nodeVisibilityTexture for the culling pass.
     *
     * @type {RenderTarget|null}
     */
    cullingRenderTarget = null;

    /**
     * GPU frustum culling render pass. Created lazily on first use.
     *
     * @type {GSplatNodeCullRenderPass|null}
     */
    cullingPass = null;

    /**
     * Total number of bounds entries across all GSplatInfos.
     *
     * @type {number}
     */
    totalBoundsEntries = 0;

    /**
     * RGBA32F texture storing world matrices (3 texels per GSplatInfo, rows of a 4x3
     * affine matrix) for transforming local bounding spheres to world space during
     * GPU frustum culling.
     * Created lazily on first use and resized as needed.
     *
     * @type {Texture|null}
     */
    transformsTexture = null;

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

        // Color-only render target uses just the first texture (dataColor)
        const colorTexture = this.streams.getTexture('dataColor');
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
     * Creates a nearest-filtered, clamp-to-edge texture with no mipmaps.
     *
     * @param {string} name - Debug name for the texture.
     * @param {number} width - Texture width.
     * @param {number} height - Texture height.
     * @param {number} format - Pixel format constant.
     * @returns {Texture} The created texture.
     * @private
     */
    _createTexture(name, width, height, format) {
        return new Texture(this.device, {
            name: name,
            width: width,
            height: height,
            format: format,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
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
        this.boundsSphereTexture?.destroy();
        this.boundsTransformIndexTexture?.destroy();
        this.nodeVisibilityTexture?.destroy();
        this.cullingRenderTarget?.destroy();
        this.cullingPass?.destroy();
        this.transformsTexture?.destroy();
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

    /**
     * Updates the bounds sphere texture with local-space bounding spheres from all GSplatInfos.
     * Assigns boundsBaseIndex to each GSplatInfo and fills the shared RGBA32F texture.
     *
     * @param {GSplatInfo[]} splats - The splats to collect bounds from.
     */
    updateBoundsTexture(splats) {
        // Pass 1: assign base indices and count total entries
        let totalEntries = 0;
        for (let i = 0; i < splats.length; i++) {
            splats[i].boundsBaseIndex = totalEntries;
            totalEntries += splats[i].numBoundsEntries;
        }

        this.totalBoundsEntries = totalEntries;

        if (totalEntries === 0) return;

        // Width is multiple of 32 so that 32 consecutive spheres always land on the same
        // texture row, allowing the bit-packed culling shader to avoid per-iteration modulo/division.
        const { x: width, y: height } = TextureUtils.calcTextureSize(totalEntries, tmpSize, 32);

        // Create/resize bounds sphere texture (RGBA32F: center.xyz, radius)
        if (!this.boundsSphereTexture) {
            this.boundsSphereTexture = this._createTexture('boundsSphereTexture', width, height, PIXELFORMAT_RGBA32F);
        } else {
            this.boundsSphereTexture.resize(width, height);
        }

        // Create/resize transform index texture (R32U: GSplatInfo index per bounds entry)
        if (!this.boundsTransformIndexTexture) {
            this.boundsTransformIndexTexture = this._createTexture('boundsTransformIndexTexture', width, height, PIXELFORMAT_R32U);
        } else {
            this.boundsTransformIndexTexture.resize(width, height);
        }

        const sphereData = this.boundsSphereTexture.lock();
        const indexData = /** @type {Uint32Array} */ (this.boundsTransformIndexTexture.lock());

        // Pass 2: fill both textures
        for (let i = 0; i < splats.length; i++) {
            const base = splats[i].boundsBaseIndex;
            const count = splats[i].numBoundsEntries;

            // Write bounding spheres
            splats[i].writeBoundsSpheres(sphereData, base * 4);

            // Write transform index (all bounds entries for this GSplatInfo point to transform i)
            for (let j = 0; j < count; j++) {
                indexData[base + j] = i;
            }
        }

        this.boundsSphereTexture.unlock();
        this.boundsTransformIndexTexture.unlock();
    }

    /**
     * Updates the transforms texture with world matrices for each GSplatInfo.
     * Each matrix uses 3 texels (RGBA32F per row) in the texture.
     *
     * @param {GSplatInfo[]} splats - The splats to collect transforms from.
     */
    updateTransformsTexture(splats) {
        const numMatrices = splats.length;
        if (numMatrices === 0) return;

        // 3 texels per matrix (rows of a 4x3 affine matrix). Width is a multiple of 3 so all 3
        // texels of a matrix always land on the same texture row.
        const totalTexels = numMatrices * 3;
        const { x: width, y: height } = TextureUtils.calcTextureSize(totalTexels, tmpSize, 3);

        if (!this.transformsTexture) {
            this.transformsTexture = this._createTexture('transformsTexture', width, height, PIXELFORMAT_RGBA32F);
        } else {
            this.transformsTexture.resize(width, height);
        }

        const data = this.transformsTexture.lock();

        // Write world matrices as 3 rows of a 4x3 matrix (row-major, 12 floats per matrix).
        // Mat4.data is column-major: [col0(4), col1(4), col2(4), col3(4)].
        // We store 3 rows, each as (Rx, Ry, Rz, T):
        //   row0 = data[0], data[4], data[8],  data[12]
        //   row1 = data[1], data[5], data[9],  data[13]
        //   row2 = data[2], data[6], data[10], data[14]
        // The shader reconstructs the mat4 by transposing + appending (0,0,0,1).
        let offset = 0;
        for (let i = 0; i < splats.length; i++) {
            const m = splats[i].node.getWorldTransform().data;
            // row 0
            data[offset++] = m[0]; data[offset++] = m[4]; data[offset++] = m[8]; data[offset++] = m[12];
            // row 1
            data[offset++] = m[1]; data[offset++] = m[5]; data[offset++] = m[9]; data[offset++] = m[13];
            // row 2
            data[offset++] = m[2]; data[offset++] = m[6]; data[offset++] = m[10]; data[offset++] = m[14];
        }

        this.transformsTexture.unlock();
    }

    /**
     * Runs the GPU frustum culling pass to generate the node visibility texture.
     * Computes the view-projection matrix, extracts frustum planes, and tests each
     * bounding sphere against them.
     *
     * @param {Mat4} projectionMatrix - The camera projection matrix.
     * @param {Mat4} viewMatrix - The camera view matrix.
     */
    updateNodeVisibility(projectionMatrix, viewMatrix) {
        if (this.totalBoundsEntries === 0 || !this.boundsSphereTexture || !this.boundsTransformIndexTexture || !this.transformsTexture) {
            return;
        }

        // Compute view-projection matrix and extract frustum planes
        _viewProjMat.mul2(projectionMatrix, viewMatrix);
        _frustum.setFromMat4(_viewProjMat);
        for (let p = 0; p < 6; p++) {
            const plane = _frustum.planes[p];
            _frustumPlanes[p * 4 + 0] = plane.normal.x;
            _frustumPlanes[p * 4 + 1] = plane.normal.y;
            _frustumPlanes[p * 4 + 2] = plane.normal.z;
            _frustumPlanes[p * 4 + 3] = plane.distance;
        }

        // Visibility texture is 32x smaller: each texel stores 32 sphere results as bits.
        // Since boundsTextureWidth is a multiple of 32, the visibility texture is exactly
        // (boundsWidth/32) x boundsHeight, keeping a 1:1 row correspondence and allowing
        // the shader to derive visWidth = boundsTextureWidth / 32 without extra uniforms.
        const width = this.boundsSphereTexture.width / 32;
        const height = this.boundsSphereTexture.height;

        // Create/resize visibility texture (R32U: bit-packed, 32 spheres per texel)
        if (!this.nodeVisibilityTexture) {
            this.nodeVisibilityTexture = this._createTexture('nodeVisibilityTexture', width, height, PIXELFORMAT_R32U);

            this.cullingRenderTarget = new RenderTarget({
                name: 'NodeCullingRT',
                colorBuffer: this.nodeVisibilityTexture,
                depth: false
            });
        } else if (this.nodeVisibilityTexture.width !== width || this.nodeVisibilityTexture.height !== height) {
            this.nodeVisibilityTexture.resize(width, height);
            /** @type {RenderTarget} */ (this.cullingRenderTarget).resize(width, height);
        }

        // Lazily create the culling render pass
        if (!this.cullingPass) {
            this.cullingPass = new GSplatNodeCullRenderPass(this.device);
            this.cullingPass.init(this.cullingRenderTarget);
            this.cullingPass.colorOps.clear = true;
            this.cullingPass.colorOps.clearValue.set(0, 0, 0, 0);
        }

        // Set up uniforms and execute
        this.cullingPass.setup(
            this.boundsSphereTexture,
            this.boundsTransformIndexTexture,
            this.transformsTexture,
            this.totalBoundsEntries,
            _frustumPlanes
        );

        this.cullingPass.render();
    }
}

export { GSplatWorkBuffer, WorkBufferRenderInfo };
