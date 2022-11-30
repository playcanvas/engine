import { Debug } from '../../../core/debug.js';

import {
    DEVICETYPE_WEBGPU, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8, PIXELFORMAT_BGRA8
} from '../constants.js';
import { GraphicsDevice } from '../graphics-device.js';
import { RenderTarget } from '../render-target.js';

import { WebgpuBindGroup } from './webgpu-bind-group.js';
import { WebgpuBindGroupFormat } from './webgpu-bind-group-format.js';
import { WebgpuIndexBuffer } from './webgpu-index-buffer.js';
import { WebgpuRenderPipeline } from './webgpu-render-pipeline.js';
import { WebgpuRenderState } from './webgpu-render-state.js';
import { WebgpuRenderTarget } from './webgpu-render-target.js';
import { WebgpuShader } from './webgpu-shader.js';
import { WebgpuTexture } from './webgpu-texture.js';
import { WebgpuUniformBuffer } from './webgpu-uniform-buffer.js';
import { WebgpuVertexBuffer } from './webgpu-vertex-buffer.js';
import { WebgpuClearRenderer } from './webgpu-clear-renderer.js';
import { DebugGraphics } from '../debug-graphics.js';

class WebgpuGraphicsDevice extends GraphicsDevice {
    /**
     * The render target representing the main framebuffer.
     *
     * @type {RenderTarget}
     */
    frameBuffer;

    /**
     * Internal representation of the current render state, as requested by the renderer.
     * In the future this can be completely replaced by a more optimal solution, where
     * render states are bundled together (DX11 style) and set using a single call.
     */
    renderState = new WebgpuRenderState();

    /**
     * Object responsible for caching and creation of render pipelines.
     */
    renderPipeline = new WebgpuRenderPipeline(this);

    /**
     * Object responsible for clearing the rendering surface by rendering a quad.
     */
    clearRenderer = new WebgpuClearRenderer();

    /**
     * Render pipeline currently set on the device.
     *
     * // type {GPURenderPipeline}
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
     * type {GPUCommandEncoder}
     */
    commandEncoder;

    constructor(canvas, options = {}) {
        super(canvas);
        this.deviceType = DEVICETYPE_WEBGPU;

        this.initDeviceCaps();
    }

    initDeviceCaps() {
        this.precision = 'hiphp';
        this.maxSamples = 4;
        this.maxTextures = 16;
        this.maxPixelRatio = 1;
        this.supportsInstancing = true;
        this.supportsUniformBuffers = true;
        this.supportsBoneTextures = true;
        this.supportsMorphTargetTexturesCore = true;
        this.supportsAreaLights = true;
        this.extUintElement = true;
        this.extTextureFloat = true;
        this.textureFloatRenderable = true;
        this.extTextureHalfFloat = true;
        this.textureHalfFloatRenderable = true;
        this.textureHalfFloatUpdatable = true;
        this.maxTextureSize = 4096;
        this.boneLimit = 1024;
        this.supportsImageBitmap = true;
        this.extStandardDerivatives = true;
        this.areaLightLutFormat = PIXELFORMAT_RGBA32F;
        this.supportsTextureFetch = true;
    }

    async initWebGpu(glslangUrl) {

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

        // TODO: add loadScript and requestAdapter to promise list and wait for both.
        await loadScript(glslangUrl);

        this.glslang = await glslang();

        // type {GPUAdapter}
        this.gpuAdapter = await window.navigator.gpu.requestAdapter();

        // type {GPUDevice}
        this.wgpu = await this.gpuAdapter.requestDevice();

        // initially fill the window. This needs improvement.
        this.setResolution(window.innerWidth, window.innerHeight);

        this.gpuContext = this.canvas.getContext('webgpu');

        // pixel format of the framebuffer is the most efficient one on the system
        const preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.framebufferFormat = preferredCanvasFormat === 'rgba8unorm' ? PIXELFORMAT_RGBA8 : PIXELFORMAT_BGRA8;

        // this is configuration of the main colorframebuffer we obtain using getCurrentTexture
        // type {GPUCanvasConfiguration}
        this.canvasConfig = {
            device: this.wgpu,
            colorSpace: 'srgb',
            alphaMode: 'opaque',  // could also be 'premultiplied'

            // use prefered format for optimal performance on mobile
            format: preferredCanvasFormat,

            // RENDER_ATTACHMENT is required, COPY_SRC allows scene grab to copy out from it
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,

            // formats that views created from textures returned by getCurrentTexture may use
            viewFormats: []
        };
        this.gpuContext.configure(this.canvasConfig);

        this.createFramebuffer();

        return this;
    }

