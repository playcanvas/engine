import { PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTHSTENCIL } from './constants.js';

import { GraphicsDevice } from './graphics-device.js';

const defaultOptions = {
    depth: true,
    face: 0
};

/**
 * @class
 * @name RenderTarget
 * @classdesc A render target is a rectangular rendering surface.
 * @description Creates a new render target. A color buffer or a depth buffer must be set.
 * @param {object} options - Object for passing optional arguments.
 * @param {Texture} [options.colorBuffer] - The texture that this render target will treat as a rendering surface.
 * @param {boolean} [options.depth] - If set to true, depth buffer will be created. Defaults to true. Ignored if depthBuffer is defined.
 * @param {boolean} [options.stencil] - If set to true, depth buffer will include stencil. Defaults to false. Ignored if depthBuffer is defined or depth is false.
 * @param {Texture} [options.depthBuffer] - The texture that this render target will treat as a depth/stencil surface (WebGL2 only). If set, the 'depth' and 'stencil' properties are ignored.
 * Texture must have {@link PIXELFORMAT_DEPTH} or PIXELFORMAT_DEPTHSTENCIL format.
 * @param {number} [options.samples] - Number of hardware anti-aliasing samples (WebGL2 only). Default is 1.
 * @param {boolean} [options.autoResolve] - If samples > 1, enables or disables automatic MSAA resolve after rendering to this RT (see {@link RenderTarget#resolve}). Defaults to true;
 * Defaults to true.
 * @param {number} [options.face] - If the colorBuffer parameter is a cubemap, use this option to specify the
 * face of the cubemap to render to. Can be:
 * @param {string} [options.name] - The name of the render target.
 *
 * * {@link CUBEFACE_POSX}
 * * {@link CUBEFACE_NEGX}
 * * {@link CUBEFACE_POSY}
 * * {@link CUBEFACE_NEGY}
 * * {@link CUBEFACE_POSZ}
 * * {@link CUBEFACE_NEGZ}
 *
 * Defaults to {@link CUBEFACE_POSX}.
 * @example
 * // Create a 512x512x24-bit render target with a depth buffer
 * var colorBuffer = new pc.Texture(graphicsDevice, {
 *     width: 512,
 *     height: 512,
 *     format: pc.PIXELFORMAT_R8_G8_B8
 * });
 * var renderTarget = new pc.RenderTarget({
 *     colorBuffer: colorBuffer,
 *     depth: true
 * });
 *
 * // Set the render target on a camera component
 * camera.renderTarget = renderTarget;
 *
 * // Destroy render target at a later stage. Note that the color buffer needs
 * // to be destroyed separately.
 * renderTarget.colorBuffer.destroy();
 * renderTarget.destroy();
 * camera.renderTarget = null;
 */
class RenderTarget {
    constructor(options) {
        const _arg2 = arguments[1];
        const _arg3 = arguments[2];

        if (options instanceof GraphicsDevice) {
            // old constructor
            this._colorBuffer = _arg2;
            options = _arg3;

            // #if _DEBUG
            console.warn('DEPRECATED: pc.RenderTarget constructor no longer accepts GraphicsDevice parameter.');
            // #endif

        } else {
            // new constructor
            this._colorBuffer = options.colorBuffer;
        }

        // mark color buffer texture as render target
        if (this._colorBuffer) {
            this._colorBuffer._isRenderTarget = true;
        }

        // device, gets assigned when the framebuffer is created during the rendering
        this._device = null;

        this._glFrameBuffer = null;
        this._glDepthBuffer = null;

        // Process optional arguments
        options = (options !== undefined) ? options : defaultOptions;
        this._depthBuffer = options.depthBuffer;
        this._face = (options.face !== undefined) ? options.face : 0;

        if (this._depthBuffer) {
            const format = this._depthBuffer._format;
            if (format === PIXELFORMAT_DEPTH) {
                this._depth = true;
                this._stencil = false;
            } else if (format === PIXELFORMAT_DEPTHSTENCIL) {
                this._depth = true;
                this._stencil = true;
            } else {
                // #if _DEBUG
                console.warn('Incorrect depthBuffer format. Must be pc.PIXELFORMAT_DEPTH or pc.PIXELFORMAT_DEPTHSTENCIL');
                // #endif
                this._depth = false;
                this._stencil = false;
            }
        } else {
            this._depth = (options.depth !== undefined) ? options.depth : true;
            this._stencil = (options.stencil !== undefined) ? options.stencil : false;
        }

        this._samples = (options.samples !== undefined) ? options.samples : 1;
        this.autoResolve = (options.autoResolve !== undefined) ? options.autoResolve : true;
        this._glResolveFrameBuffer = null;
        this._glMsaaColorBuffer = null;
        this._glMsaaDepthBuffer = null;

        // use specified name, othewise get one from color or depth buffer
        this.name = options.name;
        if (!this.name) {
            this.name = this._colorBuffer?.name;
        }
        if (!this.name) {
            this.name = this._depthBuffer?.name;
        }
        if (!this.name) {
            this.name = "Untitled";
        }
    }

    /**
     * @function
     * @name RenderTarget#destroy
     * @description Frees resources associated with this render target.
     */
    destroy() {

        const device = this._device;
        if (device) {
            const idx = device.targets.indexOf(this);
            if (idx !== -1) {
                device.targets.splice(idx, 1);
            }

            this.destroyFrameBuffers();
        }
    }

