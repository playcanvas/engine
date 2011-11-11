pc.extend(pc.gfx, function () {
    /**
     * @name pc.gfx.RenderTarget
     * @class A render target is a viewport onto a frame buffer.
     * @param {pc.gfx.FrameBuffer} width The width of the frame buffer in pixels.
     * @param {Object} viewport The viewport to set with the following members:
     * @param {Number} viewport.x The top left corner x coordinate in pixel space.
     * @param {Number} viewport.y The top left corner y coordinate in pixel space.
     * @param {Number} viewport.width The viewport width in pixels.
     * @param {Number} viewport.height The viewport height in pixels.
     */
    var RenderTarget = function (framebuffer, viewport) {
        this._framebuffer = framebuffer || pc.gfx.FrameBuffer.getBackBuffer();
        this._viewport = viewport ||
            {
                x: 0,
                y: 0,
                width: this._framebuffer.getWidth(),
                height: this._framebuffer.getHeight()
            };
    };

    /**
     * @function
     * @name pc.gfx.RenderTarget#setViewport
     * @description Sets the viewport on the render target's frame buffer. The viewport is a
     * rectangular region specified by a top left corner coordinate and a width and height.
     * @param {Object} viewport The viewport to set with the following members:
     * @param {Number} viewport.x The top left corner x coordinate in pixel space.
     * @param {Number} viewport.y The top left corner y coordinate in pixel space.
     * @param {Number} viewport.width The viewport width in pixels.
     * @param {Number} viewport.height The viewport height in pixels.
     * @author Will Eastcott
     */
    RenderTarget.prototype.setViewport = function (viewport) {
        this._viewport = viewport;
    };

    /**
     * @function
     * @name pc.gfx.RenderTarget#getViewport
     * @description Returns the viewport used by the specified render target.
     * @returns {Object} The viewport for the specified render target.
     * @author Will Eastcott
     */
    RenderTarget.prototype.getViewport = function () {
        return this._viewport;
    };

    /**
     * @function
     * @name pc.gfx.RenderTarget#setFrameBuffer
     * @description Assigns a frame buffer to the render target. The frame buffer will
     * receive the results of all rendering output sent to this render target according
     * to the viewport.
     * @param {pc.gfx.RenderTarget} framebuffer The frame buffer to set on the specified render
     * target.
     * @author Will Eastcott
     */
    RenderTarget.prototype.setFrameBuffer = function (framebuffer) {
        this._framebuffer = framebuffer;
    };

    /**
     * @function
     * @name pc.gfx.RenderTarget#getFrameBuffer
     * @description Returns the frame buffer assigned to the specified render target.
     * @returns {pc.gfx.FrameBuffer} The frame buffer assigned to the render target.
     * @author Will Eastcott
     */
    RenderTarget.prototype.getFrameBuffer = function () {
        return this._framebuffer;
    };

    /**
     * @function
     * @name pc.gfx.RenderTarget#bind
     * @description Activates the specified render target to receive all subsequent rendering
     * output. All rendering will be clipped to the viewport of the render target and rendered
     * to the render target's frame buffer.
     * @author Will Eastcott
     */
    RenderTarget.prototype.bind = function () {
        var gl = pc.gfx.Device.getCurrent().gl;
        gl.viewport(this._viewport.x, this._viewport.y, this._viewport.width, this._viewport.height);
        gl.scissor(this._viewport.x, this._viewport.y, this._viewport.width, this._viewport.height);
        this._framebuffer.bind();
    };

    return {
        RenderTarget: RenderTarget
    }; 
}());