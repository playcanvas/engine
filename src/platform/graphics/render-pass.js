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

class ColorAttachmentOps {
    /**
     * A color used to clear the color attachment when the clear is enabled, specified in sRGB space.
     */
    clearValue = new Color(0, 0, 0, 1);

    /**
     * A color used to clear the color attachment when the clear is enabled, specified in linear
     * space.
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
}

/**
 * A render pass represents a node in the frame graph that renders to a render target using a GPU
 * render pass. It extends {@link FramePass} with render target management, color/depth/stencil
 * attachment operations, and GPU render pass lifecycle (start/end).
 *
 * @ignore
 */
class RenderPass extends FramePass {
    /**
     * The render target for this render pass:
     *
     * - `undefined`: render pass does not render to any render target
     * - `null`: render pass renders to the backbuffer
     * - Otherwise, renders to the provided RT.
     *
     * @type {RenderTarget|null|undefined}
     */
    renderTarget;

    /**
     * The options specified when the render target was initialized.
     */
    _options;

    /**
     * Number of samples. 0 if no render target, otherwise number of samples from the render target,
     * or the main framebuffer if render target is null.
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
     */
    requiresCubemaps = true;

    /**
     * True if the render pass uses the full viewport / scissor for rendering into the render target.
     */
    fullSizeClearRect = true;

    set scaleX(value) {
        Debug.assert(this._options, 'The render pass needs to be initialized first.');
        this._options.scaleX = value;
    }

    get scaleX() {
        return this._options.scaleX;
    }

    set scaleY(value) {
        Debug.assert(this._options, 'The render pass needs to be initialized first.');
        this._options.scaleY = value;
    }

    get scaleY() {
        return this._options.scaleY;
    }

    set options(value) {
        this._options = value;

        // sanitize options
        if (value) {
            this.scaleX = this.scaleX ?? 1;
            this.scaleY = this.scaleY ?? 1;
        }
    }

    get options() {
        return this._options;
    }

    /**
     * @param {RenderTarget|null} [renderTarget] - The render target to render into (output). This
     * function should be called only for render passes which use render target, or passes which
     * render directly into the default framebuffer, in which case a null or undefined render
     * target is expected.
     * @param {object} [options] - Object for passing optional arguments.
     * @param {Texture} [options.resizeSource] - A texture to use as a source for the automatic
     * render target resize operation. If not provided, no automatic resizing takes place.
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

    allocateAttachments() {

        const rt = this.renderTarget;

        // depth
        this.depthStencilOps = new DepthStencilAttachmentOps();

        // if a RT is used (so not a backbuffer) that was created with a user supplied depth buffer,
        // assume the user wants to use its content, and so store it by default
        if (rt?.depthBuffer) {
            this.depthStencilOps.storeDepth = true;

            // a depth resolve buffer is the output of the shader-based depth resolve, which runs
            // after the pass - resolve by default (the multisampled depth is stored either way, as
            // the resolve reads it after the pass has finished)
            if (rt.depthResolveBuffer) {
                this.depthStencilOps.resolveDepth = true;
            }
        }

        // color
        const numColorOps = rt ? (rt._colorBuffers?.length ?? 0) : 1;
        this.colorArrayOps.length = 0;
        for (let i = 0; i < numColorOps; i++) {
            const colorOps = new ColorAttachmentOps();
            this.colorArrayOps[i] = colorOps;

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

    postInit() {
    }

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

        // TODO: expose per color buffer clear parameters on the camera, and copy them here.
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
        if (depthValue !== undefined) {
            this.depthStencilOps.clearDepthValue = depthValue;
        }
        this.depthStencilOps.clearDepth = depthValue !== undefined;
    }

    /**
     * Mark render pass as clearing the full stencil buffer.
     *
     * @param {number|undefined} stencilValue - The stencil value to clear to, or undefined to
     * preserve the existing content.
     */
    setClearStencil(stencilValue) {
        if (stencilValue !== undefined) {
            this.depthStencilOps.clearStencilValue = stencilValue;
        }
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

                if (realPass && !this._skipStart) {
                    device.startRenderPass(this);
                }

                this.execute();

                if (realPass && !this._skipEnd) {
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
