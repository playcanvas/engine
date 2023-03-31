import { Debug, DebugHelper } from '../../../core/debug.js';
import { Vec2 } from '../../../core/math/vec2.js';

import {
    PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8, PIXELFORMAT_BGRA8, DEVICETYPE_WEBGPU
} from '../constants.js';
import { GraphicsDevice } from '../graphics-device.js';
import { RenderTarget } from '../render-target.js';

import { WebgpuBindGroup } from './webgpu-bind-group.js';
import { WebgpuBindGroupFormat } from './webgpu-bind-group-format.js';
import { WebgpuIndexBuffer } from './webgpu-index-buffer.js';
import { WebgpuRenderPipeline } from './webgpu-render-pipeline.js';
import { WebgpuRenderTarget } from './webgpu-render-target.js';
import { WebgpuShader } from './webgpu-shader.js';
import { WebgpuTexture } from './webgpu-texture.js';
import { WebgpuUniformBuffer } from './webgpu-uniform-buffer.js';
import { WebgpuVertexBuffer } from './webgpu-vertex-buffer.js';
import { WebgpuClearRenderer } from './webgpu-clear-renderer.js';
import { DebugGraphics } from '../debug-graphics.js';
import { WebgpuDebug } from './webgpu-debug.js';

class WebgpuGraphicsDevice extends GraphicsDevice {
    /**
     * The render target representing the main framebuffer.
     *
     * @type {RenderTarget}
     */
    frameBuffer;

    /**
     * Object responsible for caching and creation of render pipelines.
     */
    renderPipeline = new WebgpuRenderPipeline(this);

    /**
     * Object responsible for clearing the rendering surface by rendering a quad.
     *
     * @type { WebgpuClearRenderer }
     */
    clearRenderer;

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
     * @type {GPUCommandEncoder}
     * @private
     */
    commandEncoder;

    constructor(canvas, options = {}) {
        super(canvas);
        this.isWebGPU = true;
        this._deviceType = DEVICETYPE_WEBGPU;

        // WebGPU currently only supports 1 and 4 samples
        this.samples = options.antialias ? 4 : 1;
    }

    /**
     * Destroy the graphics device.
     */
    destroy() {
        super.destroy();
    }

    initDeviceCaps() {

        const limits = this.gpuAdapter.limits;

        this.precision = 'highp';
        this.maxPrecision = 'highp';
        this.maxSamples = 4;
        this.maxTextures = 16;
        this.maxTextureSize = limits.maxTextureDimension2D;
        this.maxCubeMapSize = limits.maxTextureDimension2D;
        this.maxVolumeSize = limits.maxTextureDimension3D;
        this.maxPixelRatio = 1;
        this.supportsInstancing = true;
        this.supportsUniformBuffers = true;
        this.supportsBoneTextures = true;
        this.supportsMorphTargetTexturesCore = true;
        this.supportsAreaLights = true;
        this.supportsDepthShadow = true;
        this.extUintElement = true;
        this.extTextureFloat = true;
        this.textureFloatRenderable = true;
        this.extTextureHalfFloat = true;
        this.textureHalfFloatRenderable = true;
        this.textureHalfFloatUpdatable = true;
        this.boneLimit = 1024;
        this.supportsImageBitmap = true;
        this.extStandardDerivatives = true;
        this.extBlendMinmax = true;
        this.areaLightLutFormat = this.floatFilterable ? PIXELFORMAT_RGBA32F : PIXELFORMAT_RGBA8;
        this.supportsTextureFetch = true;
    }

