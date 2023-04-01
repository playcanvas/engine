import { Debug, DebugHelper } from '../../../core/debug.js';
import { WebgpuDebug } from './webgpu-debug.js';

/**
 * A WebGPU implementation of the RenderTarget.
 *
 * @ignore
 */
class WebgpuRenderTarget {
    /** @type {boolean} */
    initialized = false;

    /** @type {string} */
    colorFormat;

    /**
     * Unique key used by render pipeline creation
     *
     * @type {string}
     */
    key;

    /** @type {string} */
    depthFormat;

    /** @type {boolean} */
    hasStencil;

    /**
     * @type {GPUTexture}
     * @private
     */
    multisampledColorBuffer;

    /**
     * @type {GPUTexture}
     * @private
     */
    depthTexture = null;

    /**
     * True if the depthTexture is internally allocated / owned
     *
     * @type {boolean}
     */
    depthTextureInternal = false;

    /**
     * Texture assigned each frame, and not owned by this render target. This is used on the
     * framebuffer to assign per frame texture obtained from the context.
     *
     * @type {GPUTexture}
     * @private
     */
    assignedColorTexture = null;

    /**
     * Render pass descriptor used when starting a render pass for this render target.
     *
     * @type {GPURenderPassDescriptor}
     * @private
     */
    renderPassDescriptor = {};

    /**
     * @param {import('../render-target.js').RenderTarget} renderTarget - The render target owning
     * this implementation.
     */
    constructor(renderTarget) {
        this.renderTarget = renderTarget;

        // color format is based on the texture
        if (renderTarget.colorBuffer) {
            this.colorFormat = renderTarget.colorBuffer.impl.format;
        }

        this.updateKey();
    }

    /**
     * Release associated resources. Note that this needs to leave this instance in a state where
     * it can be re-initialized again, which is used by render target resizing.
     *
     * @param {import('../webgpu/webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The
     * graphics device.
     */
    destroy(device) {
        this.initialized = false;

        if (this.depthTextureInternal) {
            this.depthTexture?.destroy();
            this.depthTexture = null;
        }

        this.assignedColorTexture = null;

        this.multisampledColorBuffer?.destroy();
        this.multisampledColorBuffer = null;
    }

    updateKey() {
        // key used by render pipeline creation
        const rt = this.renderTarget;
        this.key = `${this.colorFormat}-${rt.depth ? this.depthFormat : ''}-${rt.samples}`;
    }

    setDepthFormat(depthFormat) {
        Debug.assert(depthFormat);
        this.depthFormat = depthFormat;
        this.hasStencil = depthFormat === 'depth24plus-stencil8';
    }