    createFramebuffer() {
        this.frameBuffer = new RenderTarget({
            name: 'WebgpuFramebuffer',
            graphicsDevice: this,
            depth: true,
            samples: 4
        });
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

        const passEncoder = this.passEncoder;

        // vertex buffers
        const vb0 = this.vertexBuffers[0];
        const vbSlot = this.submitVertexBuffer(vb0, 0);
        const vb1 = this.vertexBuffers[1];
        if (vb1) {
            this.submitVertexBuffer(vb1, vbSlot);
        }
        this.vertexBuffers.length = 0;

        // render pipeline
        const pipeline = this.renderPipeline.get(primitive, vb0.format, vb1?.format, this.shader, this.renderTarget,
                                                 this.bindGroupFormats, this.renderState);
        Debug.assert(pipeline);

        if (this.pipeline !== pipeline) {
            this.pipeline = pipeline;
            passEncoder.setPipeline(pipeline);
        }

        // draw
        const ib = this.indexBuffer;
        if (ib) {
            passEncoder.setIndexBuffer(ib.impl.buffer, ib.impl.format);
            passEncoder.drawIndexed(ib.numIndices, numInstances, 0, 0, 0);
        } else {
            passEncoder.draw(vb0.numVertices, numInstances, 0, 0);
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

    setBlending(blending) {
        this.renderState.setBlending(blending);
    }

    setBlendFunction(blendSrc, blendDst) {
        this.renderState.setBlendFunction(blendSrc, blendDst);
    }

    setBlendEquation(blendEquation) {
        this.renderState.setBlendEquation(blendEquation);
    }

    setDepthFunc(func) {
    }

    setDepthTest(depthTest) {
    }

    setCullMode(cullMode) {
    }

    setAlphaToCoverage(state) {
    }

    setColorWrite(writeRed, writeGreen, writeBlue, writeAlpha) {
    }

    setDepthWrite(writeDepth) {
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
        const wrt = rt.impl;

        this.initRenderTarget(rt);

        // assign current frame's render texture if rendering to the main frame buffer
        // TODO: this should probably be done at the start of the frame, so that it can be used
        // as a destination of the copy operation
        if (rt === this.frameBuffer) {
            const outColorBuffer = this.gpuContext.getCurrentTexture();
            wrt.assignColorTexture(outColorBuffer);
        }

        // set up clear / store / load settings
        wrt.setupForRenderPass(renderPass);

        // create a new encoder for each pass to keep the GPU busy with commands
        this.commandEncoder = this.wgpu.createCommandEncoder();

        // clear cached encoder state
        this.pipeline = null;

        // start the pass
        this.passEncoder = this.commandEncoder.beginRenderPass(wrt.renderPassDescriptor);
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
    }

    clear(options) {
        if (options.flags) {
            this.clearRenderer.clear(this, this.renderTarget, options);
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

    setStencilTest(enable) {
    }

    setViewport(x, y, w, h) {
        // TODO: only execute when it changes. Also, the viewport of encoder  matches the rendering attachments,
        // so we can skip this if fullscreen
        // TODO: this condition should be removed, it's here to handle fake grab pass, which should be refactored instead
        if (this.passEncoder) {
            this.passEncoder.setViewport(x, this.renderTarget.height - y - h, w, h, 0, 1);
        }
    }

    setScissor(x, y, w, h) {
        // TODO: only execute when it changes. Also, the viewport of encoder  matches the rendering attachments,
        // so we can skip this if fullscreen
        // TODO: this condition should be removed, it's here to handle fake grab pass, which should be refactored instead
        if (this.passEncoder) {
            this.passEncoder.setScissorRect(x, this.renderTarget.height - y - h, w, h);
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

        // type {GPUExtent3D}
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
            // type {GPUImageCopyTexture}
            const copySrc = {
                texture: source ? source.colorBuffer.impl.gpuTexture : this.renderTarget.impl.assignedColorTexture,
                mipLevel: 0
            };

            // write to supplied render target, or to the framebuffer
            // type {GPUImageCopyTexture}
            const copyDst = {
                texture: dest ? dest.colorBuffer.impl.gpuTexture : this.renderTarget.impl.assignedColorTexture,
                mipLevel: 0
            };

            Debug.assert(copySrc.texture !== null && copyDst.texture !== null);
            commandEncoder.copyTextureToTexture(copySrc, copyDst, copySize);
        }

        if (depth) {
            Debug.assert("copyRenderTarget does not handle depth copy yet.");
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
