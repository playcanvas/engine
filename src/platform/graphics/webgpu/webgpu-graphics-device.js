import { Debug } from '../../../core/debug.js';

import {
    DEVICETYPE_WEBGPU, PIXELFORMAT_RGBA32F
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
     *
     * @type {WebgpuRenderState}
     */
    renderState = new WebgpuRenderState();

    /**
     * Object responsible for caching and creation of render pipelines.
     *
     * @type {WebgpuRenderPipeline}
     */
    renderPipeline = new WebgpuRenderPipeline(this);

    /**
     * Render pipeline currently set on the device.
     *
     * @type {GPURenderPipeline}
     */
    pipeline;

    /**
     * An array of bind group formats, based on currently assigned bind groups
     *
     * @type {WebgpuBindGroupFormat[]}
     */
    bindGroupFormats = [];

    constructor(canvas, options = {}) {
        super(canvas);
        this.deviceType = DEVICETYPE_WEBGPU;

        this.initDeviceCaps();
    }

    initDeviceCaps() {
        this.precision = 'hiphp';
        this.maxSamples = 4;
        this.maxTextures = 16;
        this.supportsUniformBuffers = true;
        this.supportsBoneTextures = true;
        this.supportsMorphTargetTexturesCore = true;
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
    }

    async initWebGpu() {

        if (!window.navigator.gpu) {
            throw new Error('Unable to retrieve GPU. Ensure you are using a browser that supports WebGPU rendering.');
        }

        this.glslang = await glslang();

        /** @type {GPUAdapter} */
        this.gpuAdapter = await window.navigator.gpu.requestAdapter();

        /** @type {GPUDevice} */
        this.wgpu = await this.gpuAdapter.requestDevice();

        // initially fill the window. This needs improvement.
        this.setResolution(window.innerWidth, window.innerHeight);

        this.gpuContext = this.canvas.getContext('webgpu');

        /** @type {GPUCanvasConfiguration} */
        this.canvasConfig = {
            device: this.wgpu,
            format: 'bgra8unorm'
        };
        this.gpuContext.configure(this.canvasConfig);

        this.createFramebuffer();
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
     * @param {BindGroup} bindGroup - Bind group to attach
     */
    setBindGroup(index, bindGroup) {

        // set it on the device
        this.passEncoder.setBindGroup(index, bindGroup.impl.bindGroup);

        // store the active formats, used by the pipeline creation
        this.bindGroupFormats[index] = bindGroup.format.impl;
    }

    draw(primitive, numInstances, keepBuffers) {

        const passEncoder = this.passEncoder;

        // vertex buffer
        const vb = this.vertexBuffers[0];
        this.vertexBuffers.length = 0;
        const format = vb.format;
        const elementCount = format.elements.length;
        const vbBuffer = vb.impl.buffer;
        for (let i = 0; i < elementCount; i++) {
            const element = format.elements[i];
            passEncoder.setVertexBuffer(i, vbBuffer, element.offset);
        }

        // render pipeline
        const pipeline = this.renderPipeline.get(primitive, vb.format, null, this.shader, this.renderTarget,
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
            passEncoder.drawIndexed(ib.numIndices, 1, 0, 0, 0);
        } else {
            passEncoder.draw(vb.numVertices, 1, 0, 0);
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
        if (rt === this.frameBuffer) {
            const outColorBuffer = this.gpuContext.getCurrentTexture();
            wrt.assignColorTexture(outColorBuffer);
        }

        // set up clear / store / load settings
        wrt.setupForRenderPass(renderPass);

        // TODO: test single command encoder for the whole frame
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

        Debug.logOnce("WebgpuGraphicsDevice.clear not implemented.");
        // this needs to handle (by rendering a quad):
        // - clearing of a viewport
        // - clearing of full render target in the middle of the render pass

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
    }

    setScissor(x, y, w, h) {
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
