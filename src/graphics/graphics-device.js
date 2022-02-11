import { EventHandler } from '../core/event-handler.js';
import { platform } from '../core/platform.js';

import { ScopeSpace } from './scope-space.js';
import { programlib } from './program-lib/program-lib.js';
import { ProgramLibrary } from './program-library.js';

import {
    PRIMITIVE_POINTS, PRIMITIVE_TRIFAN
} from './constants.js';
import { Debug } from '../core/debug.js';

const EVENT_RESIZE = 'resizecanvas';

/** @typedef {import('./render-target.js').RenderTarget} RenderTarget */

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
     * The scope namespace for shader attributes and variables.
     *
     * @type {ScopeSpace}
     */
    scope;

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
     * True if hardware instancing is supported.
     *
     * @type {boolean}
     */
    supportsInstancing;

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

    constructor(canvas) {
        super();

        this.canvas = canvas;

        // local width/height without pixelRatio applied
        this._width = 0;
        this._height = 0;

        this._maxPixelRatio = 1;

        // Array of WebGL objects that need to be re-initialized after a context restore event
        this.shaders = [];
        this.buffers = [];
        this.textures = [];
        this.targets = [];

        this._vram = {
            // #if _PROFILER
            texShadow: 0,
            texAsset: 0,
            texLightmap: 0,
            // #endif
            tex: 0,
            vb: 0,
            ib: 0
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

        this.programLib = new ProgramLibrary(this);
        for (const generator in programlib)
            this.programLib.register(generator, programlib[generator]);
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

    /**
     * Retrieves the program library assigned to the specified graphics device.
     *
     * @returns {ProgramLibrary} The program library assigned to the device.
     * @ignore
     */
    getProgramLibrary() {
        return this.programLib;
    }

    /**
     * Assigns a program library to the specified device. By default, a graphics device is created
     * with a program library that manages all of the programs that are used to render any
     * graphical primitives. However, this function allows the user to replace the existing program
     * library with a new one.
     *
     * @param {ProgramLibrary} programLib - The program library to assign to the device.
     * @ignore
     */
    setProgramLibrary(programLib) {
        this.programLib = programLib;
    }

    /**
     * Sets the specified render target on the device. If null is passed as a parameter, the back
     * buffer becomes the current target for all rendering operations.
     *
     * @param {RenderTarget} renderTarget - The render target to activate.
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
     * Queries the currently set render target on the device.
     *
     * @returns {RenderTarget} The current render target.
     * @example
     * // Get the current render target
     * var renderTarget = device.getRenderTarget();
     */
    getRenderTarget() {
        return this.renderTarget;
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
        Debug.assert("GraphicsDevice.width is not implemented on current device.");
        return this.canvas.width;
    }

    /**
     * Height of the back buffer in pixels.
     *
     * @type {number}
     */
    get height() {
        Debug.assert("GraphicsDevice.height is not implemented on current device.");
        return this.canvas.height;
    }

    /**
     * Fullscreen mode.
     *
     * @type {boolean}
     */
    set fullscreen(fullscreen) {
        Debug.assert("GraphicsDevice.fullscreen is not implemented on current device.");
    }

    get fullscreen() {
        Debug.assert("GraphicsDevice.fullscreen is not implemented on current device.");
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
}

export { GraphicsDevice };