    /**
     * Assign a color buffer. This allows the color buffer of the main framebuffer
     * to be swapped each frame to a buffer provided by the context.
     *
     * @param {any} gpuTexture - The color buffer.
     */
    assignColorTexture(gpuTexture) {

        Debug.assert(gpuTexture);
        this.assignedColorTexture = gpuTexture;

        const view = gpuTexture.createView();
        DebugHelper.setLabel(view, 'Framebuffer.assignedColor');

        // use it as render buffer or resolve target
        const colorAttachment = this.renderPassDescriptor.colorAttachments[0];
        const samples = this.renderTarget.samples;
        if (samples > 1) {
            colorAttachment.resolveTarget = view;
        } else {
            colorAttachment.view = view;
        }

        // for main framebuffer, this is how the format is obtained
        this.colorFormat = gpuTexture.format;
        this.updateKey();
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

        const wgpu = device.wgpu;

        WebgpuDebug.memory(device);
        WebgpuDebug.validate(device);

        const { samples, width, height, depth, depthBuffer } = renderTarget;

        // depth buffer that we render to (single or multi-sampled). We don't create resolve
        // depth buffer as we don't currently resolve it. This might need to change in the future.
        if (depth || depthBuffer) {

            // allocate depth buffer if not provided
            if (!depthBuffer) {

                // TODO: support rendering to 32bit depth without a stencil as well
                this.setDepthFormat('depth24plus-stencil8');

                /** @type {GPUTextureDescriptor} */
                const depthTextureDesc = {
                    size: [width, height, 1],
                    dimension: '2d',
                    sampleCount: samples,
                    format: this.depthFormat,
                    usage: GPUTextureUsage.RENDER_ATTACHMENT
                };

                // single sampled depth buffer can be copied out (grab pass), multisampled cannot
                // TODO: we should not enable this for shadow maps, as this is not needed it
                if (samples <= 1) {
                    depthTextureDesc.usage |= GPUTextureUsage.COPY_SRC;
                }

                // allocate depth buffer
                this.depthTexture = wgpu.createTexture(depthTextureDesc);
                this.depthTextureInternal = true;

            } else {

                // use provided depth buffer
                this.depthTexture = depthBuffer.impl.gpuTexture;
                this.setDepthFormat(depthBuffer.impl.format);
            }

            Debug.assert(this.depthTexture);
            DebugHelper.setLabel(this.depthTexture, `${renderTarget.name}.depthTexture`);

            // @type {GPURenderPassDepthStencilAttachment}
            this.renderPassDescriptor.depthStencilAttachment = {
                view: this.depthTexture.createView()
            };
        }

        // Single-sampled color buffer gets passed in:
        // - for normal render target, constructor takes the color buffer as an option
        // - for the main framebuffer, the device supplies the buffer each frame
        // And so we only need to create multi-sampled color buffer if needed here.
        /** @type {GPURenderPassColorAttachment} */
        const colorAttachment = {};
        this.renderPassDescriptor.colorAttachments = [];

        const colorBuffer = renderTarget.colorBuffer;
        let colorView = null;
        if (colorBuffer) {
            colorView = colorBuffer.impl.getView(device);

            // cubemap face view - face is a single 2d array layer in order [+X, -X, +Y, -Y, +Z, -Z]
            if (colorBuffer.cubemap) {
                colorView = colorBuffer.impl.createView({
                    dimension: '2d',
                    baseArrayLayer: renderTarget.face,
                    arrayLayerCount: 1
                });
            }
        }

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
            DebugHelper.setLabel(this.multisampledColorBuffer, `${renderTarget.name}.multisampledColor`);

            colorAttachment.view = this.multisampledColorBuffer.createView();
            DebugHelper.setLabel(colorAttachment.view, `${renderTarget.name}.multisampledColorView`);

            colorAttachment.resolveTarget = colorView;

        } else {

            colorAttachment.view = colorView;
        }

        // if we have color a buffer, or at least a format (main framebuffer that gets assigned later)
        if (colorAttachment.view || this.colorFormat) {
            this.renderPassDescriptor.colorAttachments.push(colorAttachment);
        }

        this.initialized = true;

        WebgpuDebug.end(device, { renderTarget });
        WebgpuDebug.end(device, { renderTarget });
    }

    /**
     * Update WebGPU render pass descriptor by RenderPass settings.
     *
     * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to start.
     */
    setupForRenderPass(renderPass) {

        Debug.assert(this.renderPassDescriptor);

        const colorAttachment = this.renderPassDescriptor.colorAttachments?.[0];
        if (colorAttachment) {
            colorAttachment.clearValue = renderPass.colorOps.clearValue;
            colorAttachment.loadOp = renderPass.colorOps.clear ? 'clear' : 'load';
            colorAttachment.storeOp = renderPass.colorOps.store ? 'store' : 'discard';
        }

        const depthAttachment = this.renderPassDescriptor.depthStencilAttachment;
        if (depthAttachment) {
            depthAttachment.depthClearValue = renderPass.depthStencilOps.clearDepthValue;
            depthAttachment.depthLoadOp = renderPass.depthStencilOps.clearDepth ? 'clear' : 'load';
            depthAttachment.depthStoreOp = renderPass.depthStencilOps.storeDepth ? 'store' : 'discard';
            depthAttachment.depthReadOnly = false;

            if (this.hasStencil) {
                depthAttachment.stencilClearValue = renderPass.depthStencilOps.clearStencilValue;
                depthAttachment.stencilLoadOp = renderPass.depthStencilOps.clearStencil ? 'clear' : 'load';
                depthAttachment.stencilStoreOp = renderPass.depthStencilOps.storeStencil ? 'store' : 'discard';
                depthAttachment.stencilReadOnly = false;
            }
        }
    }

    loseContext() {
        this.initialized = false;
    }

    resolve(device, target, color, depth) {
    }
}

export { WebgpuRenderTarget };
