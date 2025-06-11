import { Debug, DebugHelper } from '../../../core/debug.js';
import { StringIds } from '../../../core/string-ids.js';
import { getMultisampledTextureCache } from '../multi-sampled-texture-cache.js';
import { WebgpuDebug } from './webgpu-debug.js';

/**
 * @import { RenderPass } from '../render-pass.js'
 * @import { RenderTarget } from '../render-target.js'
 * @import { WebgpuGraphicsDevice } from '../webgpu/webgpu-graphics-device.js'
 */

const stringIds = new StringIds();

/**
 * Private class storing info about color buffer.
 *
 * @private
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
 * Private class storing info about depth-stencil buffer.
 *
 * @private
 */
class DepthAttachment {
    /**
     * @type {GPUTextureFormat}
     * @private
     */
    format;

    /** @type {boolean} */
    hasStencil;

    /**
     * @type {GPUTexture|null}
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
     * Multi-sampled depth buffer allocated over the user provided depth buffer.
     *
     * @type {GPUTexture|null}
     * @private
     */
    multisampledDepthBuffer = null;

    /**
     * Key used to store multisampledDepthBuffer in the cache.
     */
    multisampledDepthBufferKey;

    /**
     * @param {string} gpuFormat - The WebGPU format (GPUTextureFormat).
     */
    constructor(gpuFormat) {
        Debug.assert(gpuFormat);
        this.format = gpuFormat;
        this.hasStencil = gpuFormat === 'depth24plus-stencil8';
    }

