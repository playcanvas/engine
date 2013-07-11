pc.extend(pc.gfx, function () {
    var defaultOptions = {
        depth: true,
        face: 0
    };

    /**
     * @name pc.gfx.RenderTarget
     * @class A render target is a rectangular rendering surface.
     * @constructor Creates a new render target.
     * @param {pc.gfx.Device} graphicsDevice The graphics device used to manage this frame buffer.
     * @param {pc.gfx.Texture} colorBuffer The texture that this render target will treat as a rendering surface.
     * @param {Object} options Object for passing optional arguments.
     * @param {Boolean} options.depth True if the render target is to include a depth buffer and false otherwise.
     * @param {Number} options.face True if the render target is to include a depth buffer and false otherwise.
     * @example
     * // Create a 512x512x24-bit render target with a depth buffer
     * var colorBuffer = new pc.gfx.Texture(graphicsDevice, {
     *     width: 512,
     *     height: 512,
     *     format: pc.gfx.PIXELFORMAT_R8_G8_B8
     * });
     * var renderTarget = new pc.gfx.RenderTarget(graphicsDevice, colorBuffer, {
     *     depth: true
     * });
     *
     * // Set the render target to be current
     * graphicsDevice.setRenderTarget(renderTarget);
     * @property {pc.gfx.Texture} colorBuffer Color buffer set up on the render target (read-only).
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
        options = (typeof options !== 'undefined') ? options : defaultOptions;
        this._face = (typeof options.face !== 'undefined') ? options.face : 0;
        this._depth = (typeof options.depth !== 'undefined') ? options.depth : true;

        var gl = this._device.gl;

        // Create a new WebGL frame buffer object
        this._frameBuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._frameBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,
                                gl.COLOR_ATTACHMENT0,
                                this._colorBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + this._face : gl.TEXTURE_2D,
                                this._colorBuffer._glTextureId,
                                0);
        if (this._depth) {
            this._depthBuffer = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, this._depthBuffer);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);
            gl.bindRenderbuffer(gl.RENDERBUFFER, null);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this._depthBuffer);
        }

        // Ensure all is well
        var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        switch (status)
        {
            case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                logERROR("RenderTarget error: FRAMEBUFFER_INCOMPLETE_ATTACHMENT");
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                logERROR("RenderTarget error: FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT");
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
                logERROR("RenderTarget error: FRAMEBUFFER_INCOMPLETE_DIMENSIONS");
                break;
            case gl.FRAMEBUFFER_UNSUPPORTED:
                logERROR("RenderTarget error: FRAMEBUFFER_UNSUPPORTED");
                break;
            case gl.FRAMEBUFFER_COMPLETE:
                break;
            default:
                break;
        }

        // Set current render target back to default frame buffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };

    RenderTarget.prototype = {
        /**
         * @function
         * @name pc.gfx.RenderTarget#bind
         * @description Activates the framebuffer to receive the rasterization of all subsequent draw commands issued by
         * the graphics device.
         * @author Will Eastcott
         */
        bind: function () {
            var gl = this._device.gl;
            gl.bindFramebuffer(gl.FRAMEBUFFER, this._frameBuffer);
        },

        /**
         * @function
         * @name pc.gfx.RenderTarget#destroy
         * @description Frees resources associated with this render target.
         * @author Will Eastcott
         */
        destroy: function () {
            var gl = this._device.gl;
            gl.deleteFramebuffer(this._frameBuffer);
            if (this._depthBuffer) {
                gl.deleteRenderbuffer(this._depthBuffer);
            }
        },

        /**
         * @function
         * @name pc.gfx.RenderTarget#unbind
         * @description Deactivates the specified render target, restoring the device's main rendering buffer as the
         * active render target.
         * @author Will Eastcott
         */
        unbind: function () {
            var gl = this._device.gl;
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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