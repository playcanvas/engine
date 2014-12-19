pc.extend(pc, function () {
    'use strict';

    var defaultOptions = {
        depth: true,
        face: 0
    };

    /**
     * @name pc.RenderTarget
     * @class A render target is a rectangular rendering surface.
     * @constructor Creates a new render target.
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device used to manage this frame buffer.
     * @param {pc.Texture} colorBuffer The texture that this render target will treat as a rendering surface.
     * @param {Object} options Object for passing optional arguments.
     * @param {Boolean} options.depth True if the render target is to include a depth buffer and false otherwise.
     * @param {Number} options.face True if the render target is to include a depth buffer and false otherwise.
     * @example
     * // Create a 512x512x24-bit render target with a depth buffer
     * var colorBuffer = new pc.Texture(graphicsDevice, {
     *     width: 512,
     *     height: 512,
     *     format: pc.PIXELFORMAT_R8_G8_B8
     * });
     * var renderTarget = new pc.RenderTarget(graphicsDevice, colorBuffer, {
     *     depth: true
     * });
     *
     * // Set the render target to be current
     * graphicsDevice.setRenderTarget(renderTarget);
     * @property {pc.Texture} colorBuffer Color buffer set up on the render target (read-only).
     * @property {Number} face If the render target is bound to a cubemap, face stores the face index
     * that the render target renders to. Face indices are 0 (pos X), 1 (neg X), 2 (pos y), 3 (neg Y),
     * 4 (pos Z) and 5 (neg Z) (read-only).
     * @property {Number} width Width of the render target in pixels (read-only).
     * @property {Number} height Height of the render target in pixels (read-only).
     */
    var RenderTarget = function (graphicsDevice, colorBuffer, options) {
        this._device = graphicsDevice;
        this._colorBuffer = colorBuffer;

        // Process optional arguments
        options = (options !== undefined) ? options : defaultOptions;
        this._face = (options.face !== undefined) ? options.face : 0;
        this._depth = (options.depth !== undefined) ? options.depth : true;
    };

    RenderTarget.prototype = {
        /**
         * @private
         * @function
         * @name pc.RenderTarget#bind
         * @description Activates the framebuffer to receive the rasterization of all subsequent draw commands issued by
         * the graphics device.
         */
        bind: function () {
        },

        /**
         * @function
         * @name pc.RenderTarget#destroy
         * @description Frees resources associated with this render target.
         */
        destroy: function () {
            var gl = this._device.gl;
            gl.deleteFramebuffer(this._frameBuffer);
            if (this._depthBuffer) {
                gl.deleteRenderbuffer(this._depthBuffer);
            }
        },

        /**
         * @private
         * @function
         * @name pc.RenderTarget#unbind
         * @description Deactivates the specified render target, restoring the device's main rendering buffer as the
         * active render target.
         */
        unbind: function () {
        }
    };

    Object.defineProperty(RenderTarget.prototype, 'colorBuffer', {
        get: function() { return this._colorBuffer; }
    });

    Object.defineProperty(RenderTarget.prototype, 'face', {
        get: function() { return this._face; },
    });

    Object.defineProperty(RenderTarget.prototype, 'width', {
        get: function() { return this._colorBuffer.width; }
    });

    Object.defineProperty(RenderTarget.prototype, 'height', {
        get: function() { return this._colorBuffer.height; }
    });

    return {
        RenderTarget: RenderTarget
    }; 
}());