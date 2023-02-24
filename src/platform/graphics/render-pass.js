import { Color } from '../../core/math/color.js';
import { DebugGraphics } from '../graphics/debug-graphics.js';

class ColorAttachmentOps {
    /**
     * A color used to clear the color attachment when the clear is enabled.
     */
    clearValue = new Color(0, 0, 0, 1);

    /**
     * True if the attachment should be cleared before rendering, false to preserve
     * the existing content.
     */
    clear = false;

    /**
     * True if the attachment needs to be stored after the render pass. False
     * if it can be discarded.
     * Note: This relates to the surface that is getting rendered to, and can be either
     * single or multi-sampled. Further, if a multi-sampled surface is used, the resolve
     * flag further specifies if this gets resolved to a single-sampled surface. This
     * behavior matches the WebGPU specification.
     *
     * @type {boolean}
     */
    store = false;

    /**
     * True if the attachment needs to be resolved.
     *
     * @type {boolean}
     */
    resolve = true;

    /**
     * True if the attachment needs to have mipmaps generated.
     *
     * @type {boolean}
     */
    mipmaps = false;
}

class DepthStencilAttachmentOps {
    /**
     * A depth value used to clear the depth attachment when the clear is enabled.
     */
    clearDepthValue = 1;

    /**
     * A stencil value used to clear the stencil attachment when the clear is enabled.
     */
    clearStencilValue = 0;

    /**
     * True if the depth attachment should be cleared before rendering, false to preserve
     * the existing content.
     */
    clearDepth = false;

    /**
     * True if the stencil attachment should be cleared before rendering, false to preserve
     * the existing content.
     */
    clearStencil = false;

    /**
     * True if the depth attachment needs to be stored after the render pass. False
     * if it can be discarded.
     *
     * @type {boolean}
     */
    storeDepth = false;

    /**
     * True if the stencil attachment needs to be stored after the render pass. False
     * if it can be discarded.
     *
     * @type {boolean}
     */
    storeStencil = false;
}

/**
 * A render pass represents a node in the frame graph, and encapsulates a system which
 * renders to a render target using an execution callback.
 *
 * @ignore
 */
class RenderPass {
    /** @type {string} */
    name;

    /** @type {import('../graphics/render-target.js').RenderTarget} */
    renderTarget;

    /**
     * Number of samples. 0 if no render target, otherwise number of samples from the render target,
     * or the main framebuffer if render target is null.
     *
     * @type {number}
     */
    samples = 0;

    /** @type {ColorAttachmentOps} */
    colorOps;

    /** @type {DepthStencilAttachmentOps} */
    depthStencilOps;

    /**
     * If true, this pass might use dynamically rendered cubemaps. Use for a case where rendering to cubemap
     * faces is interleaved with rendering to shadows, to avoid generating cubemap mipmaps. This will likely
     * be retired when render target dependency tracking gets implemented.
     *
     * @type {boolean}
     */
    requiresCubemaps = true;

    /**
     * True if the render pass uses the full viewport / scissor for rendering into the render target.
     *
     * @type {boolean}
     */
    fullSizeClearRect = true;

    /**
     * Custom function that is called to render the pass.
     *
     * @type {Function}
     */
    execute;

    /**
     * Custom function that is called before the pass has started.
     *
     * @type {Function}
     */
    before;

    /**
     * Custom function that is called after the pass has fnished.
     *
     * @type {Function}
     */
    after;

    /**
     * Creates an instance of the RenderPass.
     *
     * @param {import('../graphics/graphics-device.js').GraphicsDevice} graphicsDevice - The
     * graphics device.
     * @param {Function} [execute] - Custom function that is called to render the pass.
     */
    constructor(graphicsDevice, execute) {
        this.device = graphicsDevice;

        /** @type {Function} */
        this.execute = execute;
    }

    /**
     * @param {import('../graphics/render-target.js').RenderTarget} renderTarget - The render
     * target to render into (output). This function should be called only for render passes which
     * use render target, or passes which render directly into the default framebuffer, in which
     * case a null or undefined render target is expected.
     */
    init(renderTarget) {

        // null represents the default framebuffer
        this.renderTarget = renderTarget || null;

        // allocate ops only when render target is used
        this.colorOps = new ColorAttachmentOps();
        this.depthStencilOps = new DepthStencilAttachmentOps();

        // defaults depend on multisampling
        this.samples = Math.max(this.renderTarget ? this.renderTarget.samples : this.device.samples, 1);

        // if rendering to single-sampled buffer, this buffer needs to be stored
        if (this.samples === 1) {
            this.colorOps.store = true;
            this.colorOps.resolve = false;
        }

        // if render target needs mipmaps
        if (this.renderTarget?.colorBuffer?.mipmaps) {
            this.colorOps.mipmaps = true;
        }
    }

    /**
     * Mark render pass as clearing the full color buffer.
     *
     * @param {Color} color - The color to clear to.
     */
    setClearColor(color) {
        this.colorOps.clearValue.copy(color);
        this.colorOps.clear = true;
    }

    /**
     * Mark render pass as clearing the full depth buffer.
     *
     * @param {number} depthValue - The depth value to clear to.
     */
    setClearDepth(depthValue) {
        this.depthStencilOps.clearDepthValue = depthValue;
        this.depthStencilOps.clearDepth = true;
    }

    /**
     * Mark render pass as clearing the full stencil buffer.
     *
     * @param {number} stencilValue - The stencil value to clear to.
     */
    setClearStencil(stencilValue) {
        this.depthStencilOps.clearStencilValue = stencilValue;
        this.depthStencilOps.clearStencil = true;
    }

    /**
     * Render the render pass
     */
    render() {

        const device = this.device;
        const realPass = this.renderTarget !== undefined;
        DebugGraphics.pushGpuMarker(device, `Pass:${this.name}`);

        this.before?.();

        if (realPass) {
            device.startPass(this);
        }

        this.execute?.();

        if (realPass) {
            device.endPass(this);
        }

        this.after?.();

        DebugGraphics.popGpuMarker(device);

    }
}

export { RenderPass, ColorAttachmentOps, DepthStencilAttachmentOps };
