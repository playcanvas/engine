import { Debug } from '../../core/debug.js';
import { Tracing } from '../../core/tracing.js';
import { Color } from '../../core/math/color.js';
import { TRACEID_RENDER_PASS, TRACEID_RENDER_PASS_DETAIL } from '../../core/constants.js';

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
    _name;

    /**
     * The graphics device.
     *
     * @type {import('../graphics/graphics-device.js').GraphicsDevice}
     */
    device;

    /**
     * True if the render pass is enabled.
     *
     * @type {boolean}
     * @private
     */
    _enabled = true;

    /**
     * True if the render pass is enabled and execute function will be called. Note that before and
     * after functions are called regardless of this flag.
     */
    executeEnabled = true;

    /**
     * The render target for this render pass:
     *  - `undefined`: render pass does not render to any render target
     *  - `null`: render pass renders to the backbuffer
     *  - Otherwise, renders to the provided RT.
     * @type {import('../graphics/render-target.js').RenderTarget|null|undefined}
     */
    renderTarget;

    /**
     * The options specified when the render target was initialized.
     */
    _options;

    /**
     * Number of samples. 0 if no render target, otherwise number of samples from the render target,
     * or the main framebuffer if render target is null.
     *
     * @type {number}
     */
    samples = 0;

    /**
     * Array of color attachment operations. The first element corresponds to the color attachment
     * 0, and so on.
     *
     * @type {Array<ColorAttachmentOps>}
     */
    colorArrayOps = [];

    /**
     * Color attachment operations for the first color attachment.
     *
     * @type {ColorAttachmentOps}
     */
    get colorOps() {
        return this.colorArrayOps[0];
    }

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
     * Render passes which need to be executed before this pass.
     *
     * @type {RenderPass[]}
     */
    beforePasses = [];

    /**
     * Render passes which need to be executed after this pass.
     *
     * @type {RenderPass[]}
     */
    afterPasses = [];

    /**
     * Creates an instance of the RenderPass.
     *
     * @param {import('../graphics/graphics-device.js').GraphicsDevice} graphicsDevice - The
     * graphics device.
     */
    constructor(graphicsDevice) {
        Debug.assert(graphicsDevice);
        this.device = graphicsDevice;
    }

    set name(value) {
        this._name = value;
    }

    get name() {
        if (!this._name)
            this._name = this.constructor.name;
        return this._name;
    }

    set options(value) {
        this._options = value;

        // sanitize options
        if (value) {
            this._options.scaleX = this._options.scaleX ?? 1;
            this._options.scaleY = this._options.scaleY ?? 1;
        }
    }

    get options() {
        return this._options;
    }

    /**
     * @param {import('../graphics/render-target.js').RenderTarget|null} [renderTarget] - The render
     * target to render into (output). This function should be called only for render passes which
     * use render target, or passes which render directly into the default framebuffer, in which
     * case a null or undefined render target is expected.
     * @param {object} [options] - Object for passing optional arguments.
     * @param {import('./texture.js').Texture} [options.resizeSource] - A texture to use as a source
     * for the automatic render target resize operation. If not provided, no automatic resizing
     * takes place.
     * @param {number} [options.scaleX] - The scale factor for the render target width. Defaults to 1.
     * @param {number} [options.scaleY] - The scale factor for the render target height. Defaults to 1.
     */
    init(renderTarget = null, options) {

        this.options = options;

        // null represents the default framebuffer
        this.renderTarget = renderTarget;

        // defaults depend on multisampling
        this.samples = Math.max(this.renderTarget ? this.renderTarget.samples : this.device.samples, 1);

        // allocate ops only when render target is used
        this.depthStencilOps = new DepthStencilAttachmentOps();

        const numColorOps = renderTarget ? renderTarget._colorBuffers?.length : 1;

        this.colorArrayOps.length = 0;
        for (let i = 0; i < numColorOps; i++) {
            const colorOps = new ColorAttachmentOps();
            this.colorArrayOps[i] = colorOps;

            // if rendering to single-sampled buffer, this buffer needs to be stored
            if (this.samples === 1) {
                colorOps.store = true;
                colorOps.resolve = false;
            }

            // if render target needs mipmaps
            if (this.renderTarget?._colorBuffers?.[i].mipmaps) {
                colorOps.mipmaps = true;
            }
        }

        this.postInit();
    }

    destroy() {
    }

    postInit() {
    }

    frameUpdate() {
        // resize the render target if needed
        if (this._options && this.renderTarget) {
            const resizeSource = this._options.resizeSource ?? this.device.backBuffer;
            const width = Math.floor(resizeSource.width * this._options.scaleX);
            const height = Math.floor(resizeSource.height * this._options.scaleY);
            this.renderTarget.resize(width, height);
        }
    }

    before() {
    }

    execute() {
    }

    after() {
    }

    onEnable() {
    }

    onDisable() {
    }

    set enabled(value) {
        if (this._enabled !== value) {
            this._enabled = value;
            if (value) {
                this.onEnable();
            } else {
                this.onDisable();
            }
        }
    }

    get enabled() {
        return this._enabled;
    }

    /**
     * Mark render pass as clearing the full color buffer.
     *
     * @param {Color|undefined} color - The color to clear to, or undefined to preserve the existing
     * content.
     */
    setClearColor(color) {

        // in case of MRT, we clear all color buffers.
        // TODO: expose per color buffer clear parameters on the camera, and copy them here.
        const count = this.colorArrayOps.length;
        for (let i = 0; i < count; i++) {
            const colorOps = this.colorArrayOps[i];
            if (color)
                colorOps.clearValue.copy(color);
            colorOps.clear = !!color;
        }
    }

    /**
     * Mark render pass as clearing the full depth buffer.
     *
     * @param {number|undefined} depthValue - The depth value to clear to, or undefined to preserve
     * the existing content.
     */
    setClearDepth(depthValue) {
        if (depthValue)
            this.depthStencilOps.clearDepthValue = depthValue;
        this.depthStencilOps.clearDepth = depthValue !== undefined;
    }

    /**
     * Mark render pass as clearing the full stencil buffer.
     *
     * @param {number|undefined} stencilValue - The stencil value to clear to, or undefined to preserve the
     * existing content.
     */
    setClearStencil(stencilValue) {
        if (stencilValue)
            this.depthStencilOps.clearStencilValue = stencilValue;
        this.depthStencilOps.clearStencil = stencilValue !== undefined;
    }

    /**
     * Render the render pass
     */
    render() {

        if (this.enabled) {

            const device = this.device;
            const realPass = this.renderTarget !== undefined;

            Debug.call(() => {
                this.log(device, device.renderPassIndex);
            });

            this.before();

            if (this.executeEnabled) {

                if (realPass) {
                    device.startRenderPass(this);
                }

                this.execute();

                if (realPass) {
                    device.endRenderPass(this);
                }
            }

            this.after();

            device.renderPassIndex++;
        }
    }

    // #if _DEBUG
    log(device, index = 0) {
        if (Tracing.get(TRACEID_RENDER_PASS) || Tracing.get(TRACEID_RENDER_PASS_DETAIL)) {

            const rt = this.renderTarget ?? (this.renderTarget === null ? device.backBuffer : null);
            const isBackBuffer = !!rt?.impl.assignedColorTexture || rt?.impl.suppliedColorFramebuffer !== undefined;
            const numColor = rt?._colorBuffers?.length ?? (isBackBuffer ? 1 : 0);
            const hasDepth = rt?.depth;
            const hasStencil = rt?.stencil;
            const rtInfo = !rt ? '' : ` RT: ${(rt ? rt.name : 'NULL')} ` +
                `${numColor > 0 ? `[Color${numColor > 1 ? ` x ${numColor}` : ''}]` : ''}` +
                `${hasDepth ? '[Depth]' : ''}` +
                `${hasStencil ? '[Stencil]' : ''}` +
                ` ${rt.width} x ${rt.height}` +
                `${(this.samples > 0 ? ' samples: ' + this.samples : '')}`;

            Debug.trace(TRACEID_RENDER_PASS,
                        `${index.toString().padEnd(2, ' ')}: ${this.name.padEnd(20, ' ')}` +
                        `${this.executeEnabled ? '' : ' DISABLED '}` +
                        rtInfo.padEnd(30));

            for (let i = 0; i < numColor; i++) {
                const colorOps = this.colorArrayOps[i];
                Debug.trace(TRACEID_RENDER_PASS_DETAIL, `    color[${i}]: ` +
                            `${colorOps.clear ? 'clear' : 'load'}->` +
                            `${colorOps.store ? 'store' : 'discard'} ` +
                            `${colorOps.resolve ? 'resolve ' : ''}` +
                            `${colorOps.mipmaps ? 'mipmaps ' : ''}`);
            }

            if (this.depthStencilOps) {

                if (hasDepth) {
                    Debug.trace(TRACEID_RENDER_PASS_DETAIL, `    depthOps: ` +
                                `${this.depthStencilOps.clearDepth ? 'clear' : 'load'}->` +
                                `${this.depthStencilOps.storeDepth ? 'store' : 'discard'}`);
                }

                if (hasStencil) {
                    Debug.trace(TRACEID_RENDER_PASS_DETAIL, `    stencOps: ` +
                                `${this.depthStencilOps.clearStencil ? 'clear' : 'load'}->` +
                                `${this.depthStencilOps.storeStencil ? 'store' : 'discard'}`);
                }
            }
        }
    }
    // #endif
}

export { RenderPass, ColorAttachmentOps, DepthStencilAttachmentOps };
