import { TRACEID_RENDER_QUEUE } from '../../../core/constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';
import { warnInsecureContext } from '../../../core/secure-context-warning.js';
import {
    PIXELFORMAT_RGBA8, PIXELFORMAT_BGRA8, DEVICETYPE_WEBGPU,
    BUFFERUSAGE_READ, BUFFERUSAGE_COPY_DST, semanticToLocation,
    PIXELFORMAT_SRGBA8, DISPLAYFORMAT_LDR_SRGB, PIXELFORMAT_SBGRA8, DISPLAYFORMAT_HDR,
    PIXELFORMAT_RGBA16F, UNUSED_UNIFORM_NAME, BUFFERUSAGE_INDIRECT, BINDGROUP_VIEW
} from '../constants.js';
import { BindGroupFormat } from '../bind-group-format.js';
import { BindGroup } from '../bind-group.js';
import { DebugGraphics } from '../debug-graphics.js';
import { GraphicsDevice } from '../graphics-device.js';
import { getPrimitiveCount } from '../primitive-utils.js';
import { RenderTarget } from '../render-target.js';
import { StencilParameters } from '../stencil-parameters.js';
import { WebgpuBindGroup } from './webgpu-bind-group.js';
import { WebgpuBindGroupFormat } from './webgpu-bind-group-format.js';
import { WebgpuIndexBuffer } from './webgpu-index-buffer.js';
import { WebgpuRenderPipeline } from './webgpu-render-pipeline.js';
import { WebgpuComputePipeline } from './webgpu-compute-pipeline.js';
import { WebgpuRenderTarget } from './webgpu-render-target.js';
import { WebgpuShader } from './webgpu-shader.js';
import { WebgpuTexture } from './webgpu-texture.js';
import { WebgpuUniformBuffer } from './webgpu-uniform-buffer.js';
import { WebgpuVertexBuffer } from './webgpu-vertex-buffer.js';
import { WebgpuClearRenderer } from './webgpu-clear-renderer.js';
import { WebgpuMipmapRenderer } from './webgpu-mipmap-renderer.js';
import { WebgpuDebug } from './webgpu-debug.js';
import { WebgpuDynamicBuffers } from './webgpu-dynamic-buffers.js';
import { WebgpuGpuProfiler } from './webgpu-gpu-profiler.js';
import { WebgpuResolver } from './webgpu-resolver.js';
import { WebgpuCompute } from './webgpu-compute.js';
import { WebgpuBuffer } from './webgpu-buffer.js';
import { StorageBuffer } from '../storage-buffer.js';
import { WebgpuDrawCommands } from './webgpu-draw-commands.js';
import { WebgpuUploadStream } from './webgpu-upload-stream.js';
import { WebgpuXrBridge } from './webgpu-xr-bridge.js';

/**
 * @import { RenderPass } from '../render-pass.js'
 * @import { Shader } from '../shader.js'
 * @import { Texture } from '../texture.js'
 */

// #if _DEBUG
const _uniqueLocations = new Map();
// #endif

// size of indirect draw entry in bytes, 5 x 32bit
const _indirectEntryByteSize = 5 * 4;

// size of indirect dispatch entry in bytes, 3 x 32bit (x, y, z workgroup counts)
const _indirectDispatchEntryByteSize = 3 * 4;

// WebGPU color formats a swapchain or WebXR projection layer can present, mapped to the matching
// engine PIXELFORMAT_* constant. Used to align device.backBufferFormat with the color format the
// WebXR runtime actually renders into while immersive (see WebgpuGraphicsDevice#setXrBackBufferFormat).
const _gpuFormatToPixelFormat = {
    'rgba8unorm': PIXELFORMAT_RGBA8,
    'rgba8unorm-srgb': PIXELFORMAT_SRGBA8,
    'bgra8unorm': PIXELFORMAT_BGRA8,
    'bgra8unorm-srgb': PIXELFORMAT_SBGRA8,
    'rgba16float': PIXELFORMAT_RGBA16F
};

class WebgpuGraphicsDevice extends GraphicsDevice {
    /**
     * Array of GPU resources pending destruction. Resources are destroyed after the current
     * command buffers are submitted to ensure they're not in use.
     *
     * @type {Array<GPUTexture|GPUBuffer|GPUQuerySet>}
     * @private
     */
    _deferredDestroys = [];

    /**
     * @type {GPUAdapter|null}
     * @private
     */
    gpuAdapter = null;

    /**
     * @type {GPUDevice|null}
     * @private
     */
    wgpu = null;

    /**
     * True when this graphics device owns {@link WebgpuGraphicsDevice#wgpu} and so destroys it and
     * recovers from its loss. Cleared by {@link WebgpuGraphicsDevice#initFromGpuDevice} when a host
     * supplies the device and keeps both jobs.
     *
     * @type {boolean}
     * @private
     */
    _ownsGpuDevice = true;

    /**
     * Listener for uncaptured errors registered on {@link WebgpuGraphicsDevice#wgpu}, removed on
     * destroy.
     *
     * @type {((event: GPUUncapturedErrorEvent) => void)|null}
     * @private
     */
    _uncapturedErrorHandler = null;

    /**
     * Configuration of the canvas textures returned by getCurrentTexture.
     *
     * @type {GPUCanvasConfiguration|null}
     * @private
     */
    canvasConfig = null;

    /**
     * Strong references used for device recovery. Owners must explicitly destroy bind groups
     * when no longer needed to unregister them.
     *
     * @type {Set<WebgpuBindGroup>}
     * @private
     */
    _bindGroups = new Set();

    /**
     * Strong references used for device recovery. Owners must explicitly destroy bind group
     * formats when no longer needed to unregister them.
     *
     * @type {Set<WebgpuBindGroupFormat>}
     * @private
     */
    _bindGroupFormats = new Set();

    /**
     * Strong references used to restore compute pipelines. Owners must explicitly destroy
     * compute instances when no longer needed to unregister them.
     *
     * @type {Set<WebgpuCompute>}
     * @private
     */
    _computes = new Set();

    /**
     * Strong references used to restore CPU-authored draw commands. Owners must explicitly
     * destroy draw commands when no longer needed to unregister them.
     *
     * @type {Set<WebgpuDrawCommands>}
     * @private
     */
    _drawCommands = new Set();

    /**
     * Object responsible for caching and creation of render pipelines.
     */
    renderPipeline = new WebgpuRenderPipeline(this);

    /**
     * Object responsible for caching and creation of compute pipelines.
     */
    computePipeline = new WebgpuComputePipeline(this);

    /**
     * Buffer used to store arguments for indirect draw calls.
     *
     * @type {StorageBuffer|null}
     * @private
     */
    _indirectDrawBuffer = null;

    /**
     * Number of indirect draw slots allocated.
     *
     * @private
     */
    _indirectDrawBufferCount = 0;

    /**
     * Next unused index in indirectDrawBuffer.
     *
     * @private
     */
    _indirectDrawNextIndex = 0;

    /**
     * Buffer used to store arguments for indirect dispatch calls.
     *
     * @type {StorageBuffer|null}
     * @private
     */
    _indirectDispatchBuffer = null;

    /**
     * Number of indirect dispatch slots allocated.
     *
     * @private
     */
    _indirectDispatchBufferCount = 0;

    /**
     * Next unused index in indirectDispatchBuffer.
     *
     * @private
     */
    _indirectDispatchNextIndex = 0;

    /**
     * Object responsible for clearing the rendering surface by rendering a quad.
     *
     * @type { WebgpuClearRenderer }
     */
    clearRenderer;

    /**
     * Object responsible for mipmap generation.
     *
     * @type { WebgpuMipmapRenderer }
     */
    mipmapRenderer;

    /**
     * Render pipeline currently set on the device.
     *
     * @type {GPURenderPipeline|null}
     * @private
     */
    pipeline = null;

    /**
     * True when a render state the render pipeline depends on has changed since the pipeline was
     * last looked up, see {@link WebgpuGraphicsDevice#draw}. The setters raise it only when a
     * value actually changes, so a run of draws with the same state reuses the pipeline without
     * building and hashing its key.
     *
     * @type {boolean}
     * @private
     */
    _pipelineDirty = true;

    /**
     * The per-draw inputs of the render pipeline, as of its last lookup - these are arguments of
     * the draw rather than device state, so they are compared on each draw. Vertex formats are
     * compared by their rendering hash, as meshes of the same layout have distinct formats.
     *
     * @private
     */
    _pipelinePrimitiveType = -1;

    /** @private */
    _pipelineVertexHash0 = -1;

    /** @private */
    _pipelineVertexHash1 = -1;

    /**
     * The index format of a strip topology, which is the only one the pipeline depends on, or -1.
     *
     * @private
     */
    _pipelineIndexFormat = -1;

    /**
     * The GPU buffer bound to each vertex buffer slot in the current render pass, and the offset
     * it is bound at. WebGPU keeps the vertex and index buffers bound across draws and pipeline
     * changes for the whole pass, so a draw binds only what differs from the previous one - the
     * draws of a mesh in a row bind its buffers once. Cleared at the start of each pass.
     *
     * @type {GPUBuffer[]}
     * @private
     */
    _boundVertexBuffers = [];

    /**
     * @type {number[]}
     * @private
     */
    _boundVertexOffsets = [];

    /**
     * The GPU buffer bound as the index buffer in the current render pass, and its format.
     *
     * @type {GPUBuffer|null}
     * @private
     */
    _boundIndexBuffer = null;

    /**
     * @type {GPUIndexFormat|null}
     * @private
     */
    _boundIndexFormat = null;

    /**
     * An array of bind group formats, based on currently assigned bind groups
     *
     * @type {WebgpuBindGroupFormat[]}
     */
    bindGroupFormats = [];

    /**
     * An empty bind group, used when the draw call is using a typical bind group layout based on
     * BINDGROUP_*** constants but some bind groups are not needed, for example clear renderer.
     *
     * @type {BindGroup}
     */
    emptyBindGroup;

    /**
     * Monotonically increasing counter incremented each time queue.submit() is called.
     *
     * @ignore
     */
    submitVersion = 0;

    /**
     * Canvas-derived backbuffer pixel format ({@link GraphicsDevice#backBufferFormat}), captured once
     * the swapchain is configured. While immersive, {@link backBufferFormat} is temporarily overridden
     * with the WebXR projection-layer format; this is the value {@link _clearXrState} restores to.
     *
     * @type {number|undefined}
     * @private
     */
    _canvasBackBufferFormat;

    /**
     * When set, immersive XR writes color to this texture instead of the canvas swapchain.
     * @type {any} // `GPUTexture | null`; using `any` to avoid exporting WebGPU types in published typings.
     * @ignore
     */
    xrColorTexture = null;

    /**
     * View format of {@link WebgpuGraphicsDevice#xrColorTexture} for render pass attachment views.
     * @type {any} // `GPUTextureFormat | null`; using `any` to avoid exporting WebGPU types in published typings.
     * @ignore
     */
    xrColorTextureViewFormat = null;

    /**
     * Optional `GPUTextureViewDescriptor` describing how the framebuffer's color attachment view
     * should be created from {@link WebgpuGraphicsDevice#xrColorTexture}. Used to pick the right
     * array layer / mip when XR provides a layered (texture array) projection layer. Set per eye
     * by {@link FramePassMultiView}; cleared back to `null` outside the per-view loop.
     *
     * @type {any} // `GPUTextureViewDescriptor | null`; using `any` to avoid exporting WebGPU types in published typings.
     * @ignore
     */
    xrColorTextureViewDescriptor = null;

    /**
     * Per-view XR sub-image entries populated each frame by the WebGPU XR bridge. Each entry
     * describes one XR view: the underlying GPU color texture, the view descriptor that selects the
     * right slice, the viewport, and the view's GPU format. Empty outside immersive WebGPU XR.
     *
     * @type {{ colorTexture: any, viewDescriptor: any, viewport: any, viewFormat: any }[]}
     * @ignore
     */
    xrSubImages = [];

    /**
     * Active XR view index for the multi-view rendering wrapper, or `-1` when not iterating views.
     * Read by the forward renderer's per-view inner loop to render only the active eye.
     *
     * @type {number}
     * @ignore
     */
    xrCurrentViewIndex = -1;

    /**
     * When set, used as the main color attachment in {@link WebgpuGraphicsDevice#frameStart} if there is
     * no XR color texture and no canvas {@link GPUCanvasContext#getCurrentTexture} (for example headless
     * or custom-surface hosts). Must be a WebGPU-backed {@link Texture}; {@link Texture#impl} must expose
     * {@link WebgpuTexture#gpuTexture}.
     *
     * @type {Texture|null}
     * @ignore
     */
    externalBackbuffer = null;

    /**
     * Current command buffer encoder.
     *
     * @type {GPUCommandEncoder|null}
     * @private
     */
    commandEncoder = null;

    /**
     * Command buffers scheduled for execution on the GPU.
     *
     * @type {GPUCommandBuffer[]}
     * @private
     */
    commandBuffers = [];

    /**
     * @type {GPUSupportedLimits}
     * @private
     */
    limits;

    /** GLSL to SPIR-V transpiler */
    glslang = null;

    /** SPIR-V to WGSL transpiler */
    twgsl = null;

    constructor(canvas, options = {}) {
        super(canvas, options);
        options = this.initOptions;

        this.backBufferAntialias = options.antialias ?? false;
        this.isWebGPU = true;
        this._deviceType = DEVICETYPE_WEBGPU;
        this.featureLevel = options.featureLevel;

        this.scope.resolve(UNUSED_UNIFORM_NAME).setValue(0);
    }

    /**
     * @param {Map<string, number>} counts - Receives current tracked resource counts.
     * @ignore
     */
    getResourceCounts(counts) {
        super.getResourceCounts(counts);
        counts.set('bindGroups', this._bindGroups.size);
        counts.set('bindGroupFormats', this._bindGroupFormats.size);
        counts.set('computes', this._computes.size);
        counts.set('drawCommands', this._drawCommands.size);
        let renderPipelines = 0;
        let computePipelines = 0;
        // Hash collisions share a cache bucket, so Map.size is not the pipeline count.
        for (const bucket of this.renderPipeline.cache.values()) renderPipelines += bucket.length;
        for (const bucket of this.computePipeline.cache.values()) computePipelines += bucket.length;
        counts.set('renderPipelines', renderPipelines);
        counts.set('computePipelines', computePipelines);
    }

    /**
     * Destroy the graphics device.
     */
    destroy() {

        this.destroyDeviceResources();

        this._clearXrState();
        this.externalBackbuffer = null;

        super.destroy();

        // Destroy listeners can enqueue more resources, and no further submit will drain them.
        this.destroyDeferredResources();
        this.clearDeviceState();

        this._bindGroups.clear();
        this._bindGroupFormats.clear();
        this._computes.clear();
        this._drawCommands.clear();

        this.gpuContext?.unconfigure();

        if (this._uncapturedErrorHandler) {
            this.wgpu?.removeEventListener?.('uncapturederror', this._uncapturedErrorHandler);
            this._uncapturedErrorHandler = null;
        }

        // a device supplied by the host is the host's to destroy
        if (this._ownsGpuDevice) {
            this.wgpu?.destroy();
        }
        this.wgpu = null;
        this.gpuAdapter = null;
        this.gpuContext = null;
        this.canvasConfig = null;
    }

    /** @private */
    destroyDeviceResources() {

        this.clearRenderer?.destroy();
        this.clearRenderer = null;

        this.mipmapRenderer?.destroy();
        this.mipmapRenderer = null;

        this.resolver?.destroy();
        this.resolver = null;

        this.quadVertexBuffer?.destroy();
        this.quadVertexBuffer = null;
        this.quadIndexBuffer?.destroy();
        this.quadIndexBuffer = null;
        this.emptyBindGroup?.format.destroy();
        this.emptyBindGroup?.destroy();
        this.emptyBindGroup = null;
        this.dynamicBuffers?.destroy();
        this.dynamicBuffers = null;
        this.gpuProfiler?.destroy();
        this.gpuProfiler = null;
        this.backBuffer?.destroy();
        this.backBuffer = null;
    }

    /**
     * Reset all per-frame WebGPU XR render state to its inactive defaults. Called by the XR bridge
     * at the start of each beginFrame and on session teardown, and by the graphics device on destroy.
     *
     * @ignore
     */
    _clearXrState() {
        this.xrColorTexture = null;
        this.xrColorTextureViewFormat = null;
        this.xrColorTextureViewDescriptor = null;
        this.xrSubImages.length = 0;
        this.xrCurrentViewIndex = -1;

        // restore the canvas-derived backbuffer format that immersive rendering temporarily overrode
        if (this._canvasBackBufferFormat !== undefined) {
            this.backBufferFormat = this._canvasBackBufferFormat;
        }
    }

    /**
     * Override {@link backBufferFormat} with the color format of the active WebXR projection layer,
     * so engine systems that key off the backbuffer format - notably {@link RenderTarget#isColorBufferSrgb}
     * (which drives output gamma correction in the forward renderer and compose pass) and scene
     * color-grab - stay consistent with the texture the XR runtime renders into. The view format is
     * used (rather than the raw projection-layer color format) because it carries the runtime's per-eye
     * sRGB reinterpretation, which is what actually determines hardware gamma encoding on write.
     * Reverts to the canvas-derived format in {@link _clearXrState}. No-op for unrecognized formats.
     *
     * @param {any} viewFormat - WebGPU color view format of the XR projection layer (`GPUTextureFormat`).
     * @ignore
     */
    setXrBackBufferFormat(viewFormat) {
        const format = _gpuFormatToPixelFormat[viewFormat];
        if (format !== undefined) {
            this.backBufferFormat = format;
        }
    }

    initDeviceCaps() {

        const limits = this.wgpu?.limits;
        this.limits = limits;

        this.precision = 'highp';
        this.maxPrecision = 'highp';
        this.maxSamples = 4;
        this.maxTextures = limits.maxSampledTexturesPerShaderStage;
        this.maxTextureSize = limits.maxTextureDimension2D;
        this.maxCubeMapSize = limits.maxTextureDimension2D;
        this.maxVolumeSize = limits.maxTextureDimension3D;
        this.maxColorAttachments = limits.maxColorAttachments;
        this.maxPixelRatio = 1;
        this.maxAnisotropy = 16;
        this.fragmentUniformsCount = limits.maxUniformBufferBindingSize / 16;
        this.vertexUniformsCount = limits.maxUniformBufferBindingSize / 16;
        this.usesMeshBindGroups = true;
        this.supportsAreaLights = true;
        this.supportsGpuParticles = true;
        this.supportsCompute = true;
        this.supportsIndirectDraw = true;
        this.textureFloatRenderable = true;
        this.textureHalfFloatRenderable = true;
        // ImageBitmap decoding is used for texture loading when the host provides it (browsers and
        // workers do, headless hosts such as Node do not)
        this.supportsImageBitmap = typeof createImageBitmap === 'function';

        // WebGPU specifies the blend state per color target, and so this is always supported
        this.supportsIndependentBlending = true;

        // WebGPU currently only supports 1 and 4 samples
        this.samples = this.backBufferAntialias ? 4 : 1;

        // WGSL features
        const wgslFeatures = window.navigator.gpu.wgslLanguageFeatures;
        this.supportsStorageTextureRead = wgslFeatures?.has('readonly_and_readwrite_storage_textures');
        this.supportsSubgroupUniformity = wgslFeatures?.has('subgroup_uniformity');
        this.supportsSubgroupId = wgslFeatures?.has('subgroup_id');
        this.supportsLinearIndexing = wgslFeatures?.has('linear_indexing');
        this.supportsUnrestrictedPointerParameters = wgslFeatures?.has('unrestricted_pointer_parameters');
        this.supportsPointerCompositeAccess = wgslFeatures?.has('pointer_composite_access');
        this.supportsPacked4x8IntegerDotProduct = wgslFeatures?.has('packed_4x8_integer_dot_product');
        this.supportsTextureAndSamplerLet = wgslFeatures?.has('texture_and_sampler_let');

        this.initCapsDefines();
    }

    async initWebGpu(glslangUrl, twgslUrl) {

        if (!window.navigator.gpu) {
            warnInsecureContext('WebGPU');
            throw new Error('Unable to retrieve GPU. Ensure you are using a browser that supports WebGPU rendering.');
        }

        // temporary message to confirm Webgpu is being used
        Debug.log('WebgpuGraphicsDevice initialization ..');

        // Import shader transpilers only if both URLs are provided
        if (glslangUrl && twgslUrl) {

            // build a full URL from a relative or absolute path
            const baseUrl = window.document?.baseURI ?? window.location.href;
            const buildUrl = (srcPath) => {
                return new URL(srcPath, baseUrl).toString();
            };
            const twgslScriptUrl = buildUrl(twgslUrl);
            const twgslWasmUrl = buildUrl(twgslUrl.replace('.js', '.wasm'));
            const glslangScriptUrl = buildUrl(glslangUrl);

            const results = await Promise.all([
                import(`${twgslScriptUrl}`).then(() => twgsl(twgslWasmUrl)),
                import(`${glslangScriptUrl}`).then(module => module.default())
            ]);

            this.twgsl = results[0];
            this.glslang = results[1];
        }

        // create the device
        return this.createDevice();
    }

    async createDevice() {

        if (this._destroyed) {
            return null;
        }

        /** @type {GPURequestAdapterOptions} */
        const adapterOptions = {
            powerPreference: this.initOptions.powerPreference !== 'default' ? this.initOptions.powerPreference : undefined,

            // Required for WebXR sessions using WebGPU
            xrCompatible: !!this.initOptions.xrCompatible
        };

        const gpuAdapter = await window.navigator.gpu.requestAdapter(adapterOptions);
        if (this._destroyed) {
            return null;
        }

        // Imagination PowerVR GPUs (Pixel 10 / Tensor G5) have buggy WebGPU drivers (broken
        // compute, shader miscompiles), so fail device creation here to let createGraphicsDevice
        // fall back to WebGL2. Remove when fixed: https://github.com/playcanvas/engine/issues/8874
        if (gpuAdapter?.info?.vendor === 'img-tec') {
            Debug.warn('WebGPU is disabled on Imagination PowerVR GPUs due to driver issues, falling back to WebGL2. See https://github.com/playcanvas/engine/issues/8874');
            return null;
        }

        const bare = this.initOptions.featureLevel === 'bare';

        // request the optional features the adapter supports (none in bare mode, to simulate the
        // most constrained device). The capabilities are set again from the created device.
        const requiredFeatures = bare ? [] : this._applyFeatures(gpuAdapter.features);

        // copy all adapter limits to the requiredLimits object (skipped for bare mode to use spec defaults)
        const requiredLimits = {};
        if (!bare) {
            const adapterLimits = gpuAdapter?.limits;
            if (adapterLimits) {
                for (const limitName in adapterLimits) {
                    // subgroup sizes are exposed via GPUAdapterInfo, not as requestable limits - some
                    // implementations (e.g. Windows Chrome) still surface them here and reject them in
                    // requiredLimits, so skip them
                    if (limitName === 'minSubgroupSize' || limitName === 'maxSubgroupSize') {
                        continue;
                    }
                    requiredLimits[limitName] = adapterLimits[limitName];
                }
            }
        }

        /** @type {GPUDeviceDescriptor} */
        const deviceDescr = {
            requiredFeatures,
            requiredLimits,

            defaultQueue: {
                label: 'Default Queue'
            }
        };

        DebugHelper.setLabel(deviceDescr, 'PlayCanvasWebGPUDevice');

        const wgpu = await gpuAdapter.requestDevice(deviceDescr);
        // Teardown can finish while the request is pending. Do not revive the device or its resources.
        if (this._destroyed) {
            wgpu.destroy();
            return null;
        }

        return this.initFromGpuDevice(gpuAdapter, wgpu, true);
    }

    /**
     * Sets the capability flags from a set of WebGPU features and returns the names of the optional
     * features the engine uses that the set contains. Called with the adapter's features to build
     * the device request, and with the created device's features to derive the final capabilities.
     *
     * @param {GPUSupportedFeatures} features - The features to derive the capabilities from.
     * @returns {string[]} The optional features the engine uses that are present in the set.
     * @private
     */
    _applyFeatures(features) {
        const supported = [];
        const has = (feature) => {
            const present = features.has(feature);
            if (present) {
                supported.push(feature);
            }
            return present;
        };
        this.textureFloatFilterable = has('float32-filterable');
        this.textureFloatBlendable = has('float32-blendable');
        this.extCompressedTextureS3TC = has('texture-compression-bc');
        this.extCompressedTextureS3TCSliced3D = has('texture-compression-bc-sliced-3d');
        this.extCompressedTextureETC = has('texture-compression-etc2');
        this.extCompressedTextureASTC = has('texture-compression-astc');
        this.extCompressedTextureASTCSliced3D = has('texture-compression-astc-sliced-3d');
        this.supportsTimestampQuery = has('timestamp-query');
        this.supportsDepthClip = has('depth-clip-control');
        this.supportsDepth32Stencil = has('depth32float-stencil8');
        this.supportsIndirectFirstInstance = has('indirect-first-instance');
        this.supportsShaderF16 = has('shader-f16');
        this.supportsStorageRGBA8 = has('bgra8unorm-storage');
        this.textureRG11B10Renderable = has('rg11b10ufloat-renderable');
        this.supportsClipDistances = has('clip-distances');
        this.supportsDualSourceBlending = has('dual-source-blending');
        this.supportsTextureFormatsTier1 = has('texture-formats-tier1');
        this.supportsTextureFormatsTier2 = has('texture-formats-tier2');
        this.supportsTextureFormatsTier1 ||= this.supportsTextureFormatsTier2;
        this.supportsPrimitiveIndex = has('primitive-index');
        this.supportsSubgroups = has('subgroups');
        this.supportsSubgroupSizeControl = has('subgroup-size-control');
        return supported;
    }

    /**
     * Initializes this graphics device on an already created WebGPU device: derives the
     * capabilities from the features the device was created with, configures the canvas and
     * allocates the internal resources. Called by {@link WebgpuGraphicsDevice#createDevice}, and
     * usable by a host that acquires the adapter and device itself, such as a headless test
     * harness, in place of {@link WebgpuGraphicsDevice#initWebGpu}.
     *
     * @param {GPUAdapter|null} gpuAdapter - The adapter the device was created from, used for its
     * info (vendor, architecture, subgroup sizes).
     * @param {GPUDevice} wgpu - The WebGPU device.
     * @param {boolean} [ownsGpuDevice] - True when this graphics device owns the WebGPU device: it
     * then destroys it on {@link WebgpuGraphicsDevice#destroy} and recovers from its loss. A host
     * that supplies the device keeps both responsibilities. Defaults to false.
     * @returns {this} The initialized graphics device.
     * @private
     */
    initFromGpuDevice(gpuAdapter, wgpu, ownsGpuDevice = false) {

        this.gpuAdapter = gpuAdapter;
        this.wgpu = wgpu;
        this._ownsGpuDevice = ownsGpuDevice;

        // capabilities derived from the features the device was created with
        const enabledFeatures = this._applyFeatures(wgpu.features);
        this.maxSubgroupSize = gpuAdapter?.info?.subgroupMaxSize ?? 0;
        this.minSubgroupSize = gpuAdapter?.info?.subgroupMinSize ?? 0;

        const wgslFeatureNames = window.navigator.gpu.wgslLanguageFeatures ?
            Array.from(window.navigator.gpu.wgslLanguageFeatures) : [];
        Debug.log(
            `WEBGPU${gpuAdapter?.info ?
                ` (${gpuAdapter.info.vendor || '?'} / ${gpuAdapter.info.architecture || gpuAdapter.info.device || '?'})` :
                ''
            } features [${this.initOptions.featureLevel === 'bare' ? 'bare' : 'full'}]: ${enabledFeatures.join(', ') || 'none'}, wgslFeatures(${wgslFeatureNames.join(', ') || 'none'})`
        );

        // HTML-in-Canvas support (copyElementImageToTexture)
        this.supportsHtmlTextures = typeof this.wgpu.queue?.copyElementImageToTexture === 'function';

        // transient (memoryless) attachment support (GPUTextureUsage.TRANSIENT_ATTACHMENT)
        this.supportsTransientAttachments = typeof GPUTextureUsage !== 'undefined' && 'TRANSIENT_ATTACHMENT' in GPUTextureUsage;

        // handle lost device (a host that supplied the device handles its loss)
        if (ownsGpuDevice) {
            this.wgpu.lost?.then(this.handleDeviceLost.bind(this));
        }

        // surface any uncaptured WebGPU errors
        this._uncapturedErrorHandler = (ev) => {
            const e = /** @type {any} */ (ev).error;
            Debug.error(`WebGPU uncaptured ${e?.constructor?.name ?? 'Error'}: ${e?.message ?? e}`);
        };
        this.wgpu.addEventListener?.('uncapturederror', this._uncapturedErrorHandler);

        this.initDeviceCaps();

        this.gpuContext = this.canvas.getContext('webgpu');

        // tonemapping, used when the backbuffer is HDR
        let canvasToneMapping = 'standard';

        // pixel format of the framebuffer that is the most efficient one on the system
        let preferredCanvasFormat = window.navigator.gpu.getPreferredCanvasFormat();

        // display format the user asked for
        const displayFormat = this.initOptions.displayFormat;

        // combine requested display format with the preferred format
        this.backBufferFormat = preferredCanvasFormat === 'rgba8unorm' ?
            (displayFormat === DISPLAYFORMAT_LDR_SRGB ? PIXELFORMAT_SRGBA8 : PIXELFORMAT_RGBA8) :  // (S)RGBA
            (displayFormat === DISPLAYFORMAT_LDR_SRGB ? PIXELFORMAT_SBGRA8 : PIXELFORMAT_BGRA8);   // (S)BGRA

        // view format for the backbuffer. Backbuffer is always allocated without srgb conversion, and
        // the view we create specifies srgb is needed to handle the conversion.
        this.backBufferViewFormat = displayFormat === DISPLAYFORMAT_LDR_SRGB ? `${preferredCanvasFormat}-srgb` : preferredCanvasFormat;

        // optional HDR display format
        if (displayFormat === DISPLAYFORMAT_HDR && this.textureFloatFilterable) {

            // if supported by the system
            const hdrMediaQuery = window.matchMedia('(dynamic-range: high)');
            if (hdrMediaQuery?.matches) {

                // configure the backbuffer to be 16 bit float
                this.backBufferFormat = PIXELFORMAT_RGBA16F;
                this.backBufferViewFormat = 'rgba16float';
                preferredCanvasFormat = 'rgba16float';
                this.isHdr = true;

                // use extended tonemapping for HDR to avoid clipping
                canvasToneMapping = 'extended';
            }
        }

        this.canvasConfig = {
            device: this.wgpu,
            colorSpace: 'srgb',
            alphaMode: this.initOptions.alpha ? 'premultiplied' : 'opaque',

            // use preferred format for optimal performance on mobile
            format: preferredCanvasFormat,

            toneMapping: { mode: canvasToneMapping },

            // RENDER_ATTACHMENT is required, COPY_SRC allows scene grab to copy out from it
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,

            // formats that views created from textures returned by getCurrentTexture may use
            // (this allows us to view the preferred format as srgb)
            viewFormats: displayFormat === DISPLAYFORMAT_LDR_SRGB ? [this.backBufferViewFormat] : []
        };
        this.gpuContext?.configure(this.canvasConfig);

        // remember the canvas-derived backbuffer format so it can be restored after an immersive XR
        // session, which temporarily overrides backBufferFormat with the projection-layer format
        this._canvasBackBufferFormat = this.backBufferFormat;

        this.createBackbuffer();

        this.clearRenderer = new WebgpuClearRenderer(this);
        this.mipmapRenderer = new WebgpuMipmapRenderer(this);
        this.resolver = new WebgpuResolver(this);

        this.postInit();

        return this;
    }

    // #if _DEBUG
    /**
     * @type {(() => Promise<void>) | null}
     * @private
     */
    _debugRestoreDelay = null;
    // #endif

    /** @ignore */
    debugLoseContext(delay = 100) {
        Debug.call(() => {
            if (this._destroyed || this.contextLost || this._debugRestoreDelay) {
                return;
            }

            // Distinguish this deliberate loss from normal device destruction. Start the timer
            // in the loss handler so the application stops rendering throughout the delay.
            this._debugRestoreDelay = () => new Promise((resolve) => {
                setTimeout(resolve, delay);
            });
            // destroy() detaches mapped buffers immediately, before the asynchronous lost
            // notification. Stop subsequent frames from allocating out of those buffers.
            this.contextLost = true;
            this.wgpu.destroy();
        });
    }

    async handleDeviceLost(info) {
        let recover = info.reason !== 'destroyed';
        Debug.call(() => {
            recover ||= !!this._debugRestoreDelay;
        });

        // reason is 'destroyed' if we intentionally destroy the device
        if (recover && !this._destroyed) {
            Debug.warn(`WebGPU device was lost: ${info.message}, this needs to be handled`);

            const profilerEnabled = this.gpuProfiler.enabled;
            this.loseContext();
            this.fire('devicelost');

            let restoreDelay;
            Debug.call(() => {
                restoreDelay = this._debugRestoreDelay?.();
                this._debugRestoreDelay = null;
            });
            if (restoreDelay) {
                await restoreDelay;
            }
            if (this._destroyed) {
                return;
            }

            await this.createDevice(); // Recreate the WebGPU device and associated resources after device loss.

            if (this._destroyed) {
                return;
            }

            this.restoreContext();
            this.gpuProfiler.enabled = profilerEnabled;
            this.fire('devicerestored');
        }
    }

    /** @private */
    clearDeviceState() {
        // Recorded commands and cached pipelines cannot outlive their native device.
        this.commandEncoder = null;
        this.commandBuffers.length = 0;
        this.passEncoder = null;
        this.pipeline = null;
        this.insideRenderPass = false;
        this.bindGroupFormats.length = 0;
        this.renderPipeline.cache.clear();
        this.computePipeline.cache.clear();
    }

    /** @ignore */
    loseContext() {
        this.clearDeviceState();

        // Release owned buffers before their handles are invalidated, so destruction also
        // removes their VRAM accounting. The remaining application resources are restored below.
        this.destroyDeviceResources();
        super.loseContext();

        for (const bindGroup of this._bindGroups) {
            bindGroup.loseContext();
        }
        for (const format of this._bindGroupFormats) {
            format.loseContext();
        }
        for (const compute of this._computes) {
            compute.loseContext();
        }

        this.destroyDeferredResources();
    }

    /** @ignore */
    restoreContext() {
        for (const texture of this.textures) {
            texture.impl.create(this);
        }
        for (const format of this._bindGroupFormats) {
            format.restoreContext();
        }
        for (const compute of this._computes) {
            compute.restoreContext();
        }
        // Bind groups rebuild through their normal dirty update after buffer allocations are ready.
        super.restoreContext();

        // Reupload commands after their storage buffers have been recreated.
        for (const drawCommands of this._drawCommands) {
            drawCommands.restoreContext();
        }
    }

    postInit() {
        super.postInit();

        this.initializeRenderState();
        this.setupPassEncoderDefaults();

        this.gpuProfiler = new WebgpuGpuProfiler(this);

        // init dynamic buffer using 100kB allocation
        this.dynamicBuffers = new WebgpuDynamicBuffers(this, 100 * 1024, this.limits.minUniformBufferOffsetAlignment);

        // empty bind group
        this.emptyBindGroup = new BindGroup(this, new BindGroupFormat(this, []));
        this.emptyBindGroup.update();
    }

    createBackbuffer() {
        this.supportsStencil = this.initOptions.stencil;

        // transient (memoryless) attachment requests - RenderTarget gates these on device support
        this.backBuffer = new RenderTarget({
            name: 'WebgpuFramebuffer',
            graphicsDevice: this,
            depth: this.initOptions.depth,
            stencil: this.supportsStencil,
            samples: this.samples,
            transientColor: this.initOptions.transientColor,
            transientDepth: this.initOptions.transientDepth
        });
        this.backBuffer.impl.isBackbuffer = true;
    }

    frameStart() {

        super.frameStart();
        this.gpuProfiler.frameStart();

        // submit any commands collected before the frame rendering
        this.submit();

        WebgpuDebug.memory(this);
        WebgpuDebug.validate(this);

        // current frame color output buffer (XR overrides canvas swapchain; external backbuffer is last resort)
        const outColorBuffer =
            this.xrColorTexture ??
            this.gpuContext?.getCurrentTexture?.() ??
            this.externalBackbuffer?.impl.gpuTexture;
        Debug.assert(outColorBuffer, 'WebGPU frameStart requires an XR color texture, canvas swapchain texture, or externalBackbuffer.');
        DebugHelper.setLabel(outColorBuffer, `${this.backBuffer.name}`);

        // Reallocate framebuffer if dimensions change, to match the output texture. For WebXR
        // WebGPU projection color targets that are 2d-array textures, width/height are the per-layer
        // extent (same for every view), which matches what the render pass and internal depth need.
        if (this.backBufferSize.x !== outColorBuffer.width || this.backBufferSize.y !== outColorBuffer.height) {

            this.backBufferSize.set(outColorBuffer.width, outColorBuffer.height);

            this.backBuffer.destroy();
            this.backBuffer = null;

            this.createBackbuffer();
        }

        const rt = this.backBuffer;
        const wrt = rt.impl;

        const attachmentViewFormat = (outColorBuffer === this.xrColorTexture && this.xrColorTextureViewFormat) ?
            this.xrColorTextureViewFormat :
            this.backBufferViewFormat;

        // assign the format, allowing following init call to use it to allocate matching multisampled buffer
        wrt.setColorAttachment(0, undefined, attachmentViewFormat);

        // Track the backbuffer's dimensions to whatever texture we're rendering into
        // this frame (canvas swapchain in normal use, XR projection-layer texture during XR).
        rt._width = outColorBuffer.width;
        rt._height = outColorBuffer.height;

        this.initRenderTarget(rt);

        // assign current frame's render texture
        wrt.assignColorTexture(outColorBuffer, attachmentViewFormat);

        WebgpuDebug.end(this, 'frameStart');
        WebgpuDebug.end(this, 'frameStart');
    }

    frameEnd() {
        super.frameEnd();
        this.gpuProfiler.frameEnd();

        // submit scheduled command buffers
        this.submit();

        if (!this.contextLost) {
            this.gpuProfiler.request();
        }

        this._indirectDrawNextIndex = 0;
        this._indirectDispatchNextIndex = 0;
    }

    createBufferImpl(usageFlags) {
        return new WebgpuBuffer(usageFlags);
    }

    createUniformBufferImpl(uniformBuffer) {
        return new WebgpuUniformBuffer(uniformBuffer);
    }

    createVertexBufferImpl(vertexBuffer, format, options) {
        return new WebgpuVertexBuffer(vertexBuffer, format, options);
    }

    createIndexBufferImpl(indexBuffer, options) {
        return new WebgpuIndexBuffer(indexBuffer, options);
    }

    createShaderImpl(shader) {
        return new WebgpuShader(shader);
    }

    createDrawCommandImpl(drawCommands) {
        return new WebgpuDrawCommands(this);
    }

    createTextureImpl(texture) {
        this.textures.add(texture);
        return new WebgpuTexture(texture);
    }

    createXrBridgeImpl(xrBridge) {
        return new WebgpuXrBridge(xrBridge);
    }

    createRenderTargetImpl(renderTarget) {
        return new WebgpuRenderTarget(renderTarget);
    }

    createUploadStreamImpl(uploadStream) {
        return new WebgpuUploadStream(uploadStream);
    }

    createBindGroupFormatImpl(bindGroupFormat) {
        return new WebgpuBindGroupFormat(bindGroupFormat);
    }

    createBindGroupImpl(bindGroup) {
        return new WebgpuBindGroup(bindGroup);
    }

    createComputeImpl(compute) {
        return new WebgpuCompute(compute);
    }

    get indirectDrawBuffer() {
        this.allocateIndirectDrawBuffer();
        return this._indirectDrawBuffer;
    }

    allocateIndirectDrawBuffer() {

        // handle reallocation
        if (this._indirectDrawNextIndex === 0 && this._indirectDrawBufferCount < this.maxIndirectDrawCount) {
            this._indirectDrawBuffer?.destroy();
            this._indirectDrawBuffer = null;
        }

        // allocate buffer
        if (this._indirectDrawBuffer === null) {
            this._indirectDrawBuffer = new StorageBuffer(this, this.maxIndirectDrawCount * _indirectEntryByteSize, BUFFERUSAGE_INDIRECT | BUFFERUSAGE_COPY_DST);
            DebugHelper.setName(this._indirectDrawBuffer, 'WebgpuGraphicsDevice.indirectDraw');
            this._indirectDrawBufferCount = this.maxIndirectDrawCount;
        }
    }

    getIndirectDrawSlot(count = 1) {

        // make sure the buffer is allocated
        this.allocateIndirectDrawBuffer();

        // allocate consecutive slots
        const slot = this._indirectDrawNextIndex;
        const nextIndex = this._indirectDrawNextIndex + count;
        Debug.assert(nextIndex <= this.maxIndirectDrawCount, `Insufficient indirect draw slots per frame (requested ${count}, currently ${nextIndex}), please adjust GraphicsDevice#maxIndirectDrawCount`);
        this._indirectDrawNextIndex = nextIndex;
        return slot;
    }

    get indirectDispatchBuffer() {
        this.allocateIndirectDispatchBuffer();
        return this._indirectDispatchBuffer;
    }

    allocateIndirectDispatchBuffer() {

        // handle reallocation
        if (this._indirectDispatchNextIndex === 0 && this._indirectDispatchBufferCount < this.maxIndirectDispatchCount) {
            this._indirectDispatchBuffer?.destroy();
            this._indirectDispatchBuffer = null;
        }

        // allocate buffer
        if (this._indirectDispatchBuffer === null) {
            this._indirectDispatchBuffer = new StorageBuffer(this, this.maxIndirectDispatchCount * _indirectDispatchEntryByteSize, BUFFERUSAGE_INDIRECT | BUFFERUSAGE_COPY_DST);
            DebugHelper.setName(this._indirectDispatchBuffer, 'WebgpuGraphicsDevice.indirectDispatch');
            this._indirectDispatchBufferCount = this.maxIndirectDispatchCount;
        }
    }

    getIndirectDispatchSlot(count = 1) {

        // make sure the buffer is allocated
        this.allocateIndirectDispatchBuffer();

        // allocate consecutive slots
        const slot = this._indirectDispatchNextIndex;
        const nextIndex = this._indirectDispatchNextIndex + count;
        Debug.assert(nextIndex <= this.maxIndirectDispatchCount, `Insufficient indirect dispatch slots per frame (requested ${count}, currently ${nextIndex}), please adjust GraphicsDevice#maxIndirectDispatchCount`);
        this._indirectDispatchNextIndex = nextIndex;
        return slot;
    }

    /**
     * @param {number} index - Index of the bind group slot
     * @param {BindGroup} bindGroup - Bind group to attach
     * @param {Uint32Array} [offsets] - Byte offsets for all uniform buffers in the bind group.
     * Defaults to the offsets the bind group holds.
     */
    setBindGroup(index, bindGroup, offsets) {

        // TODO: this condition should be removed, it's here to handle fake grab pass, which should be refactored instead
        if (this.passEncoder) {

            // The offsets are passed as a typed array with an explicit range, which WebGPU reads
            // directly. A JS array - or a typed array without the range, which selects the same
            // overload - is converted to a sequence on every call, even an empty one, which is a
            // large part of the cost of a bind. A bind group without dynamic offsets passes none.
            const dynamicOffsets = offsets ?? bindGroup.uniformBufferOffsets;
            const count = dynamicOffsets.length;
            if (count === 0) {
                this.passEncoder.setBindGroup(index, bindGroup.impl.bindGroup);
            } else {
                this.passEncoder.setBindGroup(index, bindGroup.impl.bindGroup, dynamicOffsets, 0, count);
            }

            // store the active formats, used by the pipeline creation. A format takes part in the
            // pipeline by its key, so a different format of the same layout keeps the pipeline
            const formatImpl = bindGroup.format.impl;
            if (this.bindGroupFormats[index]?.key !== formatImpl.key) {
                this._pipelineDirty = true;
            }
            this.bindGroupFormats[index] = formatImpl;
        }
    }

    submitVertexBuffer(vertexBuffer, slot) {

        const format = vertexBuffer.format;
        const { interleaved, elements } = format;
        const elementCount = elements.length;
        const vbBuffer = vertexBuffer.impl.buffer;

        if (interleaved) {
            // for interleaved buffers, we use a single vertex buffer, and attributes are specified using the layout
            this.bindVertexBuffer(slot, vbBuffer, 0);
            return 1;
        }

        // non-interleaved - vertex buffer per attribute
        for (let i = 0; i < elementCount; i++) {
            this.bindVertexBuffer(slot + i, vbBuffer, elements[i].offset);
        }

        return elementCount;
    }

    /**
     * Binds a GPU buffer to a vertex buffer slot, unless the slot already holds it at the offset.
     *
     * @param {number} slot - The vertex buffer slot.
     * @param {GPUBuffer} buffer - The GPU buffer.
     * @param {number} offset - The offset in the buffer, in bytes.
     * @private
     */
    bindVertexBuffer(slot, buffer, offset) {
        if (this._boundVertexBuffers[slot] !== buffer || this._boundVertexOffsets[slot] !== offset) {
            this._boundVertexBuffers[slot] = buffer;
            this._boundVertexOffsets[slot] = offset;
            this.passEncoder.setVertexBuffer(slot, buffer, offset);
        }
    }

    // #if _DEBUG
    /**
     * Validates that the bind group at the view index holds the textures the shader reads from it,
     * see {@link Shader#viewBindGroupFormat} - the renderer binds it per shader, and so a draw
     * issued without the renderer setting it up would miss them.
     *
     * @param {Shader} shader - The shader of the draw.
     * @private
     */
    validateViewBindGroup(shader) {
        const viewFormat = shader.viewBindGroupFormat;
        if (viewFormat) {
            const bound = this.bindGroupFormats[BINDGROUP_VIEW];
            Debug.assert(bound?.key === viewFormat.impl.key,
                `The view bind group of shader [${shader.label}] holds textures [${viewFormat.textureFormats.map(format => format.name).join(', ')}], but a bind group of a different format is bound at the view index. Draws of such shaders need Renderer#setupViewBindGroup after the shader is set.`,
                { shader, bound: bound?.bindGroupFormat, expected: viewFormat });
        }
    }

    validateVBLocations(vb0, vb1) {

        // in case of multiple VBs, validate all elements use unique locations
        const validateVB = (vb) => {
            const { elements } = vb.format;
            for (let i = 0; i < elements.length; i++) {
                const name = elements[i].name;
                const location = semanticToLocation[name];
                if (_uniqueLocations.has(location)) {
                    Debug.errorOnce(`Vertex buffer element location ${location} used by [${name}] is already used by element [${_uniqueLocations.get(location)}], while rendering [${DebugGraphics.toString()}]`);
                }
                _uniqueLocations.set(location, name);
            }
        };

        validateVB(vb0);
        validateVB(vb1);
        _uniqueLocations.clear();
    }
    // #endif

    draw(primitive, indexBuffer, numInstances = 1, drawCommands, first = true, last = true) {

        if (this.shader.ready && !this.shader.failed) {

            WebgpuDebug.validate(this);

            const passEncoder = this.passEncoder;
            Debug.assert(passEncoder);

            let pipeline = this.pipeline;

            // vertex buffers
            const vb0 = this.vertexBuffers[0];
            const vb1 = this.vertexBuffers[1];

            if (first) {

                if (vb0) {
                    const vbSlot = this.submitVertexBuffer(vb0, 0);
                    if (vb1) {
                        Debug.call(() => this.validateVBLocations(vb0, vb1));
                        this.submitVertexBuffer(vb1, vbSlot);
                    }
                }

                Debug.call(() => this.validateAttributes(this.shader, [vb0, vb1]));
                Debug.call(() => this.validateViewBindGroup(this.shader));

                // render pipeline - looked up only when one of its inputs changed since the last
                // lookup: the device state (tracked by the setters), or the arguments of the draw.
                // The pipeline is reset at the start of each pass.
                const primitiveType = primitive.type;
                const vertexHash0 = vb0 ? vb0.format.renderingHash : 0;
                const vertexHash1 = vb1 ? vb1.format.renderingHash : 0;
                const indexFormat = WebgpuRenderPipeline.stripIndexFormat(primitiveType, indexBuffer?.format) ?? -1;
                if (this._pipelineDirty || !pipeline ||
                    this._pipelinePrimitiveType !== primitiveType ||
                    this._pipelineVertexHash0 !== vertexHash0 ||
                    this._pipelineVertexHash1 !== vertexHash1 ||
                    this._pipelineIndexFormat !== indexFormat) {

                    this._pipelineDirty = false;
                    this._pipelinePrimitiveType = primitiveType;
                    this._pipelineVertexHash0 = vertexHash0;
                    this._pipelineVertexHash1 = vertexHash1;
                    this._pipelineIndexFormat = indexFormat;

                    pipeline = this.renderPipeline.get(primitive, vb0?.format, vb1?.format, indexBuffer?.format, this.shader, this.renderTarget,
                        this.bindGroupFormats, this.blendState, this.depthState, this.cullMode,
                        this.stencilEnabled, this.stencilFront, this.stencilBack, this.frontFace, this.alphaToCoverage);
                    Debug.assert(pipeline);

                    if (this.pipeline !== pipeline) {
                        this.pipeline = pipeline;
                        passEncoder.setPipeline(pipeline);
                    }
                }

                Debug.call(() => {
                    // the pipeline reused without a lookup is the one a lookup would return
                    const expected = this.renderPipeline.get(primitive, vb0?.format, vb1?.format, indexBuffer?.format, this.shader, this.renderTarget,
                        this.bindGroupFormats, this.blendState, this.depthState, this.cullMode,
                        this.stencilEnabled, this.stencilFront, this.stencilBack, this.frontFace, this.alphaToCoverage);
                    Debug.assert(expected === pipeline, 'A render state change was not tracked, the draw reused a stale render pipeline.', this);
                });
            }

            if (indexBuffer) {
                const { buffer, format } = indexBuffer.impl;
                if (this._boundIndexBuffer !== buffer || this._boundIndexFormat !== format) {
                    this._boundIndexBuffer = buffer;
                    this._boundIndexFormat = format;
                    passEncoder.setIndexBuffer(buffer, format);
                }
            }

            // draw
            if (drawCommands) { // indirect draw path

                const storage = drawCommands.impl?.storage ?? this.indirectDrawBuffer;
                const indirectBuffer = storage.impl.buffer;
                const drawsCount = drawCommands.count;

                // TODO: when multiDrawIndirect is supported, we can use it here instead of a loop
                for (let d = 0; d < drawsCount; d++) {
                    const indirectOffset = (drawCommands.slotIndex + d) * _indirectEntryByteSize;
                    if (indexBuffer) {
                        passEncoder.drawIndexedIndirect(indirectBuffer, indirectOffset);
                    } else {
                        passEncoder.drawIndirect(indirectBuffer, indirectOffset);
                    }
                }
            } else { // single draw path

                if (indexBuffer) {
                    passEncoder.drawIndexed(primitive.count, numInstances, primitive.base, primitive.baseVertex ?? 0, 0);
                } else {
                    passEncoder.draw(primitive.count, numInstances, primitive.base, 0);
                }
            }

            // track draw calls - always count as 1 (one material setup, one API call)
            this._drawCallsPerFrame++;

            // #if _PROFILER
            // track primitive count
            if (drawCommands) {
                // use pre-calculated primitive count from drawCommands
                this._primitiveCount += drawCommands.getPrimitiveCount(primitive.type);
            } else {
                // single draw
                this._primitiveCount += getPrimitiveCount(primitive.type, primitive.count) * numInstances;
            }
            // #endif

            WebgpuDebug.end(this, 'Drawing', {
                vb0,
                vb1,
                indexBuffer,
                primitive,
                numInstances,
                pipeline
            });
        }

        if (last) {
            // Clear pending vertex buffers; encoder state remains bound until the pass ends.
            this.clearVertexBuffer();
        }
    }

    setShader(shader, asyncCompile = false) {

        if (shader !== this.shader) {
            this.shader = shader;
            this._pipelineDirty = true;

            // #if _PROFILER
            // TODO: we should probably track other stats instead, like pipeline switches
            this._shaderSwitchesPerFrame++;
            // #endif
        }
    }

    setBlendState(blendState) {
        Debug.assert(!blendState.usesDualSourceBlending || this.supportsDualSourceBlending,
            'Dual-source blending is not supported by this graphics device.');

        if (this.blendState.key !== blendState.key) {
            this._pipelineDirty = true;
        }
        this.blendState.copy(blendState);
    }

    setDepthState(depthState) {
        if (this.depthState.key !== depthState.key) {
            this._pipelineDirty = true;
        }
        this.depthState.copy(depthState);
    }

    setStencilState(stencilFront, stencilBack) {
        if (stencilFront || stencilBack) {
            const front = stencilFront ?? StencilParameters.DEFAULT;
            const back = stencilBack ?? StencilParameters.DEFAULT;
            if (!this.stencilEnabled || this.stencilFront.key !== front.key || this.stencilBack.key !== back.key) {
                this._pipelineDirty = true;
            }
            this.stencilEnabled = true;
            this.stencilFront.copy(front);
            this.stencilBack.copy(back);

            // ref value - based on stencil front
            const ref = this.stencilFront.ref;
            if (this.stencilRef !== ref) {
                this.stencilRef = ref;
                this.passEncoder.setStencilReference(ref);
            }
        } else {
            if (this.stencilEnabled) {
                this._pipelineDirty = true;
            }
            this.stencilEnabled = false;
        }
    }

    setBlendColor(r, g, b, a) {
        const c = this.blendColor;
        if (r !== c.r || g !== c.g || b !== c.b || a !== c.a) {
            c.set(r, g, b, a);
            this.passEncoder.setBlendConstant(c);
        }
    }

    setCullMode(cullMode) {
        if (this.cullMode !== cullMode) {
            this.cullMode = cullMode;
            this._pipelineDirty = true;
        }
    }

    setFrontFace(frontFace) {
        if (this.frontFace !== frontFace) {
            this.frontFace = frontFace;
            this._pipelineDirty = true;
        }
    }

    setAlphaToCoverage(state) {
        if (this.alphaToCoverage !== state) {
            this.alphaToCoverage = state;
            this._pipelineDirty = true;
        }
    }

    initializeContextCaches() {
        super.initializeContextCaches();
    }

    /**
     * Set up default values for the render pass encoder.
     */
    setupPassEncoderDefaults() {
        this.pipeline = null;
        this.stencilRef = 0;
        this.blendColor.set(0, 0, 0, 0);

        // a new pass encoder starts with no vertex or index buffer bound
        this._boundVertexBuffers.length = 0;
        this._boundVertexOffsets.length = 0;
        this._boundIndexBuffer = null;
        this._boundIndexFormat = null;
    }

    _uploadDirtyTextures() {
        this.texturesToUpload.forEach((texture) => {
            if (texture._needsUpload || texture._needsMipmapsUpload) {
                texture.upload();
            }
        });
        this.texturesToUpload.clear();
    }

    setupTimeStampWrites(passDesc, name) {
        // Cached descriptors can retain queries from an earlier frame or device.
        if (passDesc) {
            passDesc.timestampWrites = undefined;
        }
        if (this.gpuProfiler._enabled) {
            if (this.gpuProfiler.timestampQueriesSet) {
                const slot = this.gpuProfiler.getSlot(name);
                if (slot === -1) {
                    Debug.warnOnce('Too many GPU profiler slots allocated during the frame, ignoring timestamp writes');
                } else {
                    passDesc = passDesc ?? {};
                    passDesc.timestampWrites = {
                        querySet: this.gpuProfiler.timestampQueriesSet.querySet,
                        beginningOfPassWriteIndex: slot * 2,
                        endOfPassWriteIndex: slot * 2 + 1
                    };
                }
            }
        }
        return passDesc;
    }

    /**
     * Start a render pass.
     *
     * @param {RenderPass} renderPass - The render pass to start.
     * @ignore
     */
    startRenderPass(renderPass) {

        // upload textures that need it, to avoid them being uploaded / their mips generated during the pass
        // TODO: this needs a better solution
        this._uploadDirtyTextures();

        WebgpuDebug.internal(this);
        WebgpuDebug.validate(this);

        const rt = renderPass.renderTarget || this.backBuffer;
        this.renderTarget = rt;
        Debug.assert(rt);

        /** @type {WebgpuRenderTarget} */
        const wrt = rt.impl;

        // framebuffer is initialized at the start of the frame
        if (rt !== this.backBuffer) {
            this.initRenderTarget(rt);
        }

        // set up clear / store / load settings
        wrt.setupForRenderPass(renderPass, rt);

        const renderPassDesc = wrt.renderPassDescriptor;

        // timestamp
        this.setupTimeStampWrites(renderPassDesc, renderPass.name);

        // start the pass
        const commandEncoder = this.getCommandEncoder();
        this.passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
        this.passEncoder.label = `${renderPass.name}-PassEncoder RT:${rt.name}`;

        // push marker to the passEncoder
        DebugGraphics.pushGpuMarker(this, `Pass:${renderPass.name} RT:${rt.name}`);

        this.setupPassEncoderDefaults();

        // the pass always clears full target
        // TODO: avoid this setting the actual viewport/scissor on webgpu as those are automatically reset to full
        // render target. We just need to update internal state, for the get functionality to return it.
        const { width, height } = rt;
        this.setViewport(0, 0, width, height);
        this.setScissor(0, 0, width, height);

        Debug.assert(!this.insideRenderPass, 'RenderPass cannot be started while inside another render pass.');
        this.insideRenderPass = true;
    }

    /**
     * End a render pass.
     *
     * @param {RenderPass} renderPass - The render pass to end.
     * @ignore
     */
    endRenderPass(renderPass) {

        // pop the marker from the passEncoder
        DebugGraphics.popGpuMarker(this);

        // end the render pass
        this.passEncoder.end();
        this.passEncoder = null;
        this.insideRenderPass = false;

        // each render pass can use different number of bind groups
        this.bindGroupFormats.length = 0;

        // resolve depth if needed after the pass has finished
        const target = this.renderTarget;
        if (target) {

            // resolve depth buffer (stencil resolve is not yet implemented)
            if (target.depthBuffer && renderPass.depthStencilOps.resolveDepth && renderPass.samples > 1) {

                // legacy mode: the internally allocated multisampled depth is resolved into the
                // user-provided single-sampled depthBuffer (R32F), additionally gated on
                // autoResolve. Explicit mode: the user-provided multisampled depthBuffer is
                // resolved into depthResolveBuffer, driven purely by the per-pass resolveDepth
                // flag - matching how explicit color resolve buffers are controlled.
                const explicitMsaa = target.depthBuffer.samples > 1;
                if (explicitMsaa || target.autoResolve) {
                    const depthAttachment = target.impl.depthAttachment;
                    const sourceTexture = explicitMsaa ? depthAttachment?.depthTexture : depthAttachment?.multisampledDepthBuffer;
                    const destTexture = explicitMsaa ? target.depthResolveBuffer?.impl.gpuTexture : target.depthBuffer.impl.gpuTexture;

                    // a transient (memoryless) depth buffer cannot be sampled, so it cannot be the
                    // source of a shader-based depth resolve (it has no TEXTURE_BINDING usage)
                    if (depthAttachment?.transient) {
                        Debug.errorOnce(`Depth resolve is not possible on render target '${target.name}' because its depth is a transient (memoryless) attachment. Disable transientDepth to allow depth resolve.`);
                    } else if (sourceTexture && destTexture) {
                        this.resolver.resolveDepth(this.commandEncoder, sourceTexture, destTexture, target.depthResolveMode);
                    }
                }
            }
        }

        // generate mipmaps using the same command buffer encoder
        for (let i = 0; i < renderPass.colorArrayOps.length; i++) {
            const colorOps = renderPass.colorArrayOps[i];
            if (colorOps.genMipmaps) {
                this.mipmapRenderer.generate(renderPass.renderTarget._colorBuffers[i].impl);
            }
        }

        WebgpuDebug.end(this, 'RenderPass', { renderPass });
        WebgpuDebug.end(this, 'RenderPass', { renderPass });
    }

    startComputePass(name) {

        // upload textures that need it, to avoid them being uploaded during the pass
        this._uploadDirtyTextures();

        WebgpuDebug.internal(this);
        WebgpuDebug.validate(this);

        // clear cached encoder state
        this.pipeline = null;

        // timestamp
        const computePassDesc = this.setupTimeStampWrites(undefined, name);

        // start the pass
        DebugHelper.setLabel(computePassDesc, `ComputePass-${name}`);
        const commandEncoder = this.getCommandEncoder();
        this.passEncoder = commandEncoder.beginComputePass(computePassDesc);
        DebugHelper.setLabel(this.passEncoder, `ComputePass-${name}`);

        Debug.assert(!this.insideRenderPass, 'ComputePass cannot be started while inside another pass.');
        this.insideRenderPass = true;
    }

    endComputePass() {

        // end the compute pass
        this.passEncoder.end();
        this.passEncoder = null;
        this.insideRenderPass = false;

        // each render pass can use different number of bind groups
        this.bindGroupFormats.length = 0;

        WebgpuDebug.end(this, 'ComputePass');
        WebgpuDebug.end(this, 'ComputePass');
    }

    computeDispatch(computes, name = 'Unnamed') {

        this.startComputePass(name);

        // update uniform buffers and bind groups
        for (let i = 0; i < computes.length; i++) {
            const compute = computes[i];
            compute.applyParameters();
            compute.impl.updateBindGroup();
        }

        // dispatch
        for (let i = 0; i < computes.length; i++) {
            const compute = computes[i];
            compute.impl.dispatch(compute.countX, compute.countY, compute.countZ);
        }

        this.endComputePass();
    }

    getCommandEncoder() {

        // use existing or create new encoder
        let commandEncoder = this.commandEncoder;
        if (!commandEncoder) {
            commandEncoder = this.wgpu.createCommandEncoder();
            DebugHelper.setLabel(commandEncoder, 'CommandEncoder-Shared');

            this.commandEncoder = commandEncoder;
        }

        return commandEncoder;
    }

    endCommandEncoder() {

        Debug.assert(!this.insideRenderPass, 'Attempted to finish GPUCommandEncoder while inside a pass. This will invalidate the current pass encoder and cause "Parent encoder is already finished" validation errors.');

        const { commandEncoder } = this;
        if (commandEncoder) {

            const cb = commandEncoder.finish();
            DebugHelper.setLabel(cb, 'CommandBuffer-Shared');

            this.addCommandBuffer(cb);
            this.commandEncoder = null;
        }
    }

    addCommandBuffer(commandBuffer, front = false) {
        if (front) {
            this.commandBuffers.unshift(commandBuffer);
        } else {
            this.commandBuffers.push(commandBuffer);
        }
    }

    submit() {

        Debug.assert(!this.insideRenderPass, 'Attempted to submit command buffers while inside a pass. This finishes the parent command encoder and invalidates the active pass ("Parent encoder is already finished") .');

        // end the current encoder
        this.endCommandEncoder();

        if (this.commandBuffers.length > 0) {

            // copy dynamic buffers data to the GPU (this schedules the copy CB to run before all other CBs)
            this.dynamicBuffers.submit();

            // trace all scheduled command buffers
            Debug.call(() => {
                if (this.commandBuffers.length > 0) {
                    Debug.trace(TRACEID_RENDER_QUEUE, `SUBMIT (${this.commandBuffers.length})`);
                    for (let i = 0; i < this.commandBuffers.length; i++) {
                        Debug.trace(TRACEID_RENDER_QUEUE, `  CB: ${this.commandBuffers[i].label}`);
                    }
                }
            });

            this.wgpu.queue.submit(this.commandBuffers);
            this.commandBuffers.length = 0;
            this.submitVersion++;

            // notify dynamic buffers
            this.dynamicBuffers.onCommandBuffersSubmitted();
        }

        // destroy deferred resources after submit to ensure they're no longer referenced
        this.destroyDeferredResources();
    }

    /** @private */
    destroyDeferredResources() {
        const deferredDestroys = this._deferredDestroys;
        if (deferredDestroys.length > 0) {
            for (let i = 0; i < deferredDestroys.length; i++) {
                deferredDestroys[i].destroy();
            }
            deferredDestroys.length = 0;
        }
    }

    /**
     * Defer destruction of a GPU resource until after the current command buffers are submitted.
     * This ensures the resource is not destroyed while still referenced by pending GPU commands.
     * Resources released after device destruction are destroyed immediately.
     *
     * @param {GPUTexture|GPUBuffer|GPUQuerySet} gpuResource - The GPU resource to destroy.
     * @private
     */
    deferDestroy(gpuResource) {
        if (gpuResource) {
            if (this._destroyed) {
                gpuResource.destroy();
            } else {
                this._deferredDestroys.push(gpuResource);
            }
        }
    }

    clear(options) {
        if (options.flags) {
            this.clearRenderer.clear(this, this.renderTarget, options, this.defaultClearOptions);
        }
    }

    setViewport(x, y, w, h) {
        // TODO: only execute when it changes. Also, the viewport of encoder  matches the rendering attachments,
        // so we can skip this if fullscreen
        // TODO: this condition should be removed, it's here to handle fake grab pass, which should be refactored instead
        if (this.passEncoder) {

            // When the backbuffer is bound to an XR projection-layer texture, do NOT call
            // passEncoder.setViewport to avoid issues on Apple's visionOS. This should be ok in
            // general, as we're not likely to do a multi-view rendering when XR is active.
            if (this.xrColorTexture) {
                return;
            }

            if (!this.renderTarget.flipY) {
                y = this.renderTarget.height - y - h;
            }

            this.vx = x;
            this.vy = y;
            this.vw = w;
            this.vh = h;

            this.passEncoder.setViewport(x, y, w, h, 0, 1);
        }
    }

    setScissor(x, y, w, h) {
        // TODO: only execute when it changes. Also, the viewport of encoder  matches the rendering attachments,
        // so we can skip this if fullscreen
        // TODO: this condition should be removed, it's here to handle fake grab pass, which should be refactored instead
        if (this.passEncoder) {

            // When the backbuffer is bound to an XR projection-layer texture, do NOT call
            // passEncoder.setScissorRect to avoid issues on Apple's visionOS. This should be ok in
            // general, as we're not likely to do a multi-view rendering when XR is active.
            if (this.xrColorTexture) {
                return;
            }

            const rt = this.renderTarget;
            const rtWidth = rt.width;
            const rtHeight = rt.height;

            if (!rt.flipY) {
                y = rtHeight - y - h;
            }

            // Unlike the viewport, the scissor rectangle must lie within the render target, so
            // clamp it. This allows a viewport extending past the render target bounds, which
            // uses the viewport rectangle as its scissor rectangle by default.
            const x0 = Math.min(Math.max(x, 0), rtWidth);
            const y0 = Math.min(Math.max(y, 0), rtHeight);
            w = Math.max(Math.min(x + w, rtWidth) - x0, 0);
            h = Math.max(Math.min(y + h, rtHeight) - y0, 0);
            x = x0;
            y = y0;

            this.sx = x;
            this.sy = y;
            this.sw = w;
            this.sh = h;

            this.passEncoder.setScissorRect(x, y, w, h);
        }
    }

    /**
     * Clear the content of a storage buffer to 0.
     *
     * @param {WebgpuBuffer} storageBuffer - The storage buffer.
     * @param {number} [offset] - The offset of data to clear. Defaults to 0.
     * @param {number} [size] - The size of data to clear. Defaults to the full size of the buffer.
     * @ignore
     */
    clearStorageBuffer(storageBuffer, offset = 0, size = storageBuffer.byteSize) {

        const commandEncoder = this.getCommandEncoder();
        commandEncoder.clearBuffer(storageBuffer.buffer, offset, size);
    }

    /**
     * Map a GPUBuffer for reading or writing, handling the rejection which happens when the
     * device is lost, or when the buffer is destroyed while the mapping is pending. In those
     * cases the buffer cannot be used, and the returned promise resolves with false instead of
     * rejecting. Any other rejection is unexpected and is asserted in debug builds.
     *
     * @param {GPUBuffer} buffer - The buffer to map.
     * @param {number} mode - GPUMapMode.READ or GPUMapMode.WRITE.
     * @returns {Promise<boolean>} A promise that resolves with true when the buffer is mapped,
     * or false when the mapping failed.
     * @private
     */
    mapBufferAsync(buffer, mode) {

        // mapAsync rejects when the device is already lost, so do not even call it
        if (this.contextLost) {
            return Promise.resolve(false);
        }

        return buffer.mapAsync(mode).then(() => true, (error) => {
            // AbortError is expected when the device is lost or the buffer is destroyed while
            // the mapping is pending; anything else indicates incorrect use of the mapping API
            Debug.assert(error.name === 'AbortError', 'GPUBuffer.mapAsync failed', error);
            return false;
        });
    }

    /**
     * Read a content of a storage buffer.
     *
     * @param {WebgpuBuffer} storageBuffer - The storage buffer.
     * @param {number} [offset] - The byte offset of data to read. Defaults to 0.
     * @param {number} [size] - The byte size of data to read. Defaults to the full size of the
     * buffer minus the offset.
     * @param {ArrayBufferView} [data] - Typed array to populate with the data read from the storage
     * buffer. When typed array is supplied, enough space needs to be reserved, otherwise only
     * partial data is copied. If not specified, the data is returned in an Uint8Array. Defaults to
     * null.
     * @param {boolean} [immediate] - If true, the read operation will be executed as soon as
     * possible. This has a performance impact, so it should be used only when necessary. Defaults
     * to false.
     * @returns {Promise<ArrayBufferView>} A promise that resolves with the data read from the storage
     * buffer.
     * @ignore
     */
    readStorageBuffer(storageBuffer, offset = 0, size = storageBuffer.byteSize - offset, data = null, immediate = false) {

        // create a temporary staging buffer
        const stagingBuffer = this.createBufferImpl(BUFFERUSAGE_READ | BUFFERUSAGE_COPY_DST);
        stagingBuffer.allocate(this, size);
        const destBuffer = stagingBuffer.buffer;

        // copy the GPU buffer to the staging buffer
        const commandEncoder = this.getCommandEncoder();
        commandEncoder.copyBufferToBuffer(storageBuffer.buffer, offset, destBuffer, 0, size);

        return this.readBuffer(stagingBuffer, size, data, immediate);
    }

    async readBuffer(stagingBuffer, size, data = null, immediate = false) {
        const destBuffer = stagingBuffer.buffer;
        try {
            if (immediate) {
                this.submit();
            } else {
                // Wait until recorded copies have been submitted before mapping.
                await new Promise((resolve) => {
                    setTimeout(resolve);
                });
            }

            // Preserve the native AbortError so callers can distinguish interrupted reads,
            // even when mapping rejects before the device-lost event arrives.
            await destBuffer.mapAsync(GPUMapMode.READ);

            data ??= new Uint8Array(size);
            const copySrc = destBuffer.getMappedRange(0, size);
            const srcType = data.constructor;
            data.set(new srcType(copySrc));
            return data;
        } finally {
            destBuffer.unmap();
            stagingBuffer.destroy(this);
        }
    }

    /**
     * Issues a write operation of the provided data into a storage buffer.
     *
     * @param {WebgpuBuffer} storageBuffer - The storage buffer.
     * @param {number} bufferOffset - The offset in bytes to start writing to the storage buffer.
     * @param {ArrayBufferView|ArrayBuffer} data - The data to write to the storage buffer.
     * @param {number} dataOffset - Offset in data to begin writing from. Given in elements if data
     * is a TypedArray and bytes otherwise.
     * @param {number} size - Size of content to write from data to buffer. Given in elements if
     * data is a TypedArray and bytes otherwise.
     */
    writeStorageBuffer(storageBuffer, bufferOffset = 0, data, dataOffset = 0, size) {
        Debug.assert(storageBuffer.buffer);
        Debug.assert(data);
        this.wgpu.queue.writeBuffer(storageBuffer.buffer, bufferOffset, data, dataOffset, size);
    }

    /**
     * Copies source render target into destination render target. Mostly used by post-effects.
     *
     * @param {RenderTarget} [source] - The source render target. Defaults to frame buffer.
     * @param {RenderTarget} [dest] - The destination render target. Defaults to frame buffer.
     * @param {boolean} [color] - If true, will copy the color buffer. Defaults to false.
     * @param {boolean} [depth] - If true, will copy the depth buffer. Defaults to false.
     * @returns {boolean} True if the copy was successful, false otherwise.
     */
    copyRenderTarget(source, dest, color, depth) {

        /** @type {GPUExtent3D} */
        const copySize = {
            width: source ? source.width : dest.width,
            height: source ? source.height : dest.height,
            depthOrArrayLayers: 1
        };

        const commandEncoder = this.getCommandEncoder();

        DebugGraphics.pushGpuMarker(this, 'COPY-RT');

        if (color) {

            // WebGPU only allows copies between textures with equal sample counts. A copy between
            // a multisampled and a single-sampled color buffer is not a copy - use a resolve.
            const srcSamples = (source ? source.colorBuffer?.samples : 1) ?? 1;
            const dstSamples = (dest ? dest.colorBuffer?.samples : 1) ?? 1;
            if (srcSamples !== dstSamples) {
                Debug.errorOnce(`copyRenderTarget: cannot copy between color buffers with different sample counts (source '${source?.name}' has ${srcSamples}, destination '${dest?.name}' has ${dstSamples}). Use a resolve instead of a copy.`);
                DebugGraphics.popGpuMarker(this);
                return false;
            }

            // read from supplied render target, or from the framebuffer
            /** @type {GPUTexelCopyTextureInfo} */
            const copySrc = {
                texture: source ? source.colorBuffer.impl.gpuTexture : this.backBuffer.impl.assignedColorTexture,
                mipLevel: source ? source.mipLevel : 0
            };

            // write to supplied render target, or to the framebuffer
            /** @type {GPUTexelCopyTextureInfo} */
            const copyDst = {
                texture: dest ? dest.colorBuffer.impl.gpuTexture : this.backBuffer.impl.assignedColorTexture,
                mipLevel: dest ? dest.mipLevel : 0
            };

            Debug.assert(copySrc.texture !== null && copyDst.texture !== null);
            commandEncoder.copyTextureToTexture(copySrc, copyDst, copySize);
        }

        if (depth) {

            // read from supplied render target, or from the framebuffer
            const sourceRT = source ? source : this.renderTarget;

            // a transient (memoryless) depth buffer cannot be sampled or copied out (it has neither
            // TEXTURE_BINDING nor COPY_SRC), so a depth grab is not possible. Check the actual
            // allocation state on the attachment rather than the requested RT flag.
            if (sourceRT.impl.depthAttachment?.transient) {
                Debug.errorOnce(`copyRenderTarget cannot copy depth from render target '${sourceRT.name}' because its depth is a transient (memoryless) attachment. Disable transientDepth to allow depth grab / copy.`);
                DebugGraphics.popGpuMarker(this);
                return false;
            }

            // internally allocated depth uses depthTexture (multisampled when samples > 1); a
            // user-provided depth buffer with samples > 1 stores its multisampled depth separately
            const sourceAttachment = sourceRT.impl.depthAttachment;
            const sourceTexture = sourceAttachment.depthTexture ?? sourceAttachment.multisampledDepthBuffer;
            const sourceMipLevel = sourceRT.mipLevel;

            if (sourceRT.samples > 1) {

                // multisampled destination depth buffer - a plain copy between the multisampled
                // depth textures (a depth snapshot). WebGPU requires equal sample counts and
                // matching formats.
                const destMsDepth = dest?.depthBuffer?.samples > 1 ? dest.depthBuffer : null;
                if (destMsDepth) {
                    if (destMsDepth.samples !== sourceRT.samples) {
                        Debug.errorOnce(`copyRenderTarget: cannot copy depth between render targets with different sample counts (source '${sourceRT.name}' has ${sourceRT.samples}, destination '${dest.name}' has ${destMsDepth.samples}).`);
                        DebugGraphics.popGpuMarker(this);
                        return false;
                    }
                    Debug.assert(copySize.width === destMsDepth.width && copySize.height === destMsDepth.height,
                        'copyRenderTarget: copies of multisampled depth must cover the entire texture.');
                    commandEncoder.copyTextureToTexture(
                        { texture: sourceTexture },
                        { texture: destMsDepth.impl.gpuTexture },
                        copySize
                    );
                } else {

                    // resolve the depth to a color buffer of destination render target, using the
                    // resolve mode of the source render target
                    const destTexture = dest.colorBuffer.impl.gpuTexture;
                    this.resolver.resolveDepth(commandEncoder, sourceTexture, destTexture, sourceRT.depthResolveMode);
                }

            } else {

                // write to supplied render target, or to the framebuffer
                const destTexture = dest ? dest.depthBuffer.impl.gpuTexture : this.renderTarget.impl.depthAttachment.depthTexture;
                const destMipLevel = dest ? dest.mipLevel : this.renderTarget.mipLevel;

                /** @type {GPUTexelCopyTextureInfo} */
                const copySrc = {
                    texture: sourceTexture,
                    mipLevel: sourceMipLevel
                };

                /** @type {GPUTexelCopyTextureInfo} */
                const copyDst = {
                    texture: destTexture,
                    mipLevel: destMipLevel
                };

                Debug.assert(copySrc.texture !== null && copyDst.texture !== null);
                commandEncoder.copyTextureToTexture(copySrc, copyDst, copySize);
            }
        }

        DebugGraphics.popGpuMarker(this);

        return true;
    }

    get hasTranspilers() {
        return this.glslang && this.twgsl;
    }

    // #if _DEBUG
    pushMarker(name) {
        this.passEncoder?.pushDebugGroup(name);
    }

    popMarker() {
        this.passEncoder?.popDebugGroup();
    }
    // #endif
}

export { WebgpuGraphicsDevice };
