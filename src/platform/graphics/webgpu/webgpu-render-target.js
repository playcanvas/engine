import { Debug } from '../../../core/debug.js';

/**
 * A WebGPU implementation of the RenderTarget.
 *
 * @ignore
 */
class WebgpuRenderTarget {
    /** @type {boolean} */
    initialized = false;

    /** @type {string} */
    colorFormat = 'bgra8unorm';

    /**
     * Unique key used by render pipeline creation
     *
     * @type {string}
     */
    key;

    /** @type {string} */
    depthFormat = 'depth24plus-stencil8';

    /** @type {GPUTexture} */
    multisampledColorBuffer;

    /** @type {GPUTexture} */
    depthTexture = null;

    /**
     * Render pass descriptor used when starting a render pass for this render target.
     *
     * @type {GPURenderPassDescriptor}
     */
    renderPassDescriptor = {};

    /**
     * @param {import('../render-target.js').RenderTarget} renderTarget - The render target owning
     * this implementation.
     */
    constructor(renderTarget) {
        this.renderTarget = renderTarget;

        // TODO: handle shadow map case (depth only, no color)

        // key used by render pipeline creation
        this.key = `${this.colorFormat}-${renderTarget.depth ? this.depthFormat : ''}-${renderTarget.samples}`;
    }

    /**
     * @param {import('../webgpu/webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The
     * graphics device.
     */
    destroy(device) {
        this.initialized = false;
        this.renderPassDescriptor = null;

        this.depthTexture?.destroy();
        this.depthTexture = null;

        this.multisampledColorBuffer?.destroy();
        this.multisampledColorBuffer = null;
    }

    /**
     * Assign a color buffer. This allows the color buffer of the main framebuffer
     * to be swapped each frame to a buffer provided by the context.
     *
     * @param {GPUTexture} gpuTexture - The color buffer.
     */
    assignColorTexture(gpuTexture) {

        Debug.assert(gpuTexture);
        const view = gpuTexture.createView();

        // use it as render buffer or resolve target
        const colorAttachment = this.renderPassDescriptor.colorAttachments[0];
        const samples = this.renderTarget.samples;
        if (samples > 1) {
            colorAttachment.resolveTarget = view;
        } else {
            colorAttachment.view = view;
        }
    }

    /**
     * Initialize render target for rendering one time.
     *
     * @param {import('../webgpu/webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The
     * graphics device.
     * @param {import('../render-target.js').RenderTarget} renderTarget - The render target.
     */
    init(device, renderTarget) {

        Debug.assert(!this.initialized);
        Debug.assert(!renderTarget._depthBuffer, 'WebgpuRenderTarget does not yet support options.depthBuffer');
        const wgpu = device.wgpu;

        const { samples, width, height, depth } = renderTarget;

        // depth buffer that we render to (single or multi-sampled). We don't create resolve
        // depth buffer as we don't currently resolve it. This might need to change in the future.
        if (depth) {

            /** @type {GPUTextureDescriptor} */
            const depthTextureDesc = {
                size: [width, height, 1],
                dimension: '2d',
                sampleCount: samples,
                format: this.depthFormat,
                usage: GPUTextureUsage.RENDER_ATTACHMENT
            };

            // allocate depth buffer
            this.depthTexture = wgpu.createTexture(depthTextureDesc);

            /** @type {GPURenderPassDepthStencilAttachment} */
            this.renderPassDescriptor.depthStencilAttachment = {
                view: this.depthTexture.createView()
            };
        }

        // Single-sampled color buffer gets passed in:
        // - for normal render target, construction takes the color buffer as an option
        // - for the main framebuffer, the device supplies the buffer each frame
        // And so we only need to create multi-sampled color buffer if needed here.
        /** @type {GPURenderPassColorAttachment} */
        const colorAttachment = {};
        this.renderPassDescriptor.colorAttachments = [colorAttachment];

        const colorBuffer = renderTarget.colorBuffer;
        const colorView = colorBuffer ? colorBuffer.impl.getView(device) : null;

        // multi-sampled color buffer
        if (samples > 1) {

            /** @type {GPUTextureDescriptor} */
            const multisampledTextureDesc = {
                size: [width, height, 1],
                dimension: '2d',
                sampleCount: samples,
                format: this.colorFormat,
                usage: GPUTextureUsage.RENDER_ATTACHMENT
            };

            // allocate multi-sampled color buffer
            this.multisampledColorBuffer = wgpu.createTexture(multisampledTextureDesc);

            colorAttachment.view = this.multisampledColorBuffer.createView();
            colorAttachment.resolveTarget = colorView;

        } else {

            colorAttachment.view = colorView;
        }

        this.initialized = true;
    }

    /**
     * Update WebGPU render pass descriptor by RenderPass settings.
     *
     * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to start.
     */
    setupForRenderPass(renderPass) {

        Debug.assert(this.renderPassDescriptor);

        const colorAttachment = this.renderPassDescriptor.colorAttachments[0];
        if (colorAttachment) {
            colorAttachment.clearValue = renderPass.colorOps.clearValue;
            colorAttachment.loadOp = renderPass.colorOps.clear ? 'clear' : 'load';
            colorAttachment.storeOp = renderPass.colorOps.store ? 'store' : 'discard';
        }

        const depthAttachment = this.renderPassDescriptor.depthStencilAttachment;
        if (depthAttachment) {
            depthAttachment.depthClearValue = renderPass.depthStencilOps.clearDepthValue;
            depthAttachment.depthLoadOp = renderPass.depthStencilOps.clearDepth ? 'clear' : 'discard';
            depthAttachment.depthStoreOp = renderPass.depthStencilOps.storeDepth ? 'store' : 'discard';
            depthAttachment.depthReadOnly = false;

            depthAttachment.stencilClearValue = renderPass.depthStencilOps.clearStencilValue;
            depthAttachment.stencilLoadOp = renderPass.depthStencilOps.clearStencil ? 'clear' : 'discard';
            depthAttachment.stencilStoreOp = renderPass.depthStencilOps.storeStencil ? 'store' : 'discard';
            depthAttachment.stencilReadOnly = false;
        }
    }

    loseContext() {
        this.initialized = false;
    }

    resolve(device, target, color, depth) {
    }
}

export { WebgpuRenderTarget };
