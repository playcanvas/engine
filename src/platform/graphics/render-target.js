import { Debug } from '../../core/debug.js';
import { TRACEID_RENDER_TARGET_ALLOC } from '../../core/constants.js';
import { DEPTHRESOLVE_MAX, DEPTHRESOLVE_MIN, DEPTHRESOLVE_SAMPLE0, PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTH16, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_R32F, RENDERTARGET_ORIGIN_BOTTOM, RENDERTARGET_ORIGIN_NATIVE, RENDERTARGET_ORIGIN_TOP, isSrgbPixelFormat, isMultisampleResolveCapablePixelFormat } from './constants.js';
import { DebugGraphics } from './debug-graphics.js';
import { GraphicsDevice } from './graphics-device.js';
import { TextureUtils } from './texture-utils.js';

/**
 * @import { Texture } from './texture.js'
 */

let id = 0;

/**
 * A render target is a rectangular rendering surface that can be rendered into, instead of the
 * screen. It wraps one or more color buffer {@link Texture}s and an optional depth (and stencil)
 * buffer. Once a camera or a render pass has rendered into it, the color texture holds the result
 * and can be used anywhere a normal texture can - applied to a material to display it in the
 * scene, or fed into further processing. This underpins effects such as in-world screens, mirrors
 * and portals, reflections, picking and custom multi-pass pipelines.
 *
 * ## Usage
 * Create a texture to render into, wrap it in a render target and assign it to a camera. The
 * texture must use a renderable, uncompressed format:
 *
 * ```javascript
 * const texture = new Texture(device, {
 *     width: 512,
 *     height: 512,
 *     format: PIXELFORMAT_SRGBA8,
 *     mipmaps: false,
 *     minFilter: FILTER_LINEAR,
 *     magFilter: FILTER_LINEAR
 * });
 *
 * const renderTarget = new RenderTarget({
 *     colorBuffer: texture,
 *     depth: true,
 *     origin: RENDERTARGET_ORIGIN_TOP
 * });
 *
 * // the camera renders into the texture instead of the screen
 * cameraEntity.camera.renderTarget = renderTarget;
 *
 * // and the texture can be used as any other, for example by a material
 * material.emissiveMap = texture;
 * ```
 *
 * When the result is sampled as a regular texture like this, specify the `origin` option as
 * {@link RENDERTARGET_ORIGIN_TOP}, which stores the image in the same orientation on all graphics
 * APIs. Multiple color buffers can be attached using the `colorBuffers` option, to render into
 * all of them simultaneously from a single pass (MRT).
 *
 * A live example: {@link https://playcanvas.github.io/#/graphics/render-to-texture}
 *
 * ## Multisampling (MSAA)
 * Set the `samples` option to a value greater than 1 to render with hardware anti-aliasing. The
 * render target internally allocates a multisampled buffer to render into, and automatically
 * resolves it into the single-sampled `colorBuffer` at the end of a render pass - the color
 * texture is used the same way as in the single-sampled case.
 *
 * ```javascript
 * const renderTarget = new RenderTarget({ colorBuffer: texture, depth: true, samples: 4 });
 * ```
 *
 * ## Explicit multisampled color buffers and custom resolves (WebGPU)
 * A multisampled texture (a {@link Texture} created with `samples` greater than 1, WebGPU only)
 * can be used as the color buffer directly. The render target then renders into its samples, and
 * the sample count is inferred from the texture. Provide a `resolveBuffer` to get the standard
 * hardware resolve, or omit it to keep the individual samples: these are then read in a shader
 * using `textureLoad` on a `texture_multisampled_2d`, typically by a follow-up pass implementing
 * a custom resolve - an operation the hardware resolve cannot express, such as a tonemapped or
 * min/max resolve. This is also the only way to use multisampling with formats the hardware
 * cannot resolve, such as integer formats.
 *
 * ```javascript
 * // a multisampled texture, rendered into directly
 * const msColor = new Texture(device, {
 *     width: 512,
 *     height: 512,
 *     format: PIXELFORMAT_RGBA16F,
 *     samples: 4
 * });
 *
 * // renders into the samples of msColor, which are stored (no resolve buffer),
 * // to be read by a custom resolve pass using textureLoad
 * const renderTarget = new RenderTarget({ colorBuffer: msColor, depth: true });
 * ```
 *
 * A live example: {@link https://playcanvas.github.io/#/graphics-advanced/custom-msaa-resolve}
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
     * @type {GraphicsDevice}
     * @private
     */
    _device;

    /**
     * @type {Texture}
     * @private
     */
    _colorBuffer;

    /**
     * @type {Texture[]}
     * @private
     */
    _colorBuffers;

    /**
     * @type {Texture}
     * @private
     */
    _depthBuffer;

    /**
     * Per-attachment resolve targets for explicit multisampled color attachments.
     *
     * @type {(Texture|null)[]|null}
     * @private
     */
    _resolveBuffers = null;

    /**
     * Single-sampled resolve target for an explicit multisampled depth buffer.
     *
     * @type {Texture|null}
     * @private
     */
    _depthResolveBuffer = null;

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

    /**
     * @type {boolean}
     * @private
     */
    _transientColor;

    /**
     * @type {boolean}
     * @private
     */
    _transientDepth;

    /** @type {boolean} */
    autoResolve;

    /**
     * @type {string}
     * @private
     */
    _depthResolveMode = DEPTHRESOLVE_MIN;

    /**
     * @type {number}
     * @private
     */
    _face;

    /**
     * @type {number}
     * @private
     */
    _mipLevel;

    /**
     * True if the mipmaps should be automatically generated for the color buffer(s) if it contains
     * a mip chain.
     *
     * @type {boolean}
     * @private
     */
    _mipmaps;

    /**
     * @type {number | undefined}
     * @private
     */
    _width;

    /**
     * @type {number | undefined}
     * @private
     */
    _height;

    /**
     * @type {boolean}
     * @private
     */
    _flipY;

    /**
     * @type {string}
     * @private
     */
    _origin;

    /**
     * Creates a new RenderTarget instance. A color buffer or a depth buffer must be set.
     *
     * @param {object} [options] - Object for passing optional arguments.
     * @param {boolean} [options.autoResolve] - If samples > 1, enables or disables automatic MSAA
     * resolve after rendering to this RT (see {@link resolve}). Applies to the implicit
     * multisampled path only - resolves of explicit multisampled attachments (a multisampled
     * `colorBuffer` with a `resolveBuffer`, or a multisampled `depthBuffer` with a
     * `depthResolveBuffer`) are controlled by the per-pass resolve flags instead. Defaults to
     * true.
     * @param {string} [options.depthResolveMode] - How the samples of the multisampled depth
     * buffer are resolved into a single depth value, whenever the depth of this render target is
     * resolved by a shader-based resolve (WebGPU only) - the depth grab pass (`sceneDepthMap`), a
     * depth {@link copy}, or the automatic resolve into a provided `depthBuffer`. Can be:
     *
     * - {@link DEPTHRESOLVE_MIN}: the minimum sample value - with a standard depth buffer this
     * selects the nearest surface, a conservative and stable choice for depth-consuming effects.
     * - {@link DEPTHRESOLVE_MAX}: the maximum sample value - the farthest surface.
     * - {@link DEPTHRESOLVE_SAMPLE0}: the value of the sample at index 0.
     *
     * Defaults to {@link DEPTHRESOLVE_MIN}. Ignored on WebGL2, where the sample selection of the
     * depth resolve is defined by the implementation. Can also be changed at any time using the
     * {@link depthResolveMode} property.
     * @param {Texture} [options.colorBuffer] - The texture that this render target will treat as a
     * rendering surface. This can be a multisampled texture (a texture created with `samples` > 1,
     * WebGPU only), in which case the render target renders directly into its samples, the sample
     * count is inferred from the texture, and an optional `resolveBuffer` receives the hardware
     * resolve.
     * @param {Texture[]} [options.colorBuffers] - The textures that this render target will treat
     * as a rendering surfaces. If this option is set, the colorBuffer option is ignored. All
     * textures must have the same sample count.
     * @param {Texture|null} [options.resolveBuffer] - A single-sampled texture that the
     * multisampled color buffer is hardware-resolved into at the end of a render pass. Only valid
     * when `colorBuffer` is a multisampled texture, and must match its format and dimensions. When
     * not provided, the multisampled samples are stored instead, to be read in a shader using
     * `textureLoad` (a custom resolve). Note that integer formats and {@link PIXELFORMAT_R32F}
     * cannot be hardware-resolved.
     * @param {(Texture|null)[]} [options.resolveBuffers] - Per-attachment resolve textures
     * matching `colorBuffers` by index; use null for attachments that should not be
     * hardware-resolved. If this option is set, the resolveBuffer option must not be used.
     * @param {boolean} [options.depth] - If set to true, depth buffer will be created. Defaults to
     * true. Ignored if depthBuffer is defined.
     * @param {Texture} [options.depthBuffer] - The texture that this render target will treat as a
     * depth/stencil surface. If set, the 'depth' and 'stencil' properties are ignored. The texture
     * must use {@link PIXELFORMAT_DEPTH}, {@link PIXELFORMAT_DEPTH16} or
     * {@link PIXELFORMAT_DEPTHSTENCIL} format. On WebGPU this can be a multisampled texture (a
     * texture created with `samples` > 1), in which case the render target renders directly into
     * its depth samples, which can later be read in a shader using `textureLoad` on a
     * `texture_depth_multisampled_2d`, or resolved into an optional `depthResolveBuffer`.
     * @param {Texture} [options.depthResolveBuffer] - A single-sampled {@link PIXELFORMAT_R32F}
     * texture that the multisampled depth buffer is resolved into at the end of a render pass,
     * using a shader-based resolve controlled by {@link RenderTarget#depthResolveMode} (WebGPU
     * only - no hardware depth resolve exists). Only valid when `depthBuffer` is a multisampled
     * texture, and must match its dimensions.
     * @param {number} [options.mipLevel] - If set to a number greater than 0, the render target
     * will render to the specified mip level of the color buffer. Defaults to 0.
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
     * @param {string} [options.name] - The name of the render target.
     * @param {string} [options.origin] - Controls the vertical orientation of the image stored
     * in the render target. Choose based on how the texture is sampled. Can be:
     *
     * - {@link RENDERTARGET_ORIGIN_TOP}: row 0 of the stored image is the top row of the
     * rendered image, on all graphics APIs - the same layout image textures use. Use for
     * anything treated as a picture: sampling with mesh UVs, cube map faces, or pixel readback
     * saved as an image. Recommended for all new content - write the sampling code as if the
     * texture was a loaded image. Internally the image is rendered upside-down on WebGL2.
     * - {@link RENDERTARGET_ORIGIN_BOTTOM}: row 0 of the stored image is the bottom row of the
     * rendered image, on all graphics APIs - replicating WebGL2's native layout. Use to keep
     * consuming code written against WebGL conventions working unchanged on all APIs: shaders
     * deriving UVs from projected (NDC) coordinates or a projection scale-bias matrix, and
     * texture atlases addressing cells by viewport rectangles (on WebGPU this also switches
     * viewport / scissor rectangles to raw texel-row addressing). If a render target that worked
     * on WebGL2 appears upside-down on WebGPU, this is the drop-in fix; migrating the sampling
     * code to image orientation and {@link RENDERTARGET_ORIGIN_TOP} is the better long-term
     * choice. Internally the image is rendered upside-down on WebGPU.
     * - {@link RENDERTARGET_ORIGIN_NATIVE}: the image is stored in the native orientation of the
     * graphics API and the row order differs between WebGL2 (bottom-up) and WebGPU (top-down).
     * No flipping takes place. Only appropriate for orientation-agnostic consumers: UVs derived
     * from gl_FragCoord, sampling via the same matrix the target was rendered with (shadow
     * maps), or integer texel fetch.
     *
     * Takes precedence over the deprecated `flipY` option. Defaults to
     * {@link RENDERTARGET_ORIGIN_NATIVE}.
     * @param {number} [options.samples] - Number of hardware anti-aliasing samples. Default is 1.
     * @param {boolean} [options.stencil] - If set to true, depth buffer will include stencil.
     * Defaults to false. Ignored if depthBuffer is defined or depth is false.
     * @param {boolean} [options.transientColor] - If set to true, the multi-sampled (MSAA) color
     * attachment is allocated as a transient ("memoryless") attachment, allowing tile-based GPUs to
     * keep its contents in on-chip memory and avoid VRAM allocation. WebGPU only, and only effective
     * when samples > 1 - it has no effect on single-sampled color (which is always stored). Ignored
     * on devices without transient attachment support. The attachment must be cleared on load and
     * discarded on store, so it is incompatible with a scene color grab pass (`sceneColorMap`).
     * Defaults to false.
     * @param {boolean} [options.transientDepth] - If set to true, the (engine-allocated) depth
     * attachment is allocated as a transient ("memoryless") attachment (see `transientColor`).
     * Applies to both single- and multi-sampled depth. WebGPU only; ignored on devices without
     * transient attachment support, and ignored (with a warning) when an explicit `depthBuffer` is
     * provided. Incompatible with a scene depth grab pass (`sceneDepthMap`), a depth prepass, or any
     * depth resolve, as the depth cannot be sampled or copied out. Defaults to false.
     * @example
     * // Create a 512x512x24-bit render target with a depth buffer
     * const colorBuffer = new Texture(graphicsDevice, {
     *     width: 512,
     *     height: 512,
     *     format: PIXELFORMAT_RGB8
     * });
     * const renderTarget = new RenderTarget({
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
        Debug.assert(!(options instanceof GraphicsDevice), 'RenderTarget constructor no longer accepts GraphicsDevice parameter.');
        this.id = id++;

        // device, from one of the buffers
        const device = options.colorBuffer?.device ?? options.colorBuffers?.[0].device ?? options.depthBuffer?.device ?? options.graphicsDevice;
        Debug.assert(device, 'Failed to obtain the device, colorBuffer nor depthBuffer store it.');
        this._device = device;

        // samples. When the provided color buffers are multisampled textures (explicit
        // multisampled attachments, WebGPU only), the render target renders directly into them
        // and the sample count is inferred from the textures. Any multisampled attachment selects
        // the explicit mode, so that mixed sample counts are caught by the validation below
        // regardless of the attachment order.
        const { maxSamples } = this._device;
        const suppliedColorBuffers = options.colorBuffers ?? (options.colorBuffer ? [options.colorBuffer] : undefined);
        const msColorBuffer = suppliedColorBuffers?.find(colorBuffer => colorBuffer?.samples > 1);
        const msDepthBuffer = (options.depthBuffer?.samples ?? 1) > 1 ? options.depthBuffer : undefined;
        const msBuffer = msColorBuffer ?? msDepthBuffer;
        const explicitMsaa = !!msBuffer;
        if (explicitMsaa) {
            this._samples = msBuffer.samples;
            Debug.call(() => {
                if (options.samples !== undefined && options.samples !== this._samples) {
                    Debug.warnOnce(`RenderTarget '${options.name ?? msBuffer.name}': the samples option (${options.samples}) does not match the multisampled buffer (${this._samples} samples); using the buffer's sample count.`);
                }
            });
        } else {
            this._samples = Math.min(options.samples ?? 1, maxSamples);
            if (device.isWebGPU) {
                // WebGPU only supports values of 1 or 4 for samples
                this._samples = this._samples > 1 ? maxSamples : 1;
            }
        }

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
            if (format === PIXELFORMAT_DEPTH || format === PIXELFORMAT_DEPTH16) {
                this._depth = true;
                this._stencil = false;
            } else if (format === PIXELFORMAT_DEPTHSTENCIL) {
                this._depth = true;
                this._stencil = true;
            } else if (format === PIXELFORMAT_R32F && this._depthBuffer.device.isWebGPU && this._samples > 1) {
                // on WebGPU, when multisampling is enabled, we use R32F format for the specified buffer,
                // which we can resolve depth to using a shader
                this._depth = true;
                this._stencil = false;
            } else {
                Debug.warn('Incorrect depthBuffer format. Must be PIXELFORMAT_DEPTH or PIXELFORMAT_DEPTHSTENCIL');
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

        // resolve buffers - per-attachment resolve targets for explicit multisampled attachments
        const resolveOption = options.resolveBuffers ?? (options.resolveBuffer !== undefined ? [options.resolveBuffer] : undefined);
        Debug.assert(!(options.resolveBuffers && options.resolveBuffer), 'When constructing RenderTarget and options.resolveBuffers is used, options.resolveBuffer must not be used.');
        if (resolveOption) {
            if (explicitMsaa) {
                this._resolveBuffers = [...resolveOption];
            } else {
                Debug.error(`RenderTarget '${options.name ?? this._colorBuffer?.name}': resolveBuffer(s) are only supported when the color buffers are multisampled textures. With a single-sampled colorBuffer and samples > 1, the colorBuffer itself is the resolve target. The resolve buffers are ignored.`);
            }
        }

        // depth resolve buffer - a single-sampled destination the multisampled depth buffer is
        // shader-resolved into at the end of a render pass
        if (options.depthResolveBuffer) {
            if (msDepthBuffer) {
                this._depthResolveBuffer = options.depthResolveBuffer;
            } else {
                Debug.error(`RenderTarget '${options.name ?? this._depthBuffer?.name}': depthResolveBuffer is only supported when the depthBuffer is a multisampled texture. The depth resolve buffer is ignored.`);
            }
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
            this.name = 'Untitled';
        }

        this.depthResolveMode = options.depthResolveMode ?? DEPTHRESOLVE_MIN;

        // validate explicit multisampled attachments and their resolve buffers
        Debug.call(() => {
            if (explicitMsaa) {
                this._colorBuffers?.forEach((colorBuffer, index) => {
                    Debug.assert(colorBuffer.samples === this._samples,
                        `RenderTarget '${this.name}': all color buffers must have the same sample count, but color buffer ${index} has ${colorBuffer.samples} samples while ${this._samples} are expected.`, this);
                    const format = colorBuffer.format;
                    Debug.assert(format !== PIXELFORMAT_DEPTH && format !== PIXELFORMAT_DEPTH16 && format !== PIXELFORMAT_DEPTHSTENCIL,
                        `RenderTarget '${this.name}': a depth format texture cannot be used as a color buffer, use the depthBuffer option.`, this);
                });
                this._resolveBuffers?.forEach((resolveBuffer, index) => {
                    if (!resolveBuffer) return;
                    const colorBuffer = this._colorBuffers?.[index];
                    Debug.assert(colorBuffer,
                        `RenderTarget '${this.name}': resolveBuffer at index ${index} has no matching color buffer.`, this);
                    if (!colorBuffer) return;
                    Debug.assert(resolveBuffer.samples === 1,
                        `RenderTarget '${this.name}': resolveBuffer at index ${index} must be single-sampled, but has ${resolveBuffer.samples} samples.`, this);
                    Debug.assert(resolveBuffer.format === colorBuffer.format,
                        `RenderTarget '${this.name}': resolveBuffer at index ${index} format does not match its color buffer format.`, this);
                    Debug.assert(resolveBuffer.width === colorBuffer.width && resolveBuffer.height === colorBuffer.height,
                        `RenderTarget '${this.name}': resolveBuffer at index ${index} dimensions (${resolveBuffer.width}x${resolveBuffer.height}) do not match its color buffer (${colorBuffer.width}x${colorBuffer.height}).`, this);
                    Debug.assert(isMultisampleResolveCapablePixelFormat(colorBuffer.format),
                        `RenderTarget '${this.name}': color buffer format at index ${index} cannot be hardware-resolved; omit the resolveBuffer and resolve in a shader using textureLoad.`, this);
                });

                // depth buffer of an explicit multisampled render target
                const depthBuffer = this._depthBuffer;
                if (depthBuffer) {
                    Debug.assert(depthBuffer.samples === this._samples,
                        `RenderTarget '${this.name}': the depth buffer must have the same sample count as the color buffers, but has ${depthBuffer.samples} samples while ${this._samples} are expected.`, this);
                    if (depthBuffer.samples > 1) {
                        const format = depthBuffer.format;
                        Debug.assert(format === PIXELFORMAT_DEPTH || format === PIXELFORMAT_DEPTH16 || format === PIXELFORMAT_DEPTHSTENCIL,
                            `RenderTarget '${this.name}': a multisampled depthBuffer must use a depth format.`, this);
                    }
                }

                // depth resolve buffer
                const depthResolveBuffer = this._depthResolveBuffer;
                if (depthResolveBuffer && depthBuffer) {
                    Debug.assert(depthResolveBuffer.samples === 1,
                        `RenderTarget '${this.name}': depthResolveBuffer must be single-sampled, but has ${depthResolveBuffer.samples} samples.`, this);
                    Debug.assert(depthResolveBuffer.format === PIXELFORMAT_R32F,
                        `RenderTarget '${this.name}': depthResolveBuffer must use the PIXELFORMAT_R32F format.`, this);
                    Debug.assert(depthResolveBuffer.width === depthBuffer.width && depthResolveBuffer.height === depthBuffer.height,
                        `RenderTarget '${this.name}': depthResolveBuffer dimensions (${depthResolveBuffer.width}x${depthResolveBuffer.height}) do not match the depth buffer (${depthBuffer.width}x${depthBuffer.height}).`, this);
                }
            }
        });

        // transient (memoryless) attachments (WebGPU only). Gated on device support, so they are
        // silently ignored when the device does not support transient attachments. Transient color
        // additionally requires MSAA (single-sampled color is always stored), also silently ignored.
        // An explicit multisampled attachment cannot be transient (the user texture is bindable,
        // which is incompatible with a memoryless allocation).
        const transientSupported = !!this._device.supportsTransientAttachments;
        this._transientColor = (options.transientColor ?? false) && transientSupported && this._samples > 1 && !explicitMsaa;
        if ((options.transientColor ?? false) && explicitMsaa) {
            Debug.warnOnce(`RenderTarget '${this.name}' was created with transientColor and multisampled color buffers. A user-provided multisampled texture cannot be transient (memoryless); the transientColor flag is ignored.`);
        }
        this._transientDepth = (options.transientDepth ?? false) && transientSupported && !this._depthBuffer;

        // transient depth applies to the engine-allocated depth buffer only. Requesting it together
        // with a user-provided depthBuffer is invalid API usage (that buffer's contents must persist),
        // so warn rather than silently ignore it - unlike the unsupported-device case above.
        if ((options.transientDepth ?? false) && this._depthBuffer) {
            Debug.warnOnce(`RenderTarget '${this.name}' was created with both transientDepth and a depthBuffer. Transient depth applies to the engine-allocated depth buffer only and cannot be used with a provided depthBuffer; the transientDepth flag is ignored.`);
        }

        // resolve the origin option to a per-API flipY value: 'top' stores standard image row
        // order (flips on WebGL), 'bottom' replicates the WebGL layout on all APIs (flips on
        // WebGPU), 'native' (the default) stores the API-native orientation without flipping
        Debug.call(() => {
            if (options.origin !== undefined) {
                Debug.assert(options.origin === RENDERTARGET_ORIGIN_TOP || options.origin === RENDERTARGET_ORIGIN_BOTTOM || options.origin === RENDERTARGET_ORIGIN_NATIVE, `RenderTarget '${this.name}': invalid origin option '${options.origin}'.`);
                if (options.flipY !== undefined) {
                    Debug.warnOnce(`RenderTarget '${this.name}': both 'origin' and 'flipY' options are specified, 'origin' takes precedence.`);
                }
            }
        });
        if (options.origin === RENDERTARGET_ORIGIN_TOP) {
            this._flipY = !device.isWebGPU;
            this._origin = RENDERTARGET_ORIGIN_TOP;
        } else if (options.origin === RENDERTARGET_ORIGIN_BOTTOM) {
            this._flipY = device.isWebGPU;
            this._origin = RENDERTARGET_ORIGIN_BOTTOM;
        } else if (options.origin === RENDERTARGET_ORIGIN_NATIVE) {
            this._flipY = false;
            this._origin = RENDERTARGET_ORIGIN_NATIVE;
        } else {
            // origin not specified - honor the deprecated flipY option, and derive the
            // equivalent origin from it
            if (options.flipY !== undefined) {
                Debug.deprecated('RenderTarget "flipY" option is deprecated, use the "origin" option instead. Typical migration: flipY: !device.isWebGPU -> origin: RENDERTARGET_ORIGIN_TOP, flipY: device.isWebGPU -> origin: RENDERTARGET_ORIGIN_BOTTOM.');
            }
            this._flipY = options.flipY ?? false;
            this._origin = this._flipY ? (device.isWebGPU ? RENDERTARGET_ORIGIN_BOTTOM : RENDERTARGET_ORIGIN_TOP) : RENDERTARGET_ORIGIN_NATIVE;
        }

        this._mipLevel = options.mipLevel ?? 0;
        if (this._mipLevel > 0 && explicitMsaa) {
            Debug.error(`Rendering to a mipLevel is not supported for multisampled color buffers (they have a single mip level). Ignoring mipLevel ${this._mipLevel} for render target ${this.name}`);
            this._mipLevel = 0;
        }
        if (this._mipLevel > 0 && this._depth) {
            Debug.error(`Rendering to a mipLevel is not supported when render target uses a depth buffer. Ignoring mipLevel ${this._mipLevel} for render target ${this.name}`, {
                renderTarget: this,
                options
            });
            this._mipLevel = 0;
        }

        // if we render to a specific mipmap (even 0), do not generate mipmaps
        this._mipmaps = options.mipLevel === undefined;

        // evaluate and cache dimensions
        this.evaluateDimensions();

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

        this._resolveBuffers?.forEach((resolveBuffer) => {
            resolveBuffer?.destroy();
        });
        this._resolveBuffers = null;

        this._depthResolveBuffer?.destroy();
        this._depthResolveBuffer = null;
    }

    /**
     * Resizes the render target to the specified width and height. Internally this resizes all the
     * assigned texture color and depth buffers.
     *
     * @param {number} width - The width of the render target in pixels.
     * @param {number} height - The height of the render target in pixels.
     */
    resize(width, height) {

        if (this.mipLevel > 0) {
            Debug.warn('Only a render target rendering to mipLevel 0 can be resized, ignoring.', this);
            return;
        }

        // resize textures (they handle their own change detection)
        this._depthBuffer?.resize(width, height);
        this._colorBuffers?.forEach((colorBuffer) => {
            colorBuffer.resize(width, height);
        });
        this._resolveBuffers?.forEach((resolveBuffer) => {
            resolveBuffer?.resize(width, height);
        });
        this._depthResolveBuffer?.resize(width, height);

        // only rebuild framebuffers if dimensions changed
        if (this._width !== width || this._height !== height) {

            // release existing
            this.destroyFrameBuffers();

            // disconnect from the device
            const device = this._device;
            if (device.renderTarget === this) {
                device.setRenderTarget(null);
            }

            // create new
            this.evaluateDimensions();
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
     * Evaluates and stores the width and height of the render target based on the color/depth
     * buffers and mip level.
     *
     * @private
     */
    evaluateDimensions() {
        // If we have buffers, calculate dimensions from them
        const buffer = this._colorBuffer ?? this._depthBuffer;
        if (buffer) {
            this._width = buffer.width;
            this._height = buffer.height;

            // Apply mip level adjustment
            if (this._mipLevel > 0) {
                this._width = TextureUtils.calcLevelDimension(this._width, this._mipLevel);
                this._height = TextureUtils.calcLevelDimension(this._height, this._mipLevel);
            }
        }
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
            DebugGraphics.pushGpuMarker(this._device, `RESOLVE-RT:${this.name}:${color ? '[color]' : ''}:${depth ? '[depth]' : ''}`);
            this.impl.resolve(this._device, this, color, depth);
            DebugGraphics.popGpuMarker(this._device);
        }
    }

    /**
     * Copies color and/or depth contents of source render target to this one. Formats, sizes and
     * anti-aliasing samples must match.
     *
     * A depth copy is supported in these cases:
     *
     * - On WebGL 2.0, between render targets with matching sample counts.
     * - On WebGPU, between single-sampled render targets.
     * - On WebGPU, from a multisampled source into a multisampled `depthBuffer` of this render
     * target with an equal sample count and matching format - a full depth snapshot, including
     * the individual samples.
     * - On WebGPU, from a multisampled source into a single-sampled {@link PIXELFORMAT_R32F}
     * color buffer of this render target - a shader-based resolve controlled by the source's
     * {@link RenderTarget#depthResolveMode}.
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
                Debug.error('Render targets are not initialized');
                return false;
            }
        }

        DebugGraphics.pushGpuMarker(this._device, `COPY-RT:${source.name}->${this.name}`);
        const success = this._device.copyRenderTarget(source, this, color, depth);
        DebugGraphics.popGpuMarker(this._device);

        return success;
    }

    /**
     * @deprecated Use the "origin" option of the RenderTarget constructor instead. Typical
     * migration: flipY: !device.isWebGPU -> origin: RENDERTARGET_ORIGIN_TOP, flipY: device.isWebGPU
     * -> origin: RENDERTARGET_ORIGIN_BOTTOM.
     * @ignore
     */
    set flipY(value) {
        Debug.deprecated('RenderTarget#flipY is deprecated, use the "origin" option of the RenderTarget constructor instead. Typical migration: flipY: !device.isWebGPU -> origin: RENDERTARGET_ORIGIN_TOP, flipY: device.isWebGPU -> origin: RENDERTARGET_ORIGIN_BOTTOM.');
        this._flipY = value;
        this._origin = value ? (this._device.isWebGPU ? RENDERTARGET_ORIGIN_BOTTOM : RENDERTARGET_ORIGIN_TOP) : RENDERTARGET_ORIGIN_NATIVE;
    }

    /**
     * Gets whether the rendered image is flipped in Y.
     *
     * @type {boolean}
     * @ignore
     */
    get flipY() {
        return this._flipY;
    }

    /**
     * Gets the vertical orientation of the image stored in this render target, as resolved at
     * construction from the `origin` option, or derived from the deprecated flipY option or
     * property. Can be {@link RENDERTARGET_ORIGIN_TOP}, {@link RENDERTARGET_ORIGIN_BOTTOM} or
     * {@link RENDERTARGET_ORIGIN_NATIVE}. See the `origin` option of the constructor for
     * details.
     *
     * @type {string}
     */
    get origin() {
        return this._origin;
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
     * Sets how the samples of the multisampled depth buffer are resolved into a single depth
     * value (WebGPU only). Can be changed at any time - the mode is used at the time the depth is
     * resolved. See the `depthResolveMode` constructor option.
     *
     * @type {string}
     */
    set depthResolveMode(value) {
        Debug.assert(value === DEPTHRESOLVE_MIN || value === DEPTHRESOLVE_MAX || value === DEPTHRESOLVE_SAMPLE0,
            `RenderTarget '${this.name}': invalid depthResolveMode '${value}'.`, this);
        this._depthResolveMode = value;
    }

    /**
     * Gets how the samples of the multisampled depth buffer are resolved into a single depth
     * value.
     *
     * @type {string}
     */
    get depthResolveMode() {
        return this._depthResolveMode;
    }

    /**
     * True if the multi-sampled color attachment is allocated as a transient ("memoryless")
     * attachment (WebGPU only). See the `transientColor` constructor option.
     *
     * @type {boolean}
     */
    get transientColor() {
        return this._transientColor;
    }

    /**
     * True if the depth attachment is allocated as a transient ("memoryless") attachment (WebGPU
     * only). See the `transientDepth` constructor option.
     *
     * @type {boolean}
     */
    get transientDepth() {
        return this._transientDepth;
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
     * @type {Texture}
     */
    get colorBuffer() {
        return this._colorBuffer;
    }

    /**
     * The number of color buffers (attachments) set up on the render target.
     *
     * @type {number}
     */
    get colorBufferCount() {
        return this._colorBuffers?.length ?? 0;
    }

    /**
     * Accessor for multiple render target color buffers.
     *
     * @param {number} index - Index of the color buffer to get.
     * @returns {Texture} - Color buffer at the specified index.
     */
    getColorBuffer(index) {
        return this._colorBuffers?.[index];
    }

    /**
     * The resolve texture of the first color attachment, when the render target uses explicit
     * multisampled color buffers and a resolve buffer was provided. See the `resolveBuffer`
     * constructor option. Null otherwise.
     *
     * @type {Texture|null}
     */
    get resolveBuffer() {
        return this._resolveBuffers?.[0] ?? null;
    }

    /**
     * Accessor for the per-attachment resolve textures. See the `resolveBuffers` constructor
     * option.
     *
     * @param {number} [index] - Index of the color attachment. Defaults to 0.
     * @returns {Texture|null} - The resolve texture at the specified index, or null when the
     * attachment has none.
     */
    getResolveBuffer(index = 0) {
        return this._resolveBuffers?.[index] ?? null;
    }

    /**
     * Depth buffer set up on the render target. Only available, if depthBuffer was set in
     * constructor. Not available if depth property was used instead.
     *
     * @type {Texture}
     */
    get depthBuffer() {
        return this._depthBuffer;
    }

    /**
     * The single-sampled texture the multisampled depth buffer is resolved into at the end of a
     * render pass. See the `depthResolveBuffer` constructor option. Null when not provided.
     *
     * @type {Texture|null}
     */
    get depthResolveBuffer() {
        return this._depthResolveBuffer;
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
     * Mip level of the render target.
     *
     * @type {number}
     */
    get mipLevel() {
        return this._mipLevel;
    }

    /**
     * True if the mipmaps are automatically generated for the color buffer(s) if it contains
     * a mip chain.
     *
     * @type {boolean}
     */
    get mipmaps() {
        return this._mipmaps;
    }

    /**
     * Width of the render target in pixels.
     *
     * @type {number}
     */
    get width() {
        return this._width ?? this._device.width;
    }

    /**
     * Height of the render target in pixels.
     *
     * @type {number}
     */
    get height() {
        return this._height ?? this._device.height;
    }

    set _glFrameBuffer(value) {
        Debug.removed('RenderTarget#_glFrameBuffer setter was removed. Use RenderTarget.impl#_glFrameBuffer instead.');
    }

    get _glFrameBuffer() {
        Debug.deprecated('RenderTarget#_glFrameBuffer is deprecated. Use RenderTarget.impl#_glFrameBuffer instead.');
        return this.impl._glFrameBuffer;
    }

    /**
     * Gets whether the format of the specified color buffer is sRGB.
     *
     * @param {number} index - The index of the color buffer.
     * @returns {boolean} True if the color buffer is sRGB, false otherwise.
     * @ignore
     */
    isColorBufferSrgb(index = 0) {
        if (this.device.backBuffer === this) {
            return isSrgbPixelFormat(this.device.backBufferFormat);
        }

        const colorBuffer = this.getColorBuffer(index);
        return colorBuffer ? isSrgbPixelFormat(colorBuffer.format) : false;
    }
}

export { RenderTarget };
