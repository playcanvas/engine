import { Debug, DebugHelper } from '../../../core/debug.js';
import { StringIds } from '../../../core/string-ids.js';
import { WebgpuDebug } from './webgpu-debug.js';

const stringIds = new StringIds();

/**
 * Private class storing info about color buffer.
 *
 * @ignore
 */
class ColorAttachment {
    /**
     * @type {GPUTextureFormat}
     * @private
     */
    format;

    /**
     * @type {GPUTexture}
     * @private
     */
    multisampledBuffer;

    destroy() {
        this.multisampledBuffer?.destroy();
        this.multisampledBuffer = null;
    }
}

/**
 * A WebGPU implementation of the RenderTarget.
 *
 * @ignore
 */
class WebgpuRenderTarget {
    /** @type {boolean} */
    initialized = false;

    /**
     * Unique key used by render pipeline creation
     *
     * @type {number}
     */
    key;

    /** @type {ColorAttachment[]} */
    colorAttachments = [];

    /**
     * @type {GPUTextureFormat}
     * @private
     */
    depthFormat;

    /** @type {boolean} */
    hasStencil;

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

        // color formats are based on the textures
        if (renderTarget._colorBuffers) {
            renderTarget._colorBuffers.forEach((colorBuffer, index) => {
                this.setColorAttachment(index, undefined, colorBuffer.impl.format);
            });
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

        this.colorAttachments.forEach((colorAttachment) => {
            colorAttachment.destroy();
        });
        this.colorAttachments.length = 0;
    }

    updateKey() {
        const rt = this.renderTarget;

        // key used by render pipeline creation
        let key = `${rt.samples}:${rt.depth ? this.depthFormat : 'nodepth'}`;
        this.colorAttachments.forEach((colorAttachment) => {
            key += `:${colorAttachment.format}`;
        });

        // convert string to a unique number
        this.key = stringIds.get(key);
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
        this.setColorAttachment(0, undefined, gpuTexture.format);
        this.updateKey();
    }

    setColorAttachment(index, multisampledBuffer, format) {
        if (!this.colorAttachments[index]) {
            this.colorAttachments[index] = new ColorAttachment();
        }

        if (multisampledBuffer) {
            this.colorAttachments[index].multisampledBuffer = multisampledBuffer;
        }

        if (format) {
            this.colorAttachments[index].format = format;
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

        const wgpu = device.wgpu;
        Debug.assert(!this.initialized);

        WebgpuDebug.memory(device);
        WebgpuDebug.validate(device);

        // initialize depth/stencil
        this.initDepthStencil(wgpu, renderTarget);

        // initialize color attachments
        this.renderPassDescriptor.colorAttachments = [];
        const count = renderTarget._colorBuffers?.length ?? 1;
        for (let i = 0; i < count; ++i) {
            const colorAttachment = this.initColor(wgpu, renderTarget, i);

            // default framebuffer, buffer gets assigned later
            const isDefaultFramebuffer = i === 0 && this.colorAttachments[0]?.format;

            // if we have a color buffer, or is the default framebuffer
            if (colorAttachment.view || isDefaultFramebuffer) {
                this.renderPassDescriptor.colorAttachments.push(colorAttachment);
            }
        }

        this.initialized = true;

        WebgpuDebug.end(device, { renderTarget });
        WebgpuDebug.end(device, { renderTarget });
    }

    initDepthStencil(wgpu, renderTarget) {

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

                if (samples > 1) {
                    // enable multi-sampled depth texture to be a source of our shader based resolver in WebgpuResolver
                    // TODO: we do not always need to resolve it, and so might consider this flag to be optional
                    depthTextureDesc.usage |= GPUTextureUsage.TEXTURE_BINDING;
                } else {
                    // single sampled depth buffer can be copied out (grab pass)
                    // TODO: we should not enable this for shadow maps, as it is not needed
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
    }

    /**
     * @private
     */
    initColor(wgpu, renderTarget, index) {
        // Single-sampled color buffer gets passed in:
        // - for normal render target, constructor takes the color buffer as an option
        // - for the main framebuffer, the device supplies the buffer each frame
        // And so we only need to create multi-sampled color buffer if needed here.
        /** @type {GPURenderPassColorAttachment} */
        const colorAttachment = {};

        const { samples, width, height } = renderTarget;
        const colorBuffer = renderTarget.getColorBuffer(index);

        // view used to write to the color buffer (either by rendering to it, or resolving to it)
        let colorView = null;
        if (colorBuffer) {

            // render to top mip level in case of mip-mapped buffer
            const mipLevelCount = 1;

            // cubemap face view - face is a single 2d array layer in order [+X, -X, +Y, -Y, +Z, -Z]
            if (colorBuffer.cubemap) {
                colorView = colorBuffer.impl.createView({
                    dimension: '2d',
                    baseArrayLayer: renderTarget.face,
                    arrayLayerCount: 1,
                    mipLevelCount
                });
            } else {
                colorView = colorBuffer.impl.createView({
                    mipLevelCount
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
                format: this.colorAttachments[index]?.format ?? colorBuffer.impl.format,
                usage: GPUTextureUsage.RENDER_ATTACHMENT
            };

            // allocate multi-sampled color buffer
            const multisampledColorBuffer = wgpu.createTexture(multisampledTextureDesc);
            DebugHelper.setLabel(multisampledColorBuffer, `${renderTarget.name}.multisampledColor`);
            this.setColorAttachment(index, multisampledColorBuffer, multisampledTextureDesc.format);

            colorAttachment.view = multisampledColorBuffer.createView();
            DebugHelper.setLabel(colorAttachment.view, `${renderTarget.name}.multisampledColorView`);

            colorAttachment.resolveTarget = colorView;

        } else {

            colorAttachment.view = colorView;
        }

        return colorAttachment;
    }

    /**
     * Update WebGPU render pass descriptor by RenderPass settings.
     *
     * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to start.
     */
    setupForRenderPass(renderPass) {

        Debug.assert(this.renderPassDescriptor);

        const count = this.renderPassDescriptor.colorAttachments?.length ?? 0;
        for (let i = 0; i < count; ++i) {
            const colorAttachment = this.renderPassDescriptor.colorAttachments[i];
            const colorOps = renderPass.colorArrayOps[i];
            colorAttachment.clearValue = colorOps.clearValue;
            colorAttachment.loadOp = colorOps.clear ? 'clear' : 'load';
            colorAttachment.storeOp = colorOps.store ? 'store' : 'discard';
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
