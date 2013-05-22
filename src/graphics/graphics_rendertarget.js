pc.extend(pc.gfx, function () {
    /**
     * @name pc.gfx.RenderTarget
     * @class A render target is a rectangular rendering surface.
     * @description Creates a new RenderTarget object.
     * @param {pc.gfx.Device} graphicsDevice The graphics device used to manage this frame buffer.
     * @param {pc.gfx.Texture} colorBuffer The texture surface to be rasterized to.
     * @param {Boolean} depth True if the render target is to include a depth buffer and false otherwise.
     * represented as a 2D surface.
     * @property {Number} width Width of the render target in pixels (read-only).
     * @property {Number} height Height of the render target in pixels (read-only).
     */
    var RenderTarget = function (graphicsDevice, colorBuffer, depth) {
        this.device = graphicsDevice;

        var isCube = colorBuffer._cubemap;

        var gl = this.device.gl;

        this._colorBuffers = [];
        if (depth && !this.device.extDepthTexture) {
            this._depthBuffers = [];
        }

        this._colorTexture = colorBuffer;
        this._colorTexture.upload();
        if (depth && this.device.extDepthTexture) {
            this._depthTexture = new pc.gfx.Texture(this.device, {
                width: colorBuffer.getWidth(),
                height: colorBuffer.getHeight(),
                format: pc.gfx.PIXELFORMAT_D16,
                cubemap: isCube
            });
            this._depthTexture.upload();
        }

        var numBuffers = isCube ? 6 : 1;
        this._activeBuffer = 0;

        for (var i = 0; i < numBuffers; i++) {
            // Create a new WebGL frame buffer object
            this._colorBuffers[i] = gl.createFramebuffer();

            // Attach the specified texture to the frame buffer
            gl.bindFramebuffer(gl.FRAMEBUFFER, this._colorBuffers[i]);
            gl.framebufferTexture2D(gl.FRAMEBUFFER,
                                    gl.COLOR_ATTACHMENT0,
                                    isCube ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + i : gl.TEXTURE_2D,
                                    this._colorTexture._glTextureId,
                                    0);
            if (depth) {
                if (this.device.extDepthTexture) {
                    gl.framebufferTexture2D(gl.FRAMEBUFFER,
                                            gl.DEPTH_ATTACHMENT,
                                            isCube ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + i : gl.TEXTURE_2D,
                                            this._depthTexture._glTextureId, 
                                            0);
                } else {
                    this._depthBuffers[i] = gl.createRenderbuffer();
                    gl.bindRenderbuffer(gl.RENDERBUFFER, this._depthBuffers[i]);
                    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);
                    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
                    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this._depthBuffers[i]);
                }
            }

            var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            switch (status)
            {
                case gl.FRAMEBUFFER_COMPLETE:
                    //logINFO("RenderTarget status OK");
                    break;
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
            }
        }

        // Set current render target back to default frame buffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };

    /**
     * @function
     * @name pc.gfx.RenderTarget#bind
     * @description Activates the framebuffer to receive the rasterization of all subsequent draw commands issued by
     * the graphics device.
     * @author Will Eastcott
     */
    RenderTarget.prototype.bind = function () {
        var gl = this.device.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._colorBuffers[this._activeBuffer]);
    };

    /**
     * @function
     * @name pc.gfx.RenderTarget#unbind
     * @description Deactivates the specified render target, restoring the device's main rendering buffer as the
     * active render target.
     * @author Will Eastcott
     */
    RenderTarget.prototype.unbind = function () {
        var gl = this.device.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };

    /**
     * @function
     * @name pc.gfx.RenderTarget#setActiveBuffer
     * @description Marks a specific buffer of a framebuffer as active. If the framebuffer is a cube map, this 
     * buffer index must be in the range 0 to 5 representing each face of the cube. If the framebuffer is the
     * back buffer or a 2D framebuffer, this function has no effect.
     * @param {Number} bufferIndex The index of the buffer to write to.
     * @author Will Eastcott
     */
    RenderTarget.prototype.setActiveBuffer = function (bufferIndex) {
        this._activeBuffer = bufferIndex;
    };

    /**
     * @function
     * @name pc.gfx.RenderTarget#getTexture
     * @description Returns a texture instance that corresponds to the image rasterized to the 
     * frame buffer itself. This can then be rasterized using geometric primitives into anther 
     * render target, thereby allowing for the implementation of frame buffer post-processing,
     * dynamic cube maps and other effects.
     * @returns {pc.gfx.Texture} A texture holding a copy of the frame buffer's contents.
     * @author Will Eastcott
     */
    RenderTarget.prototype.getTexture = function () {
        return (this._colorBuffers) ? this._colorTexture : null;
    };

    Object.defineProperty(RenderTarget.prototype, 'width', {
        get: function() { return this._colorTexture.width; }
    });

    Object.defineProperty(RenderTarget.prototype, 'height', {
        get: function() { return this._colorTexture.height; }
    });

    return {
        RenderTarget: RenderTarget
    }; 
}());