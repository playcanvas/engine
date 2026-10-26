import { Debug } from '../../core/debug.js';
import { Tracing } from '../../core/tracing.js';
import { Color } from '../../core/math/color.js';
import { TRACEID_RENDER_PASS, TRACEID_RENDER_PASS_DETAIL } from '../../core/constants.js';
import { isIntegerPixelFormat, pixelFormatInfo } from './constants.js';
import { FramePass } from './frame-pass.js';

/**
 * @import { RenderTarget } from '../graphics/render-target.js'
 * @import { Texture } from './texture.js'
 */

/**
 * Reports the clear values of integer format color attachments which are not representable in
 * their format. The components of the clear color of an integer format attachment are the raw
 * integer values, and so a non-integer value would be silently truncated by WebGL, and generates a
 * validation error on WebGPU.
 *
 * @param {RenderPass} renderPass - The render pass to validate.
 * @ignore
 */
const validateClearValues = (renderPass) => {
    Debug.call(() => {

        const renderTarget = renderPass.renderTarget;
        const count = renderPass.colorArrayOps.length;
        for (let i = 0; i < count; i++) {

            const colorOps = renderPass.colorArrayOps[i];
            if (!colorOps?.clear) {
                continue;
            }

            const formatInfo = pixelFormatInfo.get(renderTarget?.getColorBuffer(i)?.format);
            if (formatInfo?.isInt !== true && formatInfo?.isUint !== true) {
                continue;
            }

            const { r, g, b, a } = colorOps.clearValue;
            const integers = Number.isInteger(r) && Number.isInteger(g) && Number.isInteger(b) && Number.isInteger(a);
            const unsigned = formatInfo.isUint !== true || (r >= 0 && g >= 0 && b >= 0 && a >= 0);
            if (!integers || !unsigned) {
                Debug.errorOnce(`Render pass '${renderPass.name}' clears the integer format color attachment ${i} (${formatInfo.name}) of render target '${renderTarget?.name}' to [${r}, ${g}, ${b}, ${a}], but the components must be ${formatInfo.isUint ? 'non-negative ' : ''}integers.`, renderPass);
            }
        }
    });
};

/**
 * The operations a {@link RenderPass} performs on one of its color attachments: whether it is
 * cleared before the pass renders, and whether it is stored, resolved and has its mipmaps
 * generated after. {@link RenderPass#init} allocates them with defaults matching the render
 * target.
 *
 * @ignore
 */
class ColorAttachmentOps {
    /**
     * A color used to clear the color attachment when the clear is enabled, specified in sRGB
     * space. Set it with {@link RenderPass#setClearColor}, which also updates the linear value
     * used to clear sRGB attachments.
     */
    clearValue = new Color(0, 0, 0, 1);

    /**
     * A color used to clear the color attachment when the clear is enabled, specified in linear
     * space. Kept in sync with the clearValue by {@link RenderPass#setClearColor}.
     */
    clearValueLinear = new Color(0, 0, 0, 1);

    /**
     * True if the attachment should be cleared before rendering, false to preserve
     * the existing content.
     */
    clear = false;

    /**
     * True if the attachment needs to be stored after the render pass. False if it can be
     * discarded. Note: This relates to the surface that is getting rendered to, and can be either
     * single or multi-sampled. Further, if a multi-sampled surface is used, the resolve flag
     * further specifies if this gets resolved to a single-sampled surface. This behavior matches
     * the WebGPU specification.
     */
    store = false;

    /**
     * True if the attachment needs to be resolved.
     */
    resolve = true;

    /**
     * True if the attachment needs to have mipmaps generated.
     */
    genMipmaps = false;

    /**
     * Resets the operations to their defaults, the values the properties are initialized with.
     */
    reset() {
        this.clearValue.set(0, 0, 0, 1);
        this.clearValueLinear.set(0, 0, 0, 1);
        this.clear = false;
        this.store = false;
        this.resolve = true;
        this.genMipmaps = false;
    }
}

/**
 * The operations a {@link RenderPass} performs on its depth and stencil attachment: whether they
 * are cleared before the pass renders, and whether they are stored and resolved after.
 * {@link RenderPass#init} allocates them with defaults matching the render target.
 *
 * @ignore
 */
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
     */
    storeDepth = false;

    /**
     * True if the depth attachment needs to be resolved.
     */
    resolveDepth = false;

    /**
     * True if the stencil attachment needs to be stored after the render pass. False
     * if it can be discarded.
     */
    storeStencil = false;

    /**
     * Resets the operations to their defaults, the values the properties are initialized with.
     */
    reset() {
        this.clearDepthValue = 1;
        this.clearStencilValue = 0;
        this.clearDepth = false;
        this.clearStencil = false;
        this.storeDepth = false;
        this.resolveDepth = false;
        this.storeStencil = false;
    }
}

/**
 * A render pass is a {@link FramePass} which draws into a render target. Its draw calls are
 * recorded inside a GPU render pass, which starts right before the pass executes and ends right
 * after. It is the base class for passes which draw, for example a pass rendering a quad with a
 * shader, see {@link RenderPassShaderQuad}. For work which does not draw, such as compute
 * dispatches, use {@link FramePass} or {@link ComputePass} instead.
 *
 * ## Setting up the pass
 *
 * Once the pass is created, call {@link RenderPass#init} with the {@link RenderTarget} to draw
 * into, or with null to draw into the back buffer. The pass does not own its render target, and
 * does not destroy it. When init is given options, the pass also resizes its render target each
 * frame, to the size of a texture, a render target or the back buffer, scaled by
 * {@link RenderPass#scaleX} and {@link RenderPass#scaleY}.
 *
 * ## Loading and clearing the attachments
 *
 * The attachments of the render target are its color buffers, and its depth and stencil buffers.
 * By default, the GPU render pass loads their content, and the pass draws over it. To start from a
 * single value instead, clear them with {@link RenderPass#setClearColor},
 * {@link RenderPass#setClearDepth} and {@link RenderPass#setClearStencil}. When the pass covers an
 * attachment completely, clearing it is also faster than loading it on tiled mobile GPUs, which
 * then do not read the previous content from memory.
 *
 * ## Storing the attachments
 *
 * When the GPU render pass ends, the pass keeps what it rendered into the textures of its render
 * target, so they can be sampled, or loaded by a later pass: its color buffers, resolved when the
 * render target is multisampled, and its depth buffer texture. Other attachments are discarded:
 * the samples of a multisampled color buffer which is resolved, the stencil, and a depth buffer
 * the render target creates internally. When a later pass of the same frame draws into the same
 * render target and loads them, the frame graph stores them automatically. Otherwise, store them
 * with {@link RenderPass#setStoreColor},
 * {@link RenderPass#setStoreDepth} and {@link RenderPass#setStoreStencil}. The mipmaps of color
 * buffers with mipmaps are generated at this point too, which
 * {@link RenderPass#setGenerateMipmaps} can turn off, for example when another pass draws into
 * the same render target after this one.
 *
 * ## Writing a pass
 *
 * A subclass records its draw calls in {@link FramePass#execute}, which is called while the GPU
 * render pass is active. It can also override {@link RenderPass#postInit} to set up its clears
 * once the pass is initialized, and {@link RenderPass#frameUpdate} to update the pass before each
 * frame renders, calling `super.frameUpdate()` to keep the resize. It releases what it created in
 * {@link FramePass#destroy}, calling `super.destroy()`.
 *
 * ## Rendering the pass
 *
 * A pass renders in one of two ways:
 *
 * - As part of a frame, for example as a frame pass of a camera, or as a before or after pass of
 * another pass. The frame graph then calls its {@link RenderPass#frameUpdate}, and merges
 * consecutive passes drawing into the same render target into a single GPU render pass, unless
 * something separates them, for example a clear of the later pass.
 * - On its own, by calling {@link RenderPass#render}, for example to render into a texture each
 * time its content needs to change. See {@link FramePass#render} for the steps a frame performs,
 * which are skipped then.
 *
 * @example
 * // A pass drawing a quad with a shader, covering its whole render target
 * class MyPass extends RenderPass {
 *     constructor(device, shader) {
 *         super(device);
 *         this.quadRender = new QuadRender(shader);
 *     }
 *
 *     execute() {
 *         // the default draw states suit a quad: no blending, and no depth test or write
 *         this.device.setDrawStates();
 *         this.quadRender.render();
 *     }
 *
 *     destroy() {
 *         this.quadRender.destroy();
 *         super.destroy();
 *     }
 * }
 *
 * const renderTarget = new RenderTarget({ colorBuffer: texture, depth: false });
 * const pass = new MyPass(device, shader);
 * pass.name = 'MyPass';
 * pass.init(renderTarget);
 *
 * // the quad covers the whole target, so clear it instead of loading its content
 * pass.setClearColor(Color.BLACK);
 *
 * // draw into the texture
 * pass.render();
 *
 * // destroy the pass, and then the render target, which the pass does not own
 * pass.destroy();
 * renderTarget.destroy();
 *
 * @category Graphics
 */