    async initWebGpu(glslangUrl, twgslUrl) {

        if (!window.navigator.gpu) {
            throw new Error('Unable to retrieve GPU. Ensure you are using a browser that supports WebGPU rendering.');
        }

        // temporary message to confirm Webgpu is being used
        Debug.log("WebgpuGraphicsDevice initialization ..");

        const loadScript = (url) => {
            return new Promise(function (resolve, reject) {
                const script = document.createElement('script');
                script.src = url;
                script.async = false;
                script.onload = function () {
                    resolve(url);
                };
                script.onerror = function () {
                    reject(new Error(`Failed to download script ${url}`));
                };
                document.body.appendChild(script);
            });
        };

        // TODO: add both loadScript calls and requestAdapter to promise list and wait for all.
        await loadScript(glslangUrl);
        await loadScript(twgslUrl);

        this.glslang = await glslang();

        const wasmPath = twgslUrl.replace('.js', '.wasm');
        this.twgsl = await twgsl(wasmPath);

        /**
         * @type {GPUAdapter}
         * @private
         */
        this.gpuAdapter = await window.navigator.gpu.requestAdapter();

        // optional features:
        //      "depth-clip-control",
        //      "depth32float-stencil8",
        //      "texture-compression-bc",
        //      "texture-compression-etc2",
        //      "texture-compression-astc",
        //      "timestamp-query",
        //      "indirect-first-instance",
        //      "shader-f16",
        //      "rg11b10ufloat-renderable",
        //      "bgra8unorm-storage",
        //      "float32-filterable"

        // request optional features
        const requiredFeatures = [];
        const requireFeature = (feature) => {
            if (this.gpuAdapter.features.has(feature)) {
                requiredFeatures.push(feature);
                Debug.log("Enabled WEBGPU feature: " + feature);
                return true;
            }
            return false;
        };
        this.floatFilterable = requireFeature('float32-filterable');

        /**
         * @type {GPUDevice}
         * @private
         */
        this.wgpu = await this.gpuAdapter.requestDevice({
            requiredFeatures,

            // Note that we can request limits, but it does not seem to be supported at the moment
            requiredLimits: {
            }
        });

        this.initDeviceCaps();

        // initially fill the window. This needs improvement.
        this.setResolution(window.innerWidth, window.innerHeight);

        this.gpuContext = this.canvas.getContext('webgpu');

        // pixel format of the framebuffer is the most efficient one on the system
        const preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.framebufferFormat = preferredCanvasFormat === 'rgba8unorm' ? PIXELFORMAT_RGBA8 : PIXELFORMAT_BGRA8;

        /**
         * Configuration of the main colorframebuffer we obtain using getCurrentTexture
         *
         * @type {GPUCanvasConfiguration}
         * @private
         */
        this.canvasConfig = {
            device: this.wgpu,
            colorSpace: 'srgb',
            alphaMode: 'opaque',  // could also be 'premultiplied'

            // use prefered format for optimal performance on mobile
            format: preferredCanvasFormat,

            // RENDER_ATTACHMENT is required, COPY_SRC allows scene grab to copy out from it
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,

            // formats that views created from textures returned by getCurrentTexture may use
            viewFormats: []
        };
        this.gpuContext.configure(this.canvasConfig);

        this.createFramebuffer();

        this.clearRenderer = new WebgpuClearRenderer(this);

        this.postInit();

        return this;
    }

    createFramebuffer() {
        this.frameBufferDimensions = new Vec2();
        this.frameBuffer = new RenderTarget({
            name: 'WebgpuFramebuffer',
            graphicsDevice: this,
            depth: true,
            samples: this.samples
        });
    }

