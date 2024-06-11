import { Debug } from '../../core/debug.js';
import { TRACEID_RENDER_TARGET_ALLOC } from '../../core/constants.js';
import { PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTHSTENCIL } from './constants.js';
import { DebugGraphics } from './debug-graphics.js';
import { GraphicsDevice } from './graphics-device.js';

let id = 0;

/**
 * A render target is a rectangular rendering surface.
 *
 * @category Graphics
 */
class RenderTarget {
    /**
     * The name of the render target.
     *
     * @type {string}
     */
    name;

    /**
     * @type {import('./graphics-device.js').GraphicsDevice}
     * @private
     */
    _device;

    /**
     * @type {import('./texture.js').Texture}
     * @private
     */
    _colorBuffer;

    /**
     * @type {import('./texture.js').Texture[]}
     * @private
     */
    _colorBuffers;

    /**
     * @type {import('./texture.js').Texture}
     * @private
     */
    _depthBuffer;

    /**
     * @type {boolean}
     * @private
     */
    _depth;

    /**
     * @type {boolean}
     * @private
     */
    _stencil;

    /**
     * @type {number}
     * @private
     */
    _samples;

    /** @type {boolean} */
    autoResolve;

    /**
     * @type {number}
     * @private
     */
    _face;

    /** @type {boolean} */
    flipY;

    /**
     * Creates a new RenderTarget instance. A color buffer or a depth buffer must be set.
     *
     * @param {object} [options] - Object for passing optional arguments.
     * @param {boolean} [options.autoResolve] - If samples > 1, enables or disables automatic MSAA
     * resolve after rendering to this RT (see {@link RenderTarget#resolve}). Defaults to true.
     * @param {import('./texture.js').Texture} [options.colorBuffer] - The texture that this render
     * target will treat as a rendering surface.
     * @param {import('./texture.js').Texture[]} [options.colorBuffers] - The textures that this
     * render target will treat as a rendering surfaces. If this option is set, the colorBuffer
     * option is ignored.
     * @param {boolean} [options.depth] - If set to true, depth buffer will be created. Defaults to
     * true. Ignored if depthBuffer is defined.
     * @param {import('./texture.js').Texture} [options.depthBuffer] - The texture that this render
     * target will treat as a depth/stencil surface (WebGL2 only). If set, the 'depth' and
     * 'stencil' properties are ignored. Texture must have {@link PIXELFORMAT_DEPTH} or
     * {@link PIXELFORMAT_DEPTHSTENCIL} format.
     * @param {number} [options.face] - If the colorBuffer parameter is a cubemap, use this option
     * to specify the face of the cubemap to render to. Can be:
     *
     * - {@link CUBEFACE_POSX}
     * - {@link CUBEFACE_NEGX}
     * - {@link CUBEFACE_POSY}
     * - {@link CUBEFACE_NEGY}
     * - {@link CUBEFACE_POSZ}
     * - {@link CUBEFACE_NEGZ}
     *
     * Defaults to {@link CUBEFACE_POSX}.
     * @param {boolean} [options.flipY] - When set to true the image will be flipped in Y. Default
     * is false.
     * @param {string} [options.name] - The name of the render target.
     * @param {number} [options.samples] - Number of hardware anti-aliasing samples. Default is 1.
     * @param {boolean} [options.stencil] - If set to true, depth buffer will include stencil.
     * Defaults to false. Ignored if depthBuffer is defined or depth is false.
     * @example
     * // Create a 512x512x24-bit render target with a depth buffer
     * const colorBuffer = new pc.Texture(graphicsDevice, {
     *     width: 512,
     *     height: 512,
     *     format: pc.PIXELFORMAT_RGB8
     * });
     * const renderTarget = new pc.RenderTarget({
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
    constructor(options = {}) {
        Debug.assert(!(options instanceof GraphicsDevice), 'pc.RenderTarget constructor no longer accepts GraphicsDevice parameter.');
        this.id = id++;

        // Use the single colorBuffer in the colorBuffers array. This allows us to always just use the array internally.
        this._colorBuffer = options.colorBuffer;
        if (options.colorBuffer) {
            this._colorBuffers = [options.colorBuffer];
        }

        // Process optional arguments
        this._depthBuffer = options.depthBuffer;
        this._face = options.face ?? 0;

        if (this._depthBuffer) {
            const format = this._depthBuffer._format;
            if (format === PIXELFORMAT_DEPTH) {
                this._depth = true;
                this._stencil = false;
            } else if (format === PIXELFORMAT_DEPTHSTENCIL) {
                this._depth = true;
                this._stencil = true;
            } else {
                Debug.warn('Incorrect depthBuffer format. Must be pc.PIXELFORMAT_DEPTH or pc.PIXELFORMAT_DEPTHSTENCIL');
                this._depth = false;
                this._stencil = false;
            }
        } else {
            this._depth = options.depth ?? true;
            this._stencil = options.stencil ?? false;
        }

        // MRT
        if (options.colorBuffers) {
            Debug.assert(!this._colorBuffers, 'When constructing RenderTarget and options.colorBuffers is used, options.colorBuffer must not be used.');

            if (!this._colorBuffers) {
                this._colorBuffers = [...options.colorBuffers];

                // set the main color buffer to point to 0 index
                this._colorBuffer = options.colorBuffers[0];
            }
        }

        // device, from one of the buffers
        const device = this._colorBuffer?.device || this._depthBuffer?.device || options.graphicsDevice;
        Debug.assert(device, "Failed to obtain the device, colorBuffer nor depthBuffer store it.");
        this._device = device;

        const { maxSamples } = this._device;
        this._samples = Math.min(options.samples ?? 1, maxSamples);

        // WebGPU only supports values of 1 or 4 for samples
        if (device.isWebGPU) {
            this._samples = this._samples > 1 ? maxSamples : 1;
        }

        this.autoResolve = options.autoResolve ?? true;

        // use specified name, otherwise get one from color or depth buffer
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

        // render image flipped in Y
        this.flipY = options.flipY ?? false;

        this.validateMrt();

        // device specific implementation
        this.impl = device.createRenderTargetImpl(this);

        Debug.trace(TRACEID_RENDER_TARGET_ALLOC, `Alloc: Id ${this.id} ${this.name}: ${this.width}x${this.height} ` +
            `[samples: ${this.samples}]` +
            `${this._colorBuffers?.length ? `[MRT: ${this._colorBuffers.length}]` : ''}` +
            `${this.colorBuffer ? '[Color]' : ''}` +
            `${this.depth ? '[Depth]' : ''}` +
            `${this.stencil ? '[Stencil]' : ''}` +
            `[Face:${this.face}]`);
    }

    /**
     * Frees resources associated with this render target.
     */
    destroy() {

        Debug.trace(TRACEID_RENDER_TARGET_ALLOC, `DeAlloc: Id ${this.id} ${this.name}`);

        const device = this._device;
        if (device) {
            device.targets.delete(this);

            if (device.renderTarget === this) {
                device.setRenderTarget(null);
            }

            this.destroyFrameBuffers();
        }
    }

