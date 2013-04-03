pc.extend(pc.gfx, function () {
    /**
     * @name pc.gfx.FrameBuffer
     * @class A frame buffer is a rectangular rendering surface. It can be rendered to via a pc.gfx.RenderTarget.
     * @description Creates a new FrameBuffer object.
     * @param {Number} width The width of the frame buffer in pixels.
     * @param {Number} height The height of the frame buffer in pixels.
     * @param {Boolean} depth True if the frame buffer is to include a depth buffer and false otherwise.
     * @param {Boolean} isCube True if the frame buffer is represented as a cube map and false if it is
     * represented as a 2D surface.
     */
    var FrameBuffer = function (width, height, depth, isCube) {
        if (typeof isCube === 'undefined') isCube = false;

        if ((width !== undefined) && (height !== undefined)) {
            var device = pc.gfx.Device.getCurrent();
            var gl = device.gl;

            this._width     = width  || 1;
            this._height    = height || 1;
            this._colorBuffers = [];
            if (depth && !device.extDepthTexture) {
                this._depthBuffers = [];
            }

            this._colorTexture = new pc.gfx.Texture({
                width: width, 
                height: height, 
                format: pc.gfx.PIXELFORMAT_R8_G8_B8_A8,
                cubemap: isCube
            });
            this._colorTexture.upload();
            if (depth && device.extDepthTexture) {
                this._depthTexture = new pc.gfx.Texture({
                    width: width, 
                    height: height, 
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
                    if (device.extDepthTexture) {
                        gl.framebufferTexture2D(gl.FRAMEBUFFER,
                                                gl.DEPTH_ATTACHMENT,
                                                isCube ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + i : gl.TEXTURE_2D,
                                                this._depthTexture._glTextureId, 
                                                0);
                    } else {
                        this._depthBuffers[i] = gl.createRenderbuffer();
                        gl.bindRenderbuffer(gl.RENDERBUFFER, this._depthBuffers[i]);
                        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this._width, this._height);
                        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
                        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this._depthBuffers[i]);
                    }
                }

                var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
                switch (status)
                {
                    case gl.FRAMEBUFFER_COMPLETE:
                        //logINFO("FrameBuffer status OK");
                        break;
                    case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                        logERROR("FrameBuffer error: FRAMEBUFFER_INCOMPLETE_ATTACHMENT");
                        break;
                    case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                        logERROR("FrameBuffer error: FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT");
                        break;
                    case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
                        logERROR("FrameBuffer error: FRAMEBUFFER_INCOMPLETE_DIMENSIONS");
                        break;
                    case gl.FRAMEBUFFER_UNSUPPORTED:
                        logERROR("FrameBuffer error: FRAMEBUFFER_UNSUPPORTED");
                        break;
                }
            }

            // Set current render target back to default frame buffer
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
    };

    /**
     * @function
     * @name pc.gfx.FrameBuffer.getBackBuffer
     * @description Returns a reference to the back buffer attached to the canvas from which the PlayCanvas graphics
     * device was created.
     * @returns {pc.gfx.FrameBuffer} A frame buffer instance representing the back buffer of the application's canvas.
     * @author Will Eastcott
     */
    FrameBuffer.getBackBuffer = function () {
        return new pc.gfx.FrameBuffer();
    };

    /**
     * @function
     * @name pc.gfx.FrameBuffer#bind
     * @description Activates the framebuffer to receive the rasterization of all subsequent draw commands issued by
     * the graphics device.
     * @author Will Eastcott
     */
    FrameBuffer.prototype.bind = function () {
        var gl = pc.gfx.Device.getCurrent().gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._colorBuffers ? this._colorBuffers[this._activeBuffer] : null);
    };

    /**
     * @function
     * @name pc.gfx.FrameBuffer#setActiveBuffer
     * @description Marks a specific buffer of a framebuffer as active. If the framebuffer is a cube map, this 
     * buffer index must be in the range 0 to 5 representing each face of the cube. If the framebuffer is the
     * back buffer or a 2D framebuffer, this function has no effect.
     * @param {Number} bufferIndex The index of the buffer to write to.
     * @author Will Eastcott
     */
    FrameBuffer.prototype.setActiveBuffer = function (bufferIndex) {
        this._activeBuffer = bufferIndex;
    };

    /**
     * @function
     * @name pc.gfx.FrameBuffer#getWidth
     * @description Returns the width of the specified frame buffer in pixels.
     * @returns {number} The width of the frame buffer in pixels.
     * @author Will Eastcott
     */
    FrameBuffer.prototype.getWidth = function () {
        var gl = pc.gfx.Device.getCurrent().gl;
        return (this._colorBuffers) ? this._width : gl.canvas.width;
    };

    /**
     * @function
     * @name pc.gfx.FrameBuffer#getHeight
     * @description Returns the height of the specified frame buffer in pixels.
     * @returns {number} The height of the frame buffer in pixels.
     * @author Will Eastcott
     */
    FrameBuffer.prototype.getHeight = function () {
        var gl = pc.gfx.Device.getCurrent().gl;
        return (this._colorBuffers) ? this._height : gl.canvas.height;
    };

    /**
     * @function
     * @name pc.gfx.FrameBuffer#getTexture
     * @description Returns a texture instance that corresponds to the image rasterized to the 
     * frame buffer itself. This can then be rasterized using geometric primitives into anther 
     * render target, thereby allowing for the implementation of frame buffer post-processing,
     * dynamic cube maps and other effects.
     * @returns {pc.gfx.Texture} A texture holding a copy of the frame buffer's contents.
     * @author Will Eastcott
     */
    FrameBuffer.prototype.getTexture = function () {
        return (this._colorBuffers) ? this._colorTexture : null;
    };

    return {
        FrameBuffer: FrameBuffer
    }; 
}());