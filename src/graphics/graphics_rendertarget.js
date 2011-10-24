pc.extend(pc.gfx, function () {
    /**
     * @name pc.gfx.RenderTarget
     * @class A frame buffer is a rectangular rendering surface. It can be rendered to via a pc.gfx.RenderTarget.
     * @param {number} width The width of the frame buffer in pixels.
     * @param {number} height The height of the frame buffer in pixels.
     * @param {boolean} depth True if the frame buffer is to include a depth buffer and false otherwise.
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
     * @description 
     * @param {Object} viewport
     * @author Will Eastcott
     */
    RenderTarget.prototype.setViewport = function (viewport) {
        this._viewport = viewport;
    };

    /**
     * @function
     * @name pc.gfx.RenderTarget#getViewport
     * @description 
     * @returns {Object}
     * @author Will Eastcott
     */
    RenderTarget.prototype.getViewport = function () {
        return this._viewport;
    };

    /**
     * @function
     * @name pc.gfx.RenderTarget#setFrameBuffer
     * @description 
     * @param {pc.gfx.RenderTarget} framebuffer
     * @author Will Eastcott
     */
    RenderTarget.prototype.setFrameBuffer = function (framebuffer) {
        this._framebuffer = framebuffer;
    };

    /**
     * @function
     * @name pc.gfx.RenderTarget#getFrameBuffer
     * @description 
     * @returns {pc.gfx.RenderTarget}
     * @author Will Eastcott
     */
    RenderTarget.prototype.getFrameBuffer = function () {
        return this._framebuffer;
    };

    /**
     * @function
     * @name pc.gfx.RenderTarget#bind
     * @description 
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