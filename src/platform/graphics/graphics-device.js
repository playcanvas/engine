import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { now } from '../../core/time.js';
import { BlendState } from './blend-state.js';

import {
    BUFFER_STATIC,
    CLEARFLAG_COLOR,
    CLEARFLAG_DEPTH,
    PRIMITIVE_POINTS, PRIMITIVE_TRIFAN, SEMANTIC_POSITION, TYPE_FLOAT32
} from './constants.js';
import { ScopeSpace } from './scope-space.js';
import { VertexBuffer } from './vertex-buffer.js';
import { VertexFormat } from './vertex-format.js';

const EVENT_RESIZE = 'resizecanvas';

/**
 * The graphics device manages the underlying graphics context. It is responsible for submitting
 * render state changes and graphics primitives to the hardware. A graphics device is tied to a
 * specific canvas HTML element. It is valid to have more than one canvas element per page and
 * create a new graphics device against each.
 *
 * @augments EventHandler
 */
class GraphicsDevice extends EventHandler {
    /**
     * The canvas DOM element that provides the underlying WebGL context used by the graphics device.
     *
     * @type {HTMLCanvasElement}
     */
    canvas;

    /**
     * True if the deviceType is WebGPU
     *
     * @type {boolean}
     */
    isWebGPU = false;

    /**
     * The scope namespace for shader attributes and variables.
     *
     * @type {ScopeSpace}
     */
    scope;

    /**
     * The maximum number of supported bones using uniform buffers.
     *
     * @type {number}
     */
    boneLimit;

    /**
     * The maximum supported texture anisotropy setting.
     *
     * @type {number}
     */
    maxAnisotropy;

    /**
     * The maximum supported dimension of a cube map.
     *
     * @type {number}
     */
    maxCubeMapSize;

    /**
     * The maximum supported dimension of a texture.
     *
     * @type {number}
     */
    maxTextureSize;

    /**
     * The maximum supported dimension of a 3D texture (any axis).
     *
     * @type {number}
     */
    maxVolumeSize;

    /**
     * The highest shader precision supported by this graphics device. Can be 'hiphp', 'mediump' or
     * 'lowp'.
     *
     * @type {string}
     */
    precision;

    /**
     * Currently active render target.
     *
     * @type {import('./render-target.js').RenderTarget}
     * @ignore
     */
    renderTarget = null;

    /** @type {boolean} */
    insideRenderPass = false;

    /**
     * True if hardware instancing is supported.
     *
     * @type {boolean}
     */
    supportsInstancing;

    /**
     * True if the device supports uniform buffers.
     *
     * @type {boolean}
     * @ignore
     */
    supportsUniformBuffers = false;

    /**
     * True if 32-bit floating-point textures can be used as a frame buffer.
     *
     * @type {boolean}
     */
    textureFloatRenderable;

     /**
      * True if 16-bit floating-point textures can be used as a frame buffer.
      *
      * @type {boolean}
      */
    textureHalfFloatRenderable;

    /**
     * A vertex buffer representing a quad.
     *
     * @type {VertexBuffer}
     * @ignore
     */
    quadVertexBuffer;

    /**
     * An object representing current blend state
     *
     * @ignore
     */
    blendState = new BlendState();

    defaultClearOptions = {
        color: [0, 0, 0, 1],
        depth: 1,
        stencil: 0,
        flags: CLEARFLAG_COLOR | CLEARFLAG_DEPTH
    };

    constructor(canvas) {
        super();

        this.canvas = canvas;

        // local width/height without pixelRatio applied
        this._width = 0;
        this._height = 0;

        // Some devices window.devicePixelRatio can be less than one
        // eg Oculus Quest 1 which returns a window.devicePixelRatio of 0.8
        this._maxPixelRatio = platform.browser ? Math.min(1, window.devicePixelRatio) : 1;

        // Array of objects that need to be re-initialized after a context restore event
        /** @type {import('./shader.js').Shader[]} */
        this.shaders = [];

        this.buffers = [];

        /** @type {import('./texture.js').Texture[]} */
        this.textures = [];

        /** @type {import('./render-target.js').RenderTarget[]} */
        this.targets = [];

        this._vram = {
            // #if _PROFILER
            texShadow: 0,
            texAsset: 0,
            texLightmap: 0,
            // #endif
            tex: 0,
            vb: 0,
            ib: 0,
            ub: 0
        };

        this._shaderStats = {
            vsCompiled: 0,
            fsCompiled: 0,
            linked: 0,
            materialShaders: 0,
            compileTime: 0
        };

        this.initializeContextCaches();

        // Profiler stats
        this._drawCallsPerFrame = 0;
        this._shaderSwitchesPerFrame = 0;

        this._primsPerFrame = [];
        for (let i = PRIMITIVE_POINTS; i <= PRIMITIVE_TRIFAN; i++) {
            this._primsPerFrame[i] = 0;
        }
        this._renderTargetCreationTime = 0;

        // Create the ScopeNamespace for shader attributes and variables
        this.scope = new ScopeSpace("Device");

        this.textureBias = this.scope.resolve("textureBias");
        this.textureBias.setValue(0.0);
    }