    resizeCanvas(width, height) {

        this._width = width;
        this._height = height;

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.fire(GraphicsDevice.EVENT_RESIZE, width, height);
        }
    }

    frameStart() {

        super.frameStart();

        WebgpuDebug.memory(this);
        WebgpuDebug.validate(this);

        // current frame color output buffer
        const outColorBuffer = this.gpuContext.getCurrentTexture();
        DebugHelper.setLabel(outColorBuffer, `${this.frameBuffer.name}`);

        // reallocate framebuffer if dimensions change, to match the output texture
        if (this.frameBufferDimensions.x !== outColorBuffer.width || this.frameBufferDimensions.y !== outColorBuffer.height) {

            this.frameBufferDimensions.set(outColorBuffer.width, outColorBuffer.height);

            this.frameBuffer.destroy();
            this.frameBuffer = null;

            this.createFramebuffer();
        }

        const rt = this.frameBuffer;
        const wrt = rt.impl;

        // assign the format, allowing following init call to use it to allocate matching multisampled buffer
        wrt.colorFormat = outColorBuffer.format;

        this.initRenderTarget(rt);

        // assign current frame's render texture
        wrt.assignColorTexture(outColorBuffer);

        WebgpuDebug.end(this);
        WebgpuDebug.end(this);
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

    /**
     * @param {number} index - Index of the bind group slot
     * @param {import('../bind-group.js').BindGroup} bindGroup - Bind group to attach
     */
    setBindGroup(index, bindGroup) {

        // TODO: this condition should be removed, it's here to handle fake grab pass, which should be refactored instead
        if (this.passEncoder) {

            // set it on the device
            this.passEncoder.setBindGroup(index, bindGroup.impl.bindGroup);

            // store the active formats, used by the pipeline creation
            this.bindGroupFormats[index] = bindGroup.format.impl;
        }
    }

    submitVertexBuffer(vertexBuffer, slot) {

        const format = vertexBuffer.format;
        const elementCount = format.elements.length;
        const vbBuffer = vertexBuffer.impl.buffer;
        for (let i = 0; i < elementCount; i++) {
            const element = format.elements[i];
            this.passEncoder.setVertexBuffer(slot + i, vbBuffer, element.offset);
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
                                                     this.bindGroupFormats, this.blendState, this.depthState, this.cullMode);
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

    setBlendColor(r, g, b, a) {
        // TODO: this should use passEncoder.setBlendConstant(color)
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
     * Start a render pass.
     *
     * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to start.
     * @ignore
     */
    startPass(renderPass) {

        const rt = renderPass.renderTarget || this.frameBuffer;
        Debug.assert(rt);

        this.renderTarget = rt;

        /** @type {WebgpuRenderTarget} */
        const wrt = rt.impl;

        WebgpuDebug.internal(this);
        WebgpuDebug.validate(this);

        // framebuffer is initialized at the start of the frame
        if (rt !== this.frameBuffer) {
            this.initRenderTarget(rt);
        }

        // set up clear / store / load settings
        wrt.setupForRenderPass(renderPass);

        // create a new encoder for each pass to keep the GPU busy with commands
        this.commandEncoder = this.wgpu.createCommandEncoder();
        DebugHelper.setLabel(this.commandEncoder, renderPass.name);

        // clear cached encoder state
        this.pipeline = null;

        // start the pass
        this.passEncoder = this.commandEncoder.beginRenderPass(wrt.renderPassDescriptor);
        DebugHelper.setLabel(this.passEncoder, renderPass.name);

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
    endPass(renderPass) {

        this.passEncoder.end();
        this.passEncoder = null;

        this.wgpu.queue.submit([this.commandEncoder.finish()]);
        this.commandEncoder = null;

        WebgpuDebug.end(this, { renderPass });
        WebgpuDebug.end(this, { renderPass });

        // each render pass can use different number of bind groups
        this.bindGroupFormats.length = 0;

        this.insideRenderPass = false;
    }

    clear(options) {
        if (options.flags) {
            this.clearRenderer.clear(this, this.renderTarget, options, this.defaultClearOptions);
        }
    }

    get width() {
        return this._width;
    }

    get height() {
        return this._height;
    }

    setDepthBias(on) {
    }

    setDepthBiasValues(constBias, slopeBias) {
    }

    setStencilTest(enable) {
    }

    setStencilFunc(func, ref, mask) {
    }

    setStencilOperation(fail, zfail, zpass, writeMask) {
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

        DebugGraphics.pushGpuMarker(this, 'COPY-RT');

        // use existing or create new encoder if between render passes
        const commandEncoder = this.commandEncoder ?? this.wgpu.createCommandEncoder();

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

            // cannot copy depth from multisampled buffer. On WebGPU, it cannot be resolve at the end of the pass either,
            // and so we need to implement a custom depth resolve shader based copy
            // This is currently needed for uSceneDepthMap when the camera renders to multisampled render target
            Debug.assert(source.samples <= 1, `copyRenderTarget does not currently support copy of depth from multisampled texture ${sourceRT.name}`, sourceRT);

            /** @type {GPUImageCopyTexture} */
            const copySrc = {
                texture: sourceRT.impl.depthTexture,
                mipLevel: 0
            };

            // write to supplied render target, or to the framebuffer
            /** @type {GPUImageCopyTexture} */
            const copyDst = {
                texture: dest ? dest.depthBuffer.impl.gpuTexture : this.renderTarget.impl.depthTexture,
                mipLevel: 0
            };

            Debug.assert(copySrc.texture !== null && copyDst.texture !== null);
            commandEncoder.copyTextureToTexture(copySrc, copyDst, copySize);
        }

        // submit the encoded commands if we created the encoder
        if (!this.commandEncoder) {
            this.wgpu.queue.submit([commandEncoder.finish()]);
        }

        DebugGraphics.popGpuMarker(this);

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