    destroy(device) {
        if (this.depthTextureInternal) {
            this.depthTexture?.destroy();
            this.depthTexture = null;
        }

        // release multi-sampled depth buffer
        if (this.multisampledDepthBuffer) {

            this.multisampledDepthBuffer = null;

            // release reference to the texture, as its ref-counted
            getMultisampledTextureCache(device).release(this.multisampledDepthBufferKey);
        }
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

    /** @type {DepthAttachment|null} */
    depthAttachment = null;

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
     * True if this is the backbuffer of the device.
     *
     * @type {boolean}
     */
    isBackbuffer = false;

    /**
     * @param {RenderTarget} renderTarget - The render target owning this implementation.
     */
    constructor(renderTarget) {
        this.renderTarget = renderTarget;
    }

    /**
     * Release associated resources. Note that this needs to leave this instance in a state where
     * it can be re-initialized again, which is used by render target resizing.
     *
     * @param {WebgpuGraphicsDevice} device - The graphics device.
     */
    destroy(device) {
        this.initialized = false;

        this.assignedColorTexture = null;

        this.colorAttachments.forEach((colorAttachment) => {
            colorAttachment.destroy();
        });
        this.colorAttachments.length = 0;

        this.depthAttachment?.destroy(device);
        this.depthAttachment = null;
    }

    updateKey() {
        const rt = this.renderTarget;

        // key used by render pipeline creation
        let key = `${rt.samples}:${this.depthAttachment ? this.depthAttachment.format : 'nodepth'}`;
        this.colorAttachments.forEach((colorAttachment) => {
            key += `:${colorAttachment.format}`;
        });

        // convert string to a unique number
        this.key = stringIds.get(key);
    }

    /**
     * Assign a color buffer. This allows the color buffer of the main framebuffer
     * to be swapped each frame to a buffer provided by the context.
     *
     * @param {WebgpuGraphicsDevice} device - The WebGPU graphics device.
     * @param {any} gpuTexture - The color buffer.
     */
    assignColorTexture(device, gpuTexture) {

        Debug.assert(gpuTexture);
        this.assignedColorTexture = gpuTexture;

        // create view (optionally handles srgb conversion)
        const view = gpuTexture.createView({ format: device.backBufferViewFormat });
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
        this.setColorAttachment(0, undefined, device.backBufferViewFormat);

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
     * @param {WebgpuGraphicsDevice} device - The graphics device.
     * @param {RenderTarget} renderTarget - The render target.
     */
    init(device, renderTarget) {

        const wgpu = device.wgpu;
        Debug.assert(!this.initialized);

        WebgpuDebug.memory(device);
        WebgpuDebug.validate(device);

        // initialize depth/stencil
        this.initDepthStencil(device, wgpu, renderTarget);

        // initialize color attachments

        // color formats are based on the textures
        if (renderTarget._colorBuffers) {
            renderTarget._colorBuffers.forEach((colorBuffer, index) => {
                this.setColorAttachment(index, undefined, colorBuffer.impl.format);
            });
        }

        this.renderPassDescriptor.colorAttachments = [];
        const count = this.isBackbuffer ? 1 : (renderTarget._colorBuffers?.length ?? 0);
        for (let i = 0; i < count; ++i) {
            const colorAttachment = this.initColor(device, wgpu, renderTarget, i);

            // default framebuffer, buffer gets assigned later
            const isDefaultFramebuffer = i === 0 && this.colorAttachments[0]?.format;

            // if we have a color buffer, or is the default framebuffer
            if (colorAttachment.view || isDefaultFramebuffer) {
                this.renderPassDescriptor.colorAttachments.push(colorAttachment);
            }
        }

        this.updateKey();

        this.initialized = true;

        WebgpuDebug.end(device, 'RenderTarget initialization', { renderTarget });
        WebgpuDebug.end(device, 'RenderTarget initialization', { renderTarget });
    }

    initDepthStencil(device, wgpu, renderTarget) {

        const { samples, width, height, depth, depthBuffer } = renderTarget;

        // depth buffer that we render to (single or multi-sampled). We don't create resolve
        // depth buffer as we don't currently resolve it. This might need to change in the future.
        if (depth || depthBuffer) {

            // the depth texture view the rendering will write to
            let renderingView;

            // allocate depth buffer if not provided
            if (!depthBuffer) {

                // TODO: support rendering to 32bit depth without a stencil as well
                this.depthAttachment = new DepthAttachment('depth24plus-stencil8');

                /** @type {GPUTextureDescriptor} */
                const depthTextureDesc = {
                    size: [width, height, 1],
                    dimension: '2d',
                    sampleCount: samples,
                    format: this.depthAttachment.format,
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
                const depthTexture = wgpu.createTexture(depthTextureDesc);
                DebugHelper.setLabel(depthTexture, `${renderTarget.name}.autoDepthTexture`);
                this.depthAttachment.depthTexture = depthTexture;
                this.depthAttachment.depthTextureInternal = true;

                renderingView = depthTexture.createView();
                DebugHelper.setLabel(renderingView, `${renderTarget.name}.autoDepthView`);

            } else {  // use provided depth buffer

                this.depthAttachment = new DepthAttachment(depthBuffer.impl.format);

                if (samples > 1) {  // create a multi-sampled depth buffer for the provided depth buffer

                    // single-sampled depthBuffer.impl.format can be R32F in some cases, but that cannot be used as a depth
                    // buffer, only as a texture to resolve it to. We always use depth24plus-stencil8 for msaa depth buffers.
                    const depthFormat = 'depth24plus-stencil8';
                    this.depthAttachment.format = depthFormat;
                    this.depthAttachment.hasStencil = depthFormat === 'depth24plus-stencil8';

                    // key for matching multi-sampled depth buffer
                    const key = `${depthBuffer.id}:${width}:${height}:${samples}:${depthFormat}`;

                    // check if we have already allocated a multi-sampled depth buffer for the depth buffer
                    const msTextures = getMultisampledTextureCache(device);
                    let msDepthTexture = msTextures.get(key); // this incRefs it if found
                    if (!msDepthTexture) {

                        /** @type {GPUTextureDescriptor} */
                        const multisampledDepthDesc = {
                            size: [width, height, 1],
                            dimension: '2d',
                            sampleCount: samples,
                            format: depthFormat,
                            usage: GPUTextureUsage.RENDER_ATTACHMENT |
                                // if msaa and resolve targets are different formats, we need to be able to bind the msaa target as a texture for manual shader resolve
                                (depthFormat !== depthBuffer.impl.format ? GPUTextureUsage.TEXTURE_BINDING : 0)
                        };

                        // allocate multi-sampled depth buffer
                        msDepthTexture = wgpu.createTexture(multisampledDepthDesc);
                        DebugHelper.setLabel(msDepthTexture, `${renderTarget.name}.multisampledDepth`);

                        // store it in the cache
                        msTextures.set(key, msDepthTexture);
                    }

                    this.depthAttachment.multisampledDepthBuffer = msDepthTexture;
                    this.depthAttachment.multisampledDepthBufferKey = key;

                    renderingView = msDepthTexture.createView();
                    DebugHelper.setLabel(renderingView, `${renderTarget.name}.multisampledDepthView`);

                } else {

                    // use provided depth buffer
                    const depthTexture = depthBuffer.impl.gpuTexture;
                    this.depthAttachment.depthTexture = depthTexture;

                    renderingView = depthTexture.createView();
                    DebugHelper.setLabel(renderingView, `${renderTarget.name}.depthView`);
                }
            }

            Debug.assert(renderingView);
            this.renderPassDescriptor.depthStencilAttachment = {
                view: renderingView
            };
        }
    }

    /**
     * @param {WebgpuGraphicsDevice} device - The graphics device.
     * @param {GPUDevice} wgpu - The WebGPU device.
     * @param {RenderTarget} renderTarget - The render target.
     * @param {number} index - The color buffer index.
     * @returns {GPURenderPassColorAttachment} The color attachment.
     * @private
     */
    initColor(device, wgpu, renderTarget, index) {
        // Single-sampled color buffer gets passed in:
        // - for normal render target, constructor takes the color buffer as an option
        // - for the main framebuffer, the device supplies the buffer each frame
        // And so we only need to create multi-sampled color buffer if needed here.
        /** @type {GPURenderPassColorAttachment} */
        const colorAttachment = {};

        const { samples, width, height, mipLevel } = renderTarget;
        const colorBuffer = renderTarget.getColorBuffer(index);

        // view used to write to the color buffer (either by rendering to it, or resolving to it)
        let colorView = null;
        if (colorBuffer) {

            // render to a single mip level
            const mipLevelCount = 1;

            // cubemap face view - face is a single 2d array layer in order [+X, -X, +Y, -Y, +Z, -Z]
            if (colorBuffer.cubemap) {
                colorView = colorBuffer.impl.createView({
                    dimension: '2d',
                    baseArrayLayer: renderTarget.face,
                    arrayLayerCount: 1,
                    mipLevelCount,
                    baseMipLevel: mipLevel
                });
            } else {
                colorView = colorBuffer.impl.createView({
                    mipLevelCount,
                    baseMipLevel: mipLevel
                });
            }
        }

        // multi-sampled color buffer
        if (samples > 1) {

            const format = this.isBackbuffer ? device.backBufferViewFormat : colorBuffer.impl.format;

            /** @type {GPUTextureDescriptor} */
            const multisampledTextureDesc = {
                size: [width, height, 1],
                dimension: '2d',
                sampleCount: samples,
                format: format,
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
     * @param {RenderPass} renderPass - The render pass to start.
     * @param {RenderTarget} renderTarget - The render target to render to.
     */
    setupForRenderPass(renderPass, renderTarget) {

        Debug.assert(this.renderPassDescriptor);

        const count = this.renderPassDescriptor.colorAttachments?.length ?? 0;
        for (let i = 0; i < count; ++i) {
            const colorAttachment = this.renderPassDescriptor.colorAttachments[i];
            const colorOps = renderPass.colorArrayOps[i];
            const srgb = renderTarget.isColorBufferSrgb(i);
            colorAttachment.clearValue = srgb ? colorOps.clearValueLinear : colorOps.clearValue;
            colorAttachment.loadOp = colorOps.clear ? 'clear' : 'load';
            colorAttachment.storeOp = colorOps.store ? 'store' : 'discard';
        }

        const depthAttachment = this.renderPassDescriptor.depthStencilAttachment;
        if (depthAttachment) {
            depthAttachment.depthClearValue = renderPass.depthStencilOps.clearDepthValue;
            depthAttachment.depthLoadOp = renderPass.depthStencilOps.clearDepth ? 'clear' : 'load';
            depthAttachment.depthStoreOp = renderPass.depthStencilOps.storeDepth ? 'store' : 'discard';
            depthAttachment.depthReadOnly = false;

            if (this.depthAttachment.hasStencil) {
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
