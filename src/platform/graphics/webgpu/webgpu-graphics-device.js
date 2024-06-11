import { TRACEID_RENDER_QUEUE } from '../../../core/constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';

import {
    PIXELFORMAT_RGBA8, PIXELFORMAT_BGRA8, DEVICETYPE_WEBGPU,
    BUFFERUSAGE_READ, BUFFERUSAGE_COPY_DST, semanticToLocation
} from '../constants.js';
import { GraphicsDevice } from '../graphics-device.js';
import { DebugGraphics } from '../debug-graphics.js';
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
import { BindGroupFormat } from '../bind-group-format.js';
import { BindGroup } from '../bind-group.js';

const _uniqueLocations = new Map();

class WebgpuGraphicsDevice extends GraphicsDevice {
    /**
     * Object responsible for caching and creation of render pipelines.
     */
    renderPipeline = new WebgpuRenderPipeline(this);

    /**
     * Object responsible for caching and creation of compute pipelines.
     */
    computePipeline = new WebgpuComputePipeline(this);

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
     * @type {GPURenderPipeline}
     * @private
     */
    pipeline;

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

    constructor(canvas, options = {}) {
        super(canvas, options);
        options = this.initOptions;

        // alpha defaults to true
        options.alpha = options.alpha ?? true;

        this.backBufferAntialias = options.antialias ?? false;
        this.isWebGPU = true;
        this._deviceType = DEVICETYPE_WEBGPU;
    }

    /**
     * Destroy the graphics device.
     */
    destroy() {

        this.clearRenderer.destroy();
        this.clearRenderer = null;

        this.mipmapRenderer.destroy();
        this.mipmapRenderer = null;

        this.resolver.destroy();
        this.resolver = null;

        super.destroy();
    }

    initDeviceCaps() {

        const limits = this.wgpu?.limits;
        this.limits = limits;

        this.precision = 'highp';
        this.maxPrecision = 'highp';
        this.maxSamples = 4;
        this.maxTextures = 16;
        this.maxTextureSize = limits.maxTextureDimension2D;
        this.maxCubeMapSize = limits.maxTextureDimension2D;
        this.maxVolumeSize = limits.maxTextureDimension3D;
        this.maxColorAttachments = limits.maxColorAttachments;
        this.maxPixelRatio = 1;
        this.maxAnisotropy = 16;
        this.fragmentUniformsCount = limits.maxUniformBufferBindingSize / 16;
        this.vertexUniformsCount = limits.maxUniformBufferBindingSize / 16;
        this.supportsUniformBuffers = true;
        this.supportsMorphTargetTexturesCore = true;
        this.supportsAreaLights = true;
        this.supportsGpuParticles = true;
        this.supportsCompute = true;
        this.textureFloatRenderable = true;
        this.textureHalfFloatRenderable = true;
        this.supportsImageBitmap = true;

        // WebGPU currently only supports 1 and 4 samples
        this.samples = this.backBufferAntialias ? 4 : 1;

        // WGSL features
        const wgslFeatures = navigator.gpu.wgslLanguageFeatures;
        this.supportsStorageTextureRead = wgslFeatures?.has('readonly_and_readwrite_storage_textures');
    }

    async initWebGpu(glslangUrl, twgslUrl) {

        if (!window.navigator.gpu) {
            throw new Error('Unable to retrieve GPU. Ensure you are using a browser that supports WebGPU rendering.');
        }

        // temporary message to confirm Webgpu is being used
        Debug.log("WebgpuGraphicsDevice initialization ..");

        // build a full URL from a relative or absolute path
        const buildUrl = (srcPath) => {
            return new URL(srcPath, window.location.href).toString();
        };

        const results = await Promise.all([
            import(`${buildUrl(twgslUrl)}`).then(module => twgsl(twgslUrl.replace('.js', '.wasm'))),
            import(`${buildUrl(glslangUrl)}`).then(module => module.default())
        ]);

        this.twgsl = results[0];
        this.glslang = results[1];

        /** @type {GPURequestAdapterOptions} */
        const adapterOptions = {
            powerPreference: this.initOptions.powerPreference !== 'default' ? this.initOptions.powerPreference : undefined
        };

        /**
         * @type {GPUAdapter}
         * @private
         */
        this.gpuAdapter = await window.navigator.gpu.requestAdapter(adapterOptions);


        // request optional features
        const requiredFeatures = [];
        const requireFeature = (feature) => {
            const supported = this.gpuAdapter.features.has(feature);
            if (supported) {
                requiredFeatures.push(feature);
            }
            return supported;
        };
        this.textureFloatFilterable = requireFeature('float32-filterable');
        this.extCompressedTextureS3TC = requireFeature('texture-compression-bc');
        this.extCompressedTextureETC = requireFeature('texture-compression-etc2');
        this.extCompressedTextureASTC = requireFeature('texture-compression-astc');
        this.supportsTimestampQuery = requireFeature('timestamp-query');
        this.supportsDepthClip = requireFeature('depth-clip-control');
        this.supportsDepth32Stencil = requireFeature('depth32float-stencil8');
        this.supportsIndirectFirstInstance = requireFeature('indirect-first-instance');
        this.supportsShaderF16 = requireFeature('shader-f16');
        this.supportsStorageRGBA8 = requireFeature('bgra8unorm-storage');
        this.textureRG11B10Renderable = requireFeature('rg11b10ufloat-renderable');
        Debug.log(`WEBGPU features: ${requiredFeatures.join(', ')}`);

        // copy all adapter limits to the requiredLimits object - to created a device with the best feature sets available
        const adapterLimits = this.gpuAdapter?.limits;
        const requiredLimits = {};
        if (adapterLimits) {
            for (const limitName in adapterLimits) {
                // skip these as they fail on Windows Chrome and are not part of spec currently
                if (limitName === "minSubgroupSize" || limitName === "maxSubgroupSize") {
                    continue;
                }
                requiredLimits[limitName] = adapterLimits[limitName];
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

        /**
         * @type {GPUDevice}
         * @private
         */
        this.wgpu = await this.gpuAdapter.requestDevice(deviceDescr);

        this.wgpu.lost?.then((info) => {
            // reason is 'destroyed' if we intentionally destroy the device
            if (info.reason !== 'destroyed') {
                Debug.warn(`WebGPU device was lost: ${info.message}, this needs to be handled`);
            }
        });

        this.initDeviceCaps();

        this.gpuContext = this.canvas.getContext('webgpu');

        // pixel format of the framebuffer is the most efficient one on the system
        const preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.backBufferFormat = preferredCanvasFormat === 'rgba8unorm' ? PIXELFORMAT_RGBA8 : PIXELFORMAT_BGRA8;

        /**
         * Configuration of the main colorframebuffer we obtain using getCurrentTexture
         *
         * @type {GPUCanvasConfiguration}
         * @private
         */
        this.canvasConfig = {
            device: this.wgpu,
            colorSpace: 'srgb',
            alphaMode: this.initOptions.alpha ? 'premultiplied' : 'opaque',

            // use preferred format for optimal performance on mobile
            format: preferredCanvasFormat,

            // RENDER_ATTACHMENT is required, COPY_SRC allows scene grab to copy out from it
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,

            // formats that views created from textures returned by getCurrentTexture may use
            viewFormats: []
        };
        this.gpuContext.configure(this.canvasConfig);

        this.createBackbuffer();

        this.clearRenderer = new WebgpuClearRenderer(this);
        this.mipmapRenderer = new WebgpuMipmapRenderer(this);
        this.resolver = new WebgpuResolver(this);

        this.postInit();

        return this;
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
        this.backBuffer = new RenderTarget({
            name: 'WebgpuFramebuffer',
            graphicsDevice: this,
            depth: this.initOptions.depth,
            stencil: this.supportsStencil,
            samples: this.samples
        });
    }

    frameStart() {

        super.frameStart();
        this.gpuProfiler.frameStart();

        // submit any commands collected before the frame rendering
        this.submit();

        WebgpuDebug.memory(this);
        WebgpuDebug.validate(this);

        // current frame color output buffer
        const outColorBuffer = this.gpuContext.getCurrentTexture();
        DebugHelper.setLabel(outColorBuffer, `${this.backBuffer.name}`);

        // reallocate framebuffer if dimensions change, to match the output texture
        if (this.backBufferSize.x !== outColorBuffer.width || this.backBufferSize.y !== outColorBuffer.height) {

            this.backBufferSize.set(outColorBuffer.width, outColorBuffer.height);

            this.backBuffer.destroy();
            this.backBuffer = null;

            this.createBackbuffer();
        }

        const rt = this.backBuffer;
        const wrt = rt.impl;

        // assign the format, allowing following init call to use it to allocate matching multisampled buffer
        wrt.setColorAttachment(0, undefined, outColorBuffer.format);

        this.initRenderTarget(rt);

        // assign current frame's render texture
        wrt.assignColorTexture(outColorBuffer);

        WebgpuDebug.end(this);
        WebgpuDebug.end(this);
    }

    frameEnd() {
        super.frameEnd();
        this.gpuProfiler.frameEnd();

        // submit scheduled command buffers
        this.submit();

        if (!this.contextLost) {
            this.gpuProfiler.request();
        }
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

    createTextureImpl(texture) {
        return new WebgpuTexture(texture);
    }

    createRenderTargetImpl(renderTarget) {
        return new WebgpuRenderTarget(renderTarget);
    }

    createBindGroupFormatImpl(bindGroupFormat) {
        return new WebgpuBindGroupFormat(bindGroupFormat);
    }

    createBindGroupImpl(bindGroup) {
        return new WebgpuBindGroup();
    }

    createComputeImpl(compute) {
        return new WebgpuCompute(compute);
    }

    /**
     * @param {number} index - Index of the bind group slot
     * @param {import('../bind-group.js').BindGroup} bindGroup - Bind group to attach
     * @param {number[]} [offsets] - Byte offsets for all uniform buffers in the bind group.
     */
    setBindGroup(index, bindGroup, offsets) {

        // TODO: this condition should be removed, it's here to handle fake grab pass, which should be refactored instead
        if (this.passEncoder) {

            // set it on the device
            this.passEncoder.setBindGroup(index, bindGroup.impl.bindGroup, offsets ?? bindGroup.uniformBufferOffsets);

            // store the active formats, used by the pipeline creation
            this.bindGroupFormats[index] = bindGroup.format.impl;
        }
    }

    submitVertexBuffer(vertexBuffer, slot) {

        const format = vertexBuffer.format;
        const { interleaved, elements } = format;
        const elementCount = elements.length;
        const vbBuffer = vertexBuffer.impl.buffer;

        if (interleaved) {
            // for interleaved buffers, we use a single vertex buffer, and attributes are specified using the layout
            this.passEncoder.setVertexBuffer(slot, vbBuffer);
            return 1;
        }

        // non-interleaved - vertex buffer per attribute
        for (let i = 0; i < elementCount; i++) {
            this.passEncoder.setVertexBuffer(slot + i, vbBuffer, elements[i].offset);
        }

        return elementCount;
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

    draw(primitive, numInstances = 1, keepBuffers) {

        if (this.shader.ready && !this.shader.failed) {

            WebgpuDebug.validate(this);

            const passEncoder = this.passEncoder;
            Debug.assert(passEncoder);

            // vertex buffers
            const vb0 = this.vertexBuffers[0];
            const vb1 = this.vertexBuffers[1];
            this.vertexBuffers.length = 0;

            if (vb0) {
                const vbSlot = this.submitVertexBuffer(vb0, 0);
                if (vb1) {
                    Debug.call(() => this.validateVBLocations(vb0, vb1));
                    this.submitVertexBuffer(vb1, vbSlot);
                }
            }

            // render pipeline
            const pipeline = this.renderPipeline.get(primitive, vb0?.format, vb1?.format, this.shader, this.renderTarget,
                                                     this.bindGroupFormats, this.blendState, this.depthState, this.cullMode,
                                                     this.stencilEnabled, this.stencilFront, this.stencilBack);
            Debug.assert(pipeline);

            if (this.pipeline !== pipeline) {
                this.pipeline = pipeline;
                passEncoder.setPipeline(pipeline);
            }

            // draw
            const ib = this.indexBuffer;
            if (ib) {
                this.indexBuffer = null;
                passEncoder.setIndexBuffer(ib.impl.buffer, ib.impl.format);
                passEncoder.drawIndexed(primitive.count, numInstances, primitive.base, 0, 0);
            } else {
                passEncoder.draw(primitive.count, numInstances, primitive.base, 0);
            }

            WebgpuDebug.end(this, {
                vb0,
                vb1,
                ib,
                primitive,
                numInstances,
                pipeline
            });
        }
    }

    setShader(shader, asyncCompile = false) {

        if (shader !== this.shader) {
            this.shader = shader;

            // #if _PROFILER
            // TODO: we should probably track other stats instead, like pipeline switches
            this._shaderSwitchesPerFrame++;
            // #endif
        }
    }

    setBlendState(blendState) {
        this.blendState.copy(blendState);
    }

    setDepthState(depthState) {
        this.depthState.copy(depthState);
    }

    setStencilState(stencilFront, stencilBack) {
        if (stencilFront || stencilBack) {
            this.stencilEnabled = true;
            this.stencilFront.copy(stencilFront ?? StencilParameters.DEFAULT);
            this.stencilBack.copy(stencilBack ?? StencilParameters.DEFAULT);

            // ref value - based on stencil front
            const ref = this.stencilFront.ref;
            if (this.stencilRef !== ref) {
                this.stencilRef = ref;
                this.passEncoder.setStencilReference(ref);
            }
        } else {
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
        this.cullMode = cullMode;
    }

    setAlphaToCoverage(state) {
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
    }

    _uploadDirtyTextures() {

        this.textures.forEach((texture) => {
            if (texture._needsUpload || texture._needsMipmaps) {
                texture.upload();
            }
        });
    }

    /**
     * Start a render pass.
     *
     * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to start.
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

        // create a new encoder for each pass
        this.commandEncoder = this.wgpu.createCommandEncoder();
        DebugHelper.setLabel(this.commandEncoder, `${renderPass.name}-Encoder`);

        // framebuffer is initialized at the start of the frame
        if (rt !== this.backBuffer) {
            this.initRenderTarget(rt);
        }

        // set up clear / store / load settings
        wrt.setupForRenderPass(renderPass);

        const renderPassDesc = wrt.renderPassDescriptor;

        // timestamp
        if (this.gpuProfiler._enabled) {
            if (this.gpuProfiler.timestampQueriesSet) {
                const slot = this.gpuProfiler.getSlot(renderPass.name);

                renderPassDesc.timestampWrites = {
                    querySet: this.gpuProfiler.timestampQueriesSet.querySet,
                    beginningOfPassWriteIndex: slot * 2,
                    endOfPassWriteIndex: slot * 2 + 1
                };
            }
        }

        // start the pass
        this.passEncoder = this.commandEncoder.beginRenderPass(renderPassDesc);
        DebugHelper.setLabel(this.passEncoder, renderPass.name);

        // push marker to the passEncoder
        DebugGraphics.pushGpuMarker(this, `Pass:${renderPass.name}`);

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
     * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to end.
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

        // generate mipmaps using the same command buffer encoder
        for (let i = 0; i < renderPass.colorArrayOps.length; i++) {
            const colorOps = renderPass.colorArrayOps[i];
            if (colorOps.mipmaps) {
                this.mipmapRenderer.generate(renderPass.renderTarget._colorBuffers[i].impl);
            }
        }

        // schedule command buffer submission
        const cb = this.commandEncoder.finish();
        DebugHelper.setLabel(cb, `${renderPass.name}-CommandBuffer`);

        this.addCommandBuffer(cb);
        this.commandEncoder = null;

        WebgpuDebug.end(this, { renderPass });
        WebgpuDebug.end(this, { renderPass });
    }

    startComputePass() {

        WebgpuDebug.internal(this);
        WebgpuDebug.validate(this);

        // create a new encoder for each pass
        this.commandEncoder = this.wgpu.createCommandEncoder();
        // DebugHelper.setLabel(this.commandEncoder, `${renderPass.name}-Encoder`);
        DebugHelper.setLabel(this.commandEncoder, 'ComputePass-Encoder');

        // clear cached encoder state
        this.pipeline = null;

        // TODO: add performance queries to compute passes

        // start the pass
        this.passEncoder = this.commandEncoder.beginComputePass();
        DebugHelper.setLabel(this.passEncoder, 'ComputePass');

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

        // schedule command buffer submission
        const cb = this.commandEncoder.finish();
        // DebugHelper.setLabel(cb, `${renderPass.name}-CommandBuffer`);
        DebugHelper.setLabel(cb, 'ComputePass-CommandBuffer');

        this.addCommandBuffer(cb);
        this.commandEncoder = null;

        WebgpuDebug.end(this);
        WebgpuDebug.end(this);
    }

    computeDispatch(computes) {

        this.startComputePass();

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

    addCommandBuffer(commandBuffer, front = false) {
        if (front) {
            this.commandBuffers.unshift(commandBuffer);
        } else {
            this.commandBuffers.push(commandBuffer);
        }
    }

    submit() {
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

            // notify dynamic buffers
            this.dynamicBuffers.onCommandBuffersSubmitted();
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

            if (!this.renderTarget.flipY) {
                y = this.renderTarget.height - y - h;
            }

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
     * @param {import('./webgpu-buffer.js').WebgpuBuffer} storageBuffer - The storage buffer.
     * @param {number} [offset] - The offset of data to clear. Defaults to 0.
     * @param {number} [size] - The size of data to clear. Defaults to the full size of the buffer.
     * @ignore
     */
    clearStorageBuffer(storageBuffer, offset = 0, size = storageBuffer.byteSize) {

        // use existing or create new encoder
        const commandEncoder = this.commandEncoder ?? this.wgpu.createCommandEncoder();

        commandEncoder.clearBuffer(storageBuffer.buffer, offset, size);

        // if we created the encoder
        if (!this.commandEncoder) {
            DebugHelper.setLabel(commandEncoder, 'ReadStorageBuffer-Encoder');
            const cb = commandEncoder.finish();
            DebugHelper.setLabel(cb, 'ReadStorageBuffer-CommandBuffer');
            this.addCommandBuffer(cb);
        }
    }

    /**
     * Read a content of a storage buffer.
     *
     * @param {import('./webgpu-buffer.js').WebgpuBuffer} storageBuffer - The storage buffer.
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

        // use existing or create new encoder
        const commandEncoder = this.commandEncoder ?? this.wgpu.createCommandEncoder();

        // copy the GPU buffer to the staging buffer
        commandEncoder.copyBufferToBuffer(storageBuffer.buffer, offset, destBuffer, 0, size);

        // if we created new encoder
        if (!this.commandEncoder) {
            DebugHelper.setLabel(commandEncoder, 'ReadStorageBuffer-Encoder');
            const cb = commandEncoder.finish();
            DebugHelper.setLabel(cb, 'ReadStorageBuffer-CommandBuffer');
            this.addCommandBuffer(cb);
        }

        return this.readBuffer(stagingBuffer, size, data, immediate);
    }

    readBuffer(stagingBuffer, size, data = null, immediate = false) {

        const destBuffer = stagingBuffer.buffer;

        // return a promise that resolves with the data
        return new Promise((resolve, reject) => {

            const read = () => {

                destBuffer?.mapAsync(GPUMapMode.READ).then(() => {

                    // copy data to a buffer
                    data ??= new Uint8Array(size);
                    const copySrc = destBuffer.getMappedRange(0, size);

                    // use the same type as the target
                    const srcType = data.constructor;
                    data.set(new srcType(copySrc));

                    // release staging buffer
                    destBuffer.unmap();
                    stagingBuffer.destroy(this);

                    resolve(data);
                });
            };

            if (immediate) {
                // submit the command buffer immediately
                this.submit();
                read();
            } else {
                // map the buffer during the next event handling cycle, when the command buffer is submitted
                setTimeout(() => {
                    read();
                });
            }
        });
    }

    /**
     * Issues a write operation of the provided data into a storage buffer.
     *
     * @param {import('./webgpu-buffer.js').WebgpuBuffer} storageBuffer - The storage buffer.
     * @param {number} bufferOffset - The offset in bytes to start writing to the storage buffer.
     * @param {ArrayBufferView} data - The data to write to the storage buffer.
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

        // use existing or create new encoder if not in a render pass
        const commandEncoder = this.commandEncoder ?? this.wgpu.createCommandEncoder();

        DebugGraphics.pushGpuMarker(this, 'COPY-RT');

        if (color) {

            // read from supplied render target, or from the framebuffer
            /** @type {GPUImageCopyTexture} */
            const copySrc = {
                texture: source ? source.colorBuffer.impl.gpuTexture : this.renderTarget.impl.assignedColorTexture,
                mipLevel: 0
            };

            // write to supplied render target, or to the framebuffer
            /** @type {GPUImageCopyTexture} */
            const copyDst = {
                texture: dest ? dest.colorBuffer.impl.gpuTexture : this.renderTarget.impl.assignedColorTexture,
                mipLevel: 0
            };

            Debug.assert(copySrc.texture !== null && copyDst.texture !== null);
            commandEncoder.copyTextureToTexture(copySrc, copyDst, copySize);
        }

        if (depth) {

            // read from supplied render target, or from the framebuffer
            const sourceRT = source ? source : this.renderTarget;
            const sourceTexture = sourceRT.impl.depthTexture;

            if (source.samples > 1) {

                // resolve the depth to a color buffer of destination render target
                const destTexture = dest.colorBuffer.impl.gpuTexture;
                this.resolver.resolveDepth(commandEncoder, sourceTexture, destTexture);

            } else {

                // write to supplied render target, or to the framebuffer
                const destTexture = dest ? dest.depthBuffer.impl.gpuTexture : this.renderTarget.impl.depthTexture;

                /** @type {GPUImageCopyTexture} */
                const copySrc = {
                    texture: sourceTexture,
                    mipLevel: 0
                };

                /** @type {GPUImageCopyTexture} */
                const copyDst = {
                    texture: destTexture,
                    mipLevel: 0
                };

                Debug.assert(copySrc.texture !== null && copyDst.texture !== null);
                commandEncoder.copyTextureToTexture(copySrc, copyDst, copySize);
            }
        }

        DebugGraphics.popGpuMarker(this);

        // if we created the encoder
        if (!this.commandEncoder) {

            DebugHelper.setLabel(commandEncoder, 'CopyRenderTarget-Encoder');

            // copy operation runs next
            const cb = commandEncoder.finish();
            DebugHelper.setLabel(cb, 'CopyRenderTarget-CommandBuffer');
            this.addCommandBuffer(cb);
        }

        return true;
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