class RenderPass extends FramePass {
    /**
     * The render target the pass draws into, or null when it draws into the back buffer. It is set
     * by {@link RenderPass#init}, which sets up the pass for the attachments of the render target,
     * and which is called again to switch the pass to a render target with different attachments.
     * Assigning a render target directly is only supported for a render target with the same
     * layout: the same color buffers and their formats, the same depth and stencil buffers, and the
     * same number of samples. For example, a pass can alternate between two such render targets
     * each frame. For work which does not draw into a render target, use {@link FramePass}
     * instead. It is undefined until the pass is initialized. The render pass does not own the
     * render target, and does not destroy it.
     *
     * @type {RenderTarget|null|undefined}
     */
    renderTarget;

    /**
     * The options specified when the render target was initialized.
     *
     * @type {object|undefined}
     * @private
     */
    _options;

    /**
     * Number of samples. 0 if no render target, otherwise number of samples from the render target,
     * or the main framebuffer if render target is null.
     *
     * @ignore
     */
    samples = 0;

    /**
     * Array of color attachment operations. The first element corresponds to the color attachment
     * 0, and so on.
     *
     * @type {Array<ColorAttachmentOps>}
     * @ignore
     */
    colorArrayOps = [];

    /**
     * Color attachment operations for the first color attachment.
     *
     * @type {ColorAttachmentOps}
     * @ignore
     */
    get colorOps() {
        return this.colorArrayOps[0];
    }

    /**
     * Depth and stencil attachment operations.
     *
     * @type {DepthStencilAttachmentOps}
     * @ignore
     */
    depthStencilOps;

    /**
     * True if the render pass uses the full viewport / scissor for rendering into the render target.
     *
     * @ignore
     */
    fullSizeClearRect = true;

    /**
     * Sets the scale factor of the width of the render target, relative to the size of the resize
     * source, see {@link RenderPass#init}. Only valid for a pass initialized with options.
     *
     * @type {number}
     */
    set scaleX(value) {
        Debug.assert(this._options, 'The render pass needs to be initialized first.');
        this._options.scaleX = value;
    }

    /**
     * Gets the scale factor of the width of the render target.
     *
     * @type {number}
     */
    get scaleX() {
        return this._options.scaleX;
    }

    /**
     * Sets the scale factor of the height of the render target, relative to the size of the resize
     * source, see {@link RenderPass#init}. Only valid for a pass initialized with options.
     *
     * @type {number}
     */
    set scaleY(value) {
        Debug.assert(this._options, 'The render pass needs to be initialized first.');
        this._options.scaleY = value;
    }

    /**
     * Gets the scale factor of the height of the render target.
     *
     * @type {number}
     */
    get scaleY() {
        return this._options.scaleY;
    }

    /**
     * Sets the options the pass was initialized with.
     *
     * @type {object|undefined}
     * @ignore
     */
    set options(value) {
        this._options = value;

        // sanitize options
        if (value) {
            this.scaleX = this.scaleX ?? 1;
            this.scaleY = this.scaleY ?? 1;
        }
    }

    /**
     * Gets the options the pass was initialized with.
     *
     * @type {object|undefined}
     * @ignore
     */
    get options() {
        return this._options;
    }

    /**
     * Initializes the pass to draw into a render target, or into the back buffer. A render pass
     * needs to be initialized before it renders, and before its clears, stores and mipmaps are set
     * with {@link RenderPass#setClearColor}, {@link RenderPass#setStoreColor},
     * {@link RenderPass#setGenerateMipmaps} and the related setters. It sets up the operations of
     * the attachments of the render target with their defaults, so the attachments are not
     * cleared until a clear is set.
     *
     * Call it again to switch the pass to a render target with different attachments, which resets
     * its clears, stores and mipmaps to the defaults. A render target with the same layout can
     * also be assigned to {@link RenderPass#renderTarget} directly.
     *
     * When options are provided, the render target is resized each frame, in
     * {@link RenderPass#frameUpdate}, to the size of the resize source scaled by
     * {@link RenderPass#scaleX} and {@link RenderPass#scaleY}. Without options, it is not resized.
     *
     * @param {RenderTarget|null} [renderTarget] - The render target to draw into, or null to draw
     * into the back buffer. Defaults to null. The render pass does not own the render target.
     * @param {object} [options] - Object for passing optional arguments.
     * @param {Texture|RenderTarget} [options.resizeSource] - The texture or render target whose
     * size the render target is resized to. Defaults to the back buffer.
     * @param {number} [options.scaleX] - The scale factor for the render target width. Defaults to 1.
     * @param {number} [options.scaleY] - The scale factor for the render target height. Defaults to 1.
     */
    init(renderTarget = null, options) {

        this.options = options;

        // null represents the default framebuffer
        this.renderTarget = renderTarget;

        // defaults depend on multisampling
        this.samples = Math.max(this.renderTarget ? this.renderTarget.samples : this.device.samples, 1);

        // allocate ops only when render target is used (when this function was called)
        this.allocateAttachments();

        // allow for post-init setup
        this.postInit();
    }

    /**
     * Allocates the operations of the attachments of the render target, with their defaults. The
     * operations allocated by a previous initialization are reset and reused, as a pass can be
     * initialized every frame, for example to render to a different render target.
     *
     * @ignore
     */
    allocateAttachments() {

        const rt = this.renderTarget;

        // depth
        const depthStencilOps = this.depthStencilOps ?? new DepthStencilAttachmentOps();
        depthStencilOps.reset();
        this.depthStencilOps = depthStencilOps;

        // if an RT is used (so not a backbuffer) that was created with a user supplied depth buffer,
        // assume the user wants to use its content, and so store it by default
        if (rt?.depthBuffer) {
            depthStencilOps.storeDepth = true;

            // a depth resolve buffer is the output of the shader-based depth resolve, which runs
            // after the pass - resolve by default (the multisampled depth is stored either way, as
            // the resolve reads it after the pass has finished)
            if (rt.depthResolveBuffer) {
                depthStencilOps.resolveDepth = true;
            }
        }

        // color
        const numColorOps = rt ? (rt._colorBuffers?.length ?? 0) : 1;
        const colorArrayOps = this.colorArrayOps;
        colorArrayOps.length = numColorOps;
        for (let i = 0; i < numColorOps; i++) {
            const colorOps = colorArrayOps[i] ?? new ColorAttachmentOps();
            colorOps.reset();
            colorArrayOps[i] = colorOps;

            const colorBuffer = rt?._colorBuffers?.[i];

            // if rendering to single-sampled buffer, this buffer needs to be stored
            if (this.samples === 1) {
                colorOps.store = true;
                colorOps.resolve = false;
            } else if (colorBuffer?.samples > 1) {
                // explicit multisampled attachment: with a resolve buffer, the hardware resolve is
                // the pass output and the samples are discarded (matching the implicit multisampled
                // path); without one, the samples are the output and must be stored to be read in a
                // shader using textureLoad
                const resolve = !!rt.getResolveBuffer(i);
                colorOps.resolve = resolve;
                colorOps.store = !resolve;
            }

            // if render target needs mipmaps
            if (rt?.mipmaps && colorBuffer?.mipmaps) {
                const intFormat = isIntegerPixelFormat(colorBuffer._format);
                colorOps.genMipmaps = !intFormat;  // no automatic mipmap generation for integer formats
            }
        }
    }

    /**
     * Called at the end of {@link RenderPass#init}, once the pass is set up for its render
     * target. Override to finish the setup, for example to set the clears the pass uses.
     */
    postInit() {
    }

    /**
     * Resizes the render target to the size of the resize source, scaled by
     * {@link RenderPass#scaleX} and {@link RenderPass#scaleY}, when the pass was initialized with
     * options. See {@link FramePass#frameUpdate}. Subclasses overriding it call
     * `super.frameUpdate()` to keep the resize.
     */
    frameUpdate() {
        // resize the render target if needed
        if (this._options && this.renderTarget) {
            const resizeSource = this._options.resizeSource ?? this.device.backBuffer;
            const width = Math.floor(resizeSource.width * this.scaleX);
            const height = Math.floor(resizeSource.height * this.scaleY);
            this.renderTarget.resize(width, height);
        }
    }

    /**
     * Mark render pass as clearing the full color buffer.
     *
     * @param {Color|undefined} color - The color to clear to, or undefined to preserve the existing
     * content.
     * @param {number} [index] - The index of the color attachment to modify. When not specified,
     * all color attachments are modified.
     */
    setClearColor(color, index) {

        Debug.assert(this.renderTarget !== undefined, `RenderPass#setClearColor is called on the render pass '${this.name}' before it is initialized with init.`, this);
        const count = this.colorArrayOps.length;
        Debug.assert(index === undefined || (index >= 0 && index < count),
            `setClearColor index ${index} is out of range, the render pass has ${count} color attachments.`);

        const start = index ?? 0;
        const end = index === undefined ? count : index + 1;
        for (let i = start; i < end; i++) {
            const colorOps = this.colorArrayOps[i];
            if (colorOps) {
                if (color) {
                    colorOps.clearValue.copy(color);
                    colorOps.clearValueLinear.linear(color);
                }
                colorOps.clear = !!color;
            }
        }
    }

    /**
     * Mark render pass as clearing the full depth buffer.
     *
     * @param {number|undefined} depthValue - The depth value to clear to, or undefined to preserve
     * the existing content.
     */
    setClearDepth(depthValue) {
        Debug.assert(this.renderTarget !== undefined, `RenderPass#setClearDepth is called on the render pass '${this.name}' before it is initialized with init.`, this);
        const ops = this.depthStencilOps;
        if (ops) {
            if (depthValue !== undefined) {
                ops.clearDepthValue = depthValue;
            }
            ops.clearDepth = depthValue !== undefined;
        }
    }

    /**
     * Mark render pass as clearing the full stencil buffer.
     *
     * @param {number|undefined} stencilValue - The stencil value to clear to, or undefined to
     * preserve the existing content.
     */
    setClearStencil(stencilValue) {
        Debug.assert(this.renderTarget !== undefined, `RenderPass#setClearStencil is called on the render pass '${this.name}' before it is initialized with init.`, this);
        const ops = this.depthStencilOps;
        if (ops) {
            if (stencilValue !== undefined) {
                ops.clearStencilValue = stencilValue;
            }
            ops.clearStencil = stencilValue !== undefined;
        }
    }

    /**
     * Sets whether the pass stores its color attachments once it renders, so that a later pass
     * can load them. By default, single-sampled color buffers are stored, while the samples of a
     * multisampled color buffer are stored only when it has no resolve buffer, as the resolved
     * color is the output of the pass. Within a frame, the frame graph also stores the attachments
     * a later pass on the same render target loads, so this is needed for passes rendered on
     * their own, see {@link FramePass#render}. Not storing a single-sampled color buffer discards
     * what the pass renders into it. Set it once the pass is initialized, as
     * {@link RenderPass#init} resets it.
     *
     * @param {boolean} store - True to store the attachments, false to discard them.
     * @param {number} [index] - The index of the color attachment to modify. When not specified,
     * all color attachments are modified.
     */
    setStoreColor(store, index) {

        Debug.assert(this.renderTarget !== undefined, `RenderPass#setStoreColor is called on the render pass '${this.name}' before it is initialized with init.`, this);
        const count = this.colorArrayOps.length;
        Debug.assert(index === undefined || (index >= 0 && index < count),
            `setStoreColor index ${index} is out of range, the render pass has ${count} color attachments.`);

        const start = index ?? 0;
        const end = index === undefined ? count : index + 1;
        for (let i = start; i < end; i++) {
            const colorOps = this.colorArrayOps[i];
            if (colorOps) {
                colorOps.store = store;
            }
        }
    }

