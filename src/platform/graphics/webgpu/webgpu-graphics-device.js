import { TRACEID_RENDER_QUEUE } from '../../../core/constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';

import {
    PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8, PIXELFORMAT_BGRA8, DEVICETYPE_WEBGPU
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

        // temporarily disabled functionality which is not supported to avoid errors
        this.disableParticleSystem = true;

        const limits = this.gpuAdapter.limits;
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
        this.supportsInstancing = true;
        this.supportsUniformBuffers = true;
        this.supportsVolumeTextures = true;
        this.supportsBoneTextures = true;
        this.supportsMorphTargetTexturesCore = true;
        this.supportsAreaLights = true;
        this.supportsDepthShadow = true;
        this.supportsGpuParticles = false;
        this.supportsMrt = true;
        this.supportsCompute = true;
        this.extUintElement = true;
        this.extTextureFloat = true;
        this.textureFloatRenderable = true;
        this.textureHalfFloatFilterable = true;
        this.extTextureHalfFloat = true;
        this.textureHalfFloatRenderable = true;
        this.textureHalfFloatUpdatable = true;
        this.boneLimit = 1024;
        this.supportsImageBitmap = true;
        this.extStandardDerivatives = true;
        this.extBlendMinmax = true;
        this.areaLightLutFormat = this.textureFloatFilterable ? PIXELFORMAT_RGBA32F : PIXELFORMAT_RGBA8;
        this.supportsTextureFetch = true;

        // WebGPU currently only supports 1 and 4 samples
        this.samples = this.backBufferAntialias ? 4 : 1;
    }

    async initWebGpu(glslangUrl, twgslUrl) {

        if (!window.navigator.gpu) {
            throw new Error('Unable to retrieve GPU. Ensure you are using a browser that supports WebGPU rendering.');
        }

        // temporary message to confirm Webgpu is being used
        Debug.log("WebgpuGraphicsDevice initialization ..");

        // build a full URL from a relative path
        const buildUrl = (relativePath) => {
            const url = new URL(window.location.href);
            url.pathname = relativePath;
            url.search = '';
            return url.toString();
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

        // optional features:
        //      "depth-clip-control",
        //      "depth32float-stencil8",
        //      "indirect-first-instance",
        //      "shader-f16",
        //      "bgra8unorm-storage",

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

        this.textureRG11B10Renderable = requireFeature('rg11b10ufloat-renderable');
        Debug.log(`WEBGPU features: ${requiredFeatures.join(', ')}`);

        /** @type {GPUDeviceDescriptor} */
        const deviceDescr = {
            requiredFeatures,

            // Note that we can request limits, but it does not seem to be supported at the moment
            requiredLimits: {
            },

            defaultQueue: {
                label: 'Default Queue'
            }
        };

        /**
         * @type {GPUDevice}
         * @private
         */
        this.wgpu = await this.gpuAdapter.requestDevice(deviceDescr);

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

        // init dynamic buffer using 1MB allocation
        this.dynamicBuffers = new WebgpuDynamicBuffers(this, 1024 * 1024, this.limits.minUniformBufferOffsetAlignment);
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

        this.gpuProfiler.request();
    }

    createUniformBufferImpl(uniformBuffer) {
        return new WebgpuUniformBuffer(uniformBuffer);
    }

    createVertexBufferImpl(vertexBuffer, format) {
        return new WebgpuVertexBuffer(vertexBuffer, format);
    }

    createIndexBufferImpl(indexBuffer) {
        return new WebgpuIndexBuffer(indexBuffer);
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
     */
    setBindGroup(index, bindGroup) {

        // TODO: this condition should be removed, it's here to handle fake grab pass, which should be refactored instead
        if (this.passEncoder) {

            // set it on the device
            this.passEncoder.setBindGroup(index, bindGroup.impl.bindGroup, bindGroup.uniformBufferOffsets);

            // store the active formats, used by the pipeline creation
            this.bindGroupFormats[index] = bindGroup.format.impl;
        }
    }

    submitVertexBuffer(vertexBuffer, slot) {

        const elements = vertexBuffer.format.elements;
        const elementCount = elements.length;
        const vbBuffer = vertexBuffer.impl.buffer;
        for (let i = 0; i < elementCount; i++) {
            this.passEncoder.setVertexBuffer(slot + i, vbBuffer, elements[i].offset);
        }

        return elementCount;
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
                passEncoder.drawIndexed(primitive.count, numInstances, 0, 0, 0);
            } else {
                passEncoder.draw(primitive.count, numInstances, 0, 0);
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

    setShader(shader) {

        this.shader = shader;

        // #if _PROFILER
        // TODO: we should probably track other stats instead, like pipeline switches
        this._shaderSwitchesPerFrame++;
        // #endif

        return true;
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
     * Copies source render target into destination render target. Mostly used by post-effects.
     *
     * @param {RenderTarget} [source] - The source render target. Defaults to frame buffer.
     * @param {RenderTarget} [dest] - The destination render target. Defaults to frame buffer.
     * @param {boolean} [color] - If true will copy the color buffer. Defaults to false.
     * @param {boolean} [depth] - If true will copy the depth buffer. Defaults to false.
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
        DebugHelper.setLabel(commandEncoder, 'CopyRenderTarget-Encoder');

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