    /**
     * Function that executes after the device has been created.
     */
    postInit() {

        // create quad vertex buffer
        const vertexFormat = new VertexFormat(this, [
            { semantic: SEMANTIC_POSITION, components: 2, type: TYPE_FLOAT32 }
        ]);
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        this.quadVertexBuffer = new VertexBuffer(this, vertexFormat, 4, BUFFER_STATIC, positions);
    }

    /**
     * Fired when the canvas is resized.
     *
     * @event GraphicsDevice#resizecanvas
     * @param {number} width - The new width of the canvas in pixels.
     * @param {number} height - The new height of the canvas in pixels.
     */

    /**
     * Destroy the graphics device.
     */
    destroy() {
        // fire the destroy event.
        // textures and other device resources may destroy themselves in response.
        this.fire('destroy');

        this.quadVertexBuffer?.destroy();
        this.quadVertexBuffer = null;
    }

    onDestroyShader(shader) {
        this.fire('destroy:shader', shader);

        const idx = this.shaders.indexOf(shader);
        if (idx !== -1) {
            this.shaders.splice(idx, 1);
        }
    }

    // executes after the extended classes have executed their destroy function
    postDestroy() {
        this.scope = null;
        this.canvas = null;
    }

    // don't stringify GraphicsDevice to JSON by JSON.stringify
    toJSON(key) {
        return undefined;
    }

    initializeContextCaches() {
        this.indexBuffer = null;
        this.vertexBuffers = [];
        this.shader = null;
        this.renderTarget = null;
    }

    initializeRenderState() {

        this.blendState = new BlendState();

        // Cached viewport and scissor dimensions
        this.vx = this.vy = this.vw = this.vh = 0;
        this.sx = this.sy = this.sw = this.sh = 0;
    }

    /**
     * Sets the specified blend state.
     *
     * @param {BlendState} blendState - New blend state.
     */
    setBlendState(blendState) {
        Debug.assert(false);
    }

    /**
     * Sets the specified render target on the device. If null is passed as a parameter, the back
     * buffer becomes the current target for all rendering operations.
     *
     * @param {import('./render-target.js').RenderTarget} renderTarget - The render target to
     * activate.
     * @example
     * // Set a render target to receive all rendering output
     * device.setRenderTarget(renderTarget);
     *
     * // Set the back buffer to receive all rendering output
     * device.setRenderTarget(null);
     */
    setRenderTarget(renderTarget) {
        this.renderTarget = renderTarget;
    }

    /**
     * Sets the current index buffer on the graphics device. On subsequent calls to
     * {@link GraphicsDevice#draw}, the specified index buffer will be used to provide index data
     * for any indexed primitives.
     *
     * @param {import('./index-buffer.js').IndexBuffer} indexBuffer - The index buffer to assign to
     * the device.
     */
    setIndexBuffer(indexBuffer) {
        // Store the index buffer
        this.indexBuffer = indexBuffer;
    }

    /**
     * Sets the current vertex buffer on the graphics device. On subsequent calls to
     * {@link GraphicsDevice#draw}, the specified vertex buffer(s) will be used to provide vertex
     * data for any primitives.
     *
     * @param {import('./vertex-buffer.js').VertexBuffer} vertexBuffer - The vertex buffer to
     * assign to the device.
     */
    setVertexBuffer(vertexBuffer) {

        if (vertexBuffer) {
            this.vertexBuffers.push(vertexBuffer);
        }
    }

    /**
     * Queries the currently set render target on the device.
     *
     * @returns {import('./render-target.js').RenderTarget} The current render target.
     * @example
     * // Get the current render target
     * var renderTarget = device.getRenderTarget();
     */
    getRenderTarget() {
        return this.renderTarget;
    }

    /**
     * Initialize render target before it can be used.
     *
     * @param {import('./render-target.js').RenderTarget} target - The render target to be
     * initialized.
     * @ignore
     */
    initRenderTarget(target) {

        if (target.initialized) return;

        // #if _PROFILER
        const startTime = now();
        this.fire('fbo:create', {
            timestamp: startTime,
            target: this
        });
        // #endif

        target.init();
        this.targets.push(target);

        // #if _PROFILER
        this._renderTargetCreationTime += now() - startTime;
        // #endif
    }

    /**
     * Reports whether a texture source is a canvas, image, video or ImageBitmap.
     *
     * @param {*} texture - Texture source data.
     * @returns {boolean} True if the texture is a canvas, image, video or ImageBitmap and false
     * otherwise.
     * @ignore
     */
    _isBrowserInterface(texture) {
        return this._isImageBrowserInterface(texture) ||
                (typeof HTMLCanvasElement !== 'undefined' && texture instanceof HTMLCanvasElement) ||
                (typeof HTMLVideoElement !== 'undefined' && texture instanceof HTMLVideoElement);
    }

    _isImageBrowserInterface(texture) {
        return (typeof ImageBitmap !== 'undefined' && texture instanceof ImageBitmap) ||
               (typeof HTMLImageElement !== 'undefined' && texture instanceof HTMLImageElement);
    }

    /**
     * Sets the width and height of the canvas, then fires the `resizecanvas` event. Note that the
     * specified width and height values will be multiplied by the value of
     * {@link GraphicsDevice#maxPixelRatio} to give the final resultant width and height for the
     * canvas.
     *
     * @param {number} width - The new width of the canvas.
     * @param {number} height - The new height of the canvas.
     * @ignore
     */
    resizeCanvas(width, height) {
        this._width = width;
        this._height = height;

        const ratio = Math.min(this._maxPixelRatio, platform.browser ? window.devicePixelRatio : 1);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.fire(EVENT_RESIZE, width, height);
        }
    }

    /**
     * Sets the width and height of the canvas, then fires the `resizecanvas` event. Note that the
     * value of {@link GraphicsDevice#maxPixelRatio} is ignored.
     *
     * @param {number} width - The new width of the canvas.
     * @param {number} height - The new height of the canvas.
     * @ignore
     */
    setResolution(width, height) {
        this._width = width;
        this._height = height;
        this.canvas.width = width;
        this.canvas.height = height;
        this.fire(EVENT_RESIZE, width, height);
    }

    updateClientRect() {
        this.clientRect = this.canvas.getBoundingClientRect();
    }

    /**
     * Width of the back buffer in pixels.
     *
     * @type {number}
     */
    get width() {
        Debug.error("GraphicsDevice.width is not implemented on current device.");
        return this.canvas.width;
    }

    /**
     * Height of the back buffer in pixels.
     *
     * @type {number}
     */
    get height() {
        Debug.error("GraphicsDevice.height is not implemented on current device.");
        return this.canvas.height;
    }

    /**
     * Fullscreen mode.
     *
     * @type {boolean}
     */
    set fullscreen(fullscreen) {
        Debug.error("GraphicsDevice.fullscreen is not implemented on current device.");
    }

    get fullscreen() {
        Debug.error("GraphicsDevice.fullscreen is not implemented on current device.");
        return false;
    }

    /**
     * Maximum pixel ratio.
     *
     * @type {number}
     */
    set maxPixelRatio(ratio) {
        this._maxPixelRatio = ratio;
        this.resizeCanvas(this._width, this._height);
    }

    get maxPixelRatio() {
        return this._maxPixelRatio;
    }

    /**
     * Queries the maximum number of bones that can be referenced by a shader. The shader
     * generators (programlib) use this number to specify the matrix array size of the uniform
     * 'matrix_pose[0]'. The value is calculated based on the number of available uniform vectors
     * available after subtracting the number taken by a typical heavyweight shader. If a different
     * number is required, it can be tuned via {@link GraphicsDevice#setBoneLimit}.
     *
     * @returns {number} The maximum number of bones that can be supported by the host hardware.
     * @ignore
     */
    getBoneLimit() {
        return this.boneLimit;
    }

    /**
     * Specifies the maximum number of bones that the device can support on the current hardware.
     * This function allows the default calculated value based on available vector uniforms to be
     * overridden.
     *
     * @param {number} maxBones - The maximum number of bones supported by the host hardware.
     * @ignore
     */
    setBoneLimit(maxBones) {
        this.boneLimit = maxBones;
    }
}

export { GraphicsDevice };