    /**
     * Sets whether the pass stores its depth attachment once it renders, so that a later pass can
     * load it. By default, the depth buffer texture of the render target is stored, while a depth
     * buffer the render target creates internally is discarded. Within a frame, the frame graph
     * also stores the depth a later pass on the same render target loads, so this is needed for
     * passes rendered on their own, see {@link FramePass#render}. Set it once the pass is
     * initialized, as {@link RenderPass#init} resets it.
     *
     * @param {boolean} store - True to store the depth, false to discard it.
     */
    setStoreDepth(store) {
        Debug.assert(this.renderTarget !== undefined, `RenderPass#setStoreDepth is called on the render pass '${this.name}' before it is initialized with init.`, this);
        if (this.depthStencilOps) {
            this.depthStencilOps.storeDepth = store;
        }
    }

    /**
     * Sets whether the pass stores its stencil attachment once it renders, so that a later pass
     * can load it. By default, the stencil is discarded. Within a frame, the frame graph also
     * stores the stencil a later pass on the same render target loads, so this is needed for
     * passes rendered on their own, see {@link FramePass#render}. Set it once the pass is
     * initialized, as {@link RenderPass#init} resets it.
     *
     * @param {boolean} store - True to store the stencil, false to discard it.
     */
    setStoreStencil(store) {
        Debug.assert(this.renderTarget !== undefined, `RenderPass#setStoreStencil is called on the render pass '${this.name}' before it is initialized with init.`, this);
        if (this.depthStencilOps) {
            this.depthStencilOps.storeStencil = store;
        }
    }

    /**
     * Sets whether the pass generates the mipmaps of its color attachments once it renders. By
     * default, they are generated for color buffers with mipmaps, unless the render target renders
     * into a single mip level, see {@link RenderTarget#mipLevel}, or the buffer uses an integer
     * format. When several passes render to the same render target, the mipmaps are only needed
     * after the last of them, so disabling them for the others avoids generating them more than
     * once. Set it once the pass is initialized, as {@link RenderPass#init} resets it.
     *
     * @param {boolean} generate - True to generate the mipmaps of the color buffers which support
     * them, false to not generate them.
     * @param {number} [index] - The index of the color attachment to modify. When not specified,
     * all color attachments are modified.
     */
    setGenerateMipmaps(generate, index) {

        Debug.assert(this.renderTarget !== undefined, `RenderPass#setGenerateMipmaps is called on the render pass '${this.name}' before it is initialized with init.`, this);
        const count = this.colorArrayOps.length;
        Debug.assert(index === undefined || (index >= 0 && index < count),
            `setGenerateMipmaps index ${index} is out of range, the render pass has ${count} color attachments.`);

        const rt = this.renderTarget;
        const start = index ?? 0;
        const end = index === undefined ? count : index + 1;
        for (let i = start; i < end; i++) {
            const colorOps = this.colorArrayOps[i];
            if (colorOps) {
                const colorBuffer = rt?.getColorBuffer(i);
                const supported = !!(rt?.mipmaps && colorBuffer?.mipmaps && !isIntegerPixelFormat(colorBuffer.format));
                Debug.assert(!generate || supported || index === undefined,
                    `Render pass '${this.name}' cannot generate the mipmaps of the color attachment ${i} of render target '${rt?.name}', as it has no mipmaps or uses an integer format.`, this);
                colorOps.genMipmaps = generate && supported;
            }
        }
    }