    destroyFrameBuffers() {

        const device = this._device;
        if (device) {
            const gl = device.gl;
            if (this._glFrameBuffer) {
                gl.deleteFramebuffer(this._glFrameBuffer);
                this._glFrameBuffer = null;
            }

            if (this._glDepthBuffer) {
                gl.deleteRenderbuffer(this._glDepthBuffer);
                this._glDepthBuffer = null;
            }

            if (this._glResolveFrameBuffer) {
                gl.deleteFramebuffer(this._glResolveFrameBuffer);
                this._glResolveFrameBuffer = null;
            }

            if (this._glMsaaColorBuffer) {
                gl.deleteRenderbuffer(this._glMsaaColorBuffer);
                this._glMsaaColorBuffer = null;
            }

            if (this._glMsaaDepthBuffer) {
                gl.deleteRenderbuffer(this._glMsaaDepthBuffer);
                this._glMsaaDepthBuffer = null;
            }
        }
    }

    destroyTextureBuffers() {

        if (this._depthBuffer) {
            this._depthBuffer.destroy();
            this._depthBuffer = null;
        }

        if (this._colorBuffer) {
            this._colorBuffer.destroy();
            this._colorBuffer = null;
        }
    }

    // called when context was lost, function releases all context related resources
    loseContext() {
        this._glFrameBuffer = undefined;
        this._glDepthBuffer = undefined;
        this._glResolveFrameBuffer = undefined;
        this._glMsaaColorBuffer = undefined;
        this._glMsaaDepthBuffer = undefined;
    }

    /**
     * @function
     * @name RenderTarget#resolve
     * @description If samples > 1, resolves the anti-aliased render target (WebGL2 only).
     * When you're rendering to an anti-aliased render target, pixels aren't written directly to the readable texture.
     * Instead, they're first written to a MSAA buffer, where each sample for each pixel is stored independently.
     * In order to read the results, you first need to 'resolve' the buffer - to average all samples and create a simple texture with one color per pixel.
     * This function performs this averaging and updates the colorBuffer and the depthBuffer.
     * If autoResolve is set to true, the resolve will happen after every rendering to this render target, otherwise you can do it manually,
     * during the app update or inside a {@link Command}.
     * @param {boolean} [color] - Resolve color buffer. Defaults to true.
     * @param {boolean} [depth] - Resolve depth buffer. Defaults to true if the render target has a depth buffer.
     */
    resolve(color = true, depth = !!this._depthBuffer) {
        if (!this._device) return;
        if (!this._device.webgl2) return;

        const gl = this._device.gl;
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this._glFrameBuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._glResolveFrameBuffer);
        gl.blitFramebuffer(0, 0, this.width, this.height,
                           0, 0, this.width, this.height,
                           (color ? gl.COLOR_BUFFER_BIT : 0) | (depth ? gl.DEPTH_BUFFER_BIT : 0),
                           gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._glFrameBuffer);
    }

    /**
     * @function
     * @name RenderTarget#copy
     * @description Copies color and/or depth contents of source render target to this one. Formats, sizes and anti-aliasing samples must match.
     * Depth buffer can only be copied on WebGL 2.0.
     * @param {RenderTarget} source - Source render target to copy from.
     * @param {boolean} [color] - If true will copy the color buffer. Defaults to false.
     * @param {boolean} [depth] - If true will copy the depth buffer. Defaults to false.
     * @returns {boolean} True if the copy was successful, false otherwise.
     */
    copy(source, color, depth) {
        if (!this._device) {
            if (source._device) {
                this._device = source._device;
            } else {
                // #if _DEBUG
                console.error("Render targets are not initialized");
                // #endif
                return false;
            }
        }
        return this._device.copyRenderTarget(source, this, color, depth);
    }

    /**
     * @readonly
     * @name RenderTarget#colorBuffer
     * @type {Texture}
     * @description Color buffer set up on the render target.
     */
    get colorBuffer() {
        return this._colorBuffer;
    }

    /**
     * @readonly
     * @name RenderTarget#depthBuffer
     * @type {Texture}
     * @description Depth buffer set up on the render target. Only available, if depthBuffer was set in constructor.
     * Not available, if depth property was used instead.
     */
    get depthBuffer() {
        return this._depthBuffer;
    }

    /**
     * @readonly
     * @name RenderTarget#face
     * @type {number}
     * @description If the render target is bound to a cubemap, this property
     * specifies which face of the cubemap is rendered to. Can be:
     *
     * * {@link CUBEFACE_POSX}
     * * {@link CUBEFACE_NEGX}
     * * {@link CUBEFACE_POSY}
     * * {@link CUBEFACE_NEGY}
     * * {@link CUBEFACE_POSZ}
     * * {@link CUBEFACE_NEGZ}
     */
    get face() {
        return this._face;
    }

    /**
     * @readonly
     * @name RenderTarget#width
     * @type {number}
     * @description Width of the render target in pixels.
     */
    get width() {
        return this._colorBuffer ? this._colorBuffer.width : this._depthBuffer.width;
    }

    /**
     * @readonly
     * @name RenderTarget#height
     * @type {number}
     * @description Height of the render target in pixels.
     */
    get height() {
        return this._colorBuffer ? this._colorBuffer.height : this._depthBuffer.height;
    }
}

export { RenderTarget };