    /**
     * Free device resources associated with this render target.
     *
     * @ignore
     */
    destroyFrameBuffers() {

        const device = this._device;
        if (device) {
            this.impl.destroy(device);
        }
    }

    /**
     * Free textures associated with this render target.
     *
     * @ignore
     */
    destroyTextureBuffers() {

        this._depthBuffer?.destroy();
        this._depthBuffer = null;

        this._colorBuffers?.forEach((colorBuffer) => {
            colorBuffer.destroy();
        });
        this._colorBuffers = null;
        this._colorBuffer = null;
    }

    /**
     * Resizes the render target to the specified width and height. Internally this resizes all the
     * assigned texture color and depth buffers.
     *
     * @param {number} width - The width of the render target in pixels.
     * @param {number} height - The height of the render target in pixels.
     */
    resize(width, height) {

        if (this.width !== width || this.height !== height) {

            // release existing
            const device = this._device;
            this.destroyFrameBuffers();
            if (device.renderTarget === this) {
                device.setRenderTarget(null);
            }

            // resize textures
            this._depthBuffer?.resize(width, height);
            this._colorBuffers?.forEach((colorBuffer) => {
                colorBuffer.resize(width, height);
            });

            // initialize again
            this.validateMrt();
            this.impl = device.createRenderTargetImpl(this);
        }
    }

    validateMrt() {
        Debug.call(() => {
            if (this._colorBuffers) {
                const { width, height, cubemap, volume } = this._colorBuffers[0];
                for (let i = 1; i < this._colorBuffers.length; i++) {
                    const colorBuffer = this._colorBuffers[i];
                    Debug.assert(colorBuffer.width === width, 'All render target color buffers must have the same width', this);
                    Debug.assert(colorBuffer.height === height, 'All render target color buffers must have the same height', this);
                    Debug.assert(colorBuffer.cubemap === cubemap, 'All render target color buffers must have the same cubemap setting', this);
                    Debug.assert(colorBuffer.volume === volume, 'All render target color buffers must have the same volume setting', this);
                }
            }
        });
    }

    /**
     * Initializes the resources associated with this render target.
     *
     * @ignore
     */
    init() {
        this.impl.init(this._device, this);
    }

    /** @ignore */
    get initialized() {
        return this.impl.initialized;
    }

    /** @ignore */
    get device() {
        return this._device;
    }

    /**
     * Called when the device context was lost. It releases all context related resources.
     *
     * @ignore
     */
    loseContext() {
        this.impl.loseContext();
    }

    /**
     * If samples > 1, resolves the anti-aliased render target (WebGL2 only). When you're rendering
     * to an anti-aliased render target, pixels aren't written directly to the readable texture.
     * Instead, they're first written to a MSAA buffer, where each sample for each pixel is stored
     * independently. In order to read the results, you first need to 'resolve' the buffer - to
     * average all samples and create a simple texture with one color per pixel. This function
     * performs this averaging and updates the colorBuffer and the depthBuffer. If autoResolve is
     * set to true, the resolve will happen after every rendering to this render target, otherwise
     * you can do it manually, during the app update or similar.
     *
     * @param {boolean} [color] - Resolve color buffer. Defaults to true.
     * @param {boolean} [depth] - Resolve depth buffer. Defaults to true if the render target has a
     * depth buffer.
     */
    resolve(color = true, depth = !!this._depthBuffer) {

        // TODO: consider adding support for MRT to this function.

        if (this._device && this._samples > 1) {
            DebugGraphics.pushGpuMarker(this._device, `RESOLVE-RT:${this.name}`);
            this.impl.resolve(this._device, this, color, depth);
            DebugGraphics.popGpuMarker(this._device);
        }
    }

    /**
     * Copies color and/or depth contents of source render target to this one. Formats, sizes and
     * anti-aliasing samples must match. Depth buffer can only be copied on WebGL 2.0.
     *
     * @param {RenderTarget} source - Source render target to copy from.
     * @param {boolean} [color] - If true, will copy the color buffer. Defaults to false.
     * @param {boolean} [depth] - If true, will copy the depth buffer. Defaults to false.
     * @returns {boolean} True if the copy was successful, false otherwise.
     */
    copy(source, color, depth) {

        // TODO: consider adding support for MRT to this function.

        if (!this._device) {
            if (source._device) {
                this._device = source._device;
            } else {
                Debug.error("Render targets are not initialized");
                return false;
            }
        }

        DebugGraphics.pushGpuMarker(this._device, `COPY-RT:${source.name}->${this.name}`);
        const success = this._device.copyRenderTarget(source, this, color, depth);
        DebugGraphics.popGpuMarker(this._device);

        return success;
    }

    /**
     * Number of antialiasing samples the render target uses.
     *
     * @type {number}
     */
    get samples() {
        return this._samples;
    }

    /**
     * True if the render target contains the depth attachment.
     *
     * @type {boolean}
     */
    get depth() {
        return this._depth;
    }

    /**
     * True if the render target contains the stencil attachment.
     *
     * @type {boolean}
     */
    get stencil() {
        return this._stencil;
    }

    /**
     * Color buffer set up on the render target.
     *
     * @type {import('./texture.js').Texture}
     */
    get colorBuffer() {
        return this._colorBuffer;
    }

    /**
     * Accessor for multiple render target color buffers.
     *
     * @param {*} index - Index of the color buffer to get.
     * @returns {import('./texture.js').Texture} - Color buffer at the specified index.
     */
    getColorBuffer(index) {
        return this._colorBuffers?.[index];
    }

    /**
     * Depth buffer set up on the render target. Only available, if depthBuffer was set in
     * constructor. Not available if depth property was used instead.
     *
     * @type {import('./texture.js').Texture}
     */
    get depthBuffer() {
        return this._depthBuffer;
    }

    /**
     * If the render target is bound to a cubemap, this property specifies which face of the
     * cubemap is rendered to. Can be:
     *
     * - {@link CUBEFACE_POSX}
     * - {@link CUBEFACE_NEGX}
     * - {@link CUBEFACE_POSY}
     * - {@link CUBEFACE_NEGY}
     * - {@link CUBEFACE_POSZ}
     * - {@link CUBEFACE_NEGZ}
     *
     * @type {number}
     */
    get face() {
        return this._face;
    }

    /**
     * Width of the render target in pixels.
     *
     * @type {number}
     */
    get width() {
        return this._colorBuffer?.width || this._depthBuffer?.width || this._device.width;
    }

    /**
     * Height of the render target in pixels.
     *
     * @type {number}
     */
    get height() {
        return this._colorBuffer?.height || this._depthBuffer?.height || this._device.height;
    }
}

export { RenderTarget };