    /**
     * Renders the pass, as {@link FramePass#render} describes, starting its GPU render pass right
     * before {@link FramePass#execute} and ending it right after. A pass the frame graph merged
     * with a neighbouring pass on the same render target shares a single GPU render pass with it.
     * The pass needs to be initialized with {@link RenderPass#init} before it renders.
     */
    render() {

        if (this.enabled) {

            const device = this.device;

            // a pass which was not initialized executes without a GPU render pass
            const realPass = this.renderTarget !== undefined;
            Debug.assert(realPass, `The render pass '${this.name}' renders before it is initialized. Call its init with the render target to draw into, or with null for the back buffer. For work which does not draw into a render target, use a FramePass instead.`, this);

            Debug.call(() => {
                this.log(device, device.renderPassIndex);
            });

            this.before();
            this.onBefore?.(this);

            // the frame graph merged this pass with a neighbouring one, sharing its GPU render pass,
            // only if both execute
            Debug.assert(this.executeEnabled || !(this._skipStart || this._skipEnd), `The render pass '${this.name}' was merged with a neighbouring pass, but its executeEnabled was set to false after the frame graph was compiled, for example in its before() or onBefore. Set it before the frame renders, at the latest in its frameUpdate.`, this);

            if (this.executeEnabled) {

                if (realPass && !this._skipStart) {
                    device.startRenderPass(this);
                }

                this.execute();

                if (realPass && !this._skipEnd) {
                    device.endRenderPass(this);
                }
            }

            this.after();
            this.onAfter?.(this);

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
            const mipLevel = rt?.mipLevel;
            const rtInfo = !rt ? '' : ` RT: ${(rt ? rt.name : 'NULL')} ` +
                `${numColor > 0 ? `[Color${numColor > 1 ? ` x ${numColor}` : ''}]` : ''}` +
                `${hasDepth ? '[Depth]' : ''}` +
                `${hasStencil ? '[Stencil]' : ''}` +
                ` ${rt.width} x ${rt.height}` +
                `${(this.samples > 0 ? ` samples: ${this.samples}` : '')}` +
                `${mipLevel > 0 ? ` mipLevel: ${mipLevel}` : ''}`;

            const indexString = this._skipStart ? '++' : index.toString().padEnd(2, ' ');
            Debug.trace(TRACEID_RENDER_PASS,
                `${indexString}: ${this.name.padEnd(20, ' ')}` +
                        `${this.executeEnabled ? '' : ' DISABLED '}${
                            rtInfo.padEnd(30)}`);

            for (let i = 0; i < numColor; i++) {
                const colorOps = this.colorArrayOps[i];
                const colorFormat = pixelFormatInfo.get(isBackBuffer ? device.backBufferFormat : rt.getColorBuffer(i).format)?.name;
                Debug.trace(TRACEID_RENDER_PASS_DETAIL, `    color[${i}]: ` +
                            `${colorOps.clear ? 'clear' : 'load'}->` +
                            `${colorOps.store ? 'store' : 'discard'} ` +
                            `${colorOps.resolve ? 'resolve ' : ''}` +
                            `${colorOps.genMipmaps ? 'mipmaps ' : ''}` +
                            ` [format: ${colorFormat}]` +
                            ` ${colorOps.clear ? `[clear: ${colorOps.clearValue.toString(true, true)}]` : ''}`
                );
            }

            if (this.depthStencilOps) {

                const depthFormat = `${rt.depthBuffer ? ` [format: ${pixelFormatInfo.get(rt.depthBuffer.format)?.name}]` : ''}`;

                if (hasDepth) {
                    Debug.trace(TRACEID_RENDER_PASS_DETAIL, '    depthOps: ' +
                                `${this.depthStencilOps.clearDepth ? 'clear' : 'load'}->` +
                                `${this.depthStencilOps.storeDepth ? 'store' : 'discard'}` +
                                `${this.depthStencilOps.resolveDepth ? ' resolve' : ''}` +
                                `${depthFormat}` +
                                `${this.depthStencilOps.clearDepth ? ` [clear: ${this.depthStencilOps.clearDepthValue}]` : ''}`
                    );
                }

                if (hasStencil) {
                    Debug.trace(TRACEID_RENDER_PASS_DETAIL, '    stencOps: ' +
                                `${this.depthStencilOps.clearStencil ? 'clear' : 'load'}->` +
                                `${this.depthStencilOps.storeStencil ? 'store' : 'discard'}` +
                                `${depthFormat}` +
                                `${this.depthStencilOps.clearStencil ? ` [clear: ${this.depthStencilOps.clearStencilValue}]` : ''}`
                    );
                }
            }
        }
    }
    // #endif
}

export { RenderPass, validateClearValues };
