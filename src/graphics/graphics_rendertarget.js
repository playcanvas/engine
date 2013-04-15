pc.extend(pc.gfx, function () {
    /**
     * @name pc.gfx.RenderTarget
     * @class A render target is a viewport onto a frame buffer.
     * @constructor Creates a new render target. A render target is a viewport onto a frame
     * buffer. If no viewport is specified, it is assumed that the entire frame buffer is 
     * rendered to.
     * @param {pc.gfx.FrameBuffer} frameBuffer The frame buffer bound to this render target.
     * @param {Object} viewport (Optional) The viewport to set with the following members:
     * @param {Number} viewport.x The top left corner x coordinate in pixel space.
     * @param {Number} viewport.y The top left corner y coordinate in pixel space.
     * @param {Number} viewport.width The viewport width in pixels.
     * @param {Number} viewport.height The viewport height in pixels.
     */
    var RenderTarget = function (frameBuffer, viewport) {
        this._frameBuffer = frameBuffer;
        if (viewport) {
            this._viewport = viewport;
        }
        this._defaultViewport = {
            x: 0,
            y: 0,
            width: 0,
            height: 0
        };
    };

    RenderTarget.prototype = {
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
        setViewport: function (viewport) {
            this._viewport = viewport;
        },

        /**
         * @function
         * @name pc.gfx.RenderTarget#getViewport
         * @description Returns the viewport used by the specified render target.
         * @returns {Object} The viewport for the specified render target.
         * @author Will Eastcott
         */
        getViewport: function () {
            if (this._viewport) {
                return this._viewport;
            } else {
                this._defaultViewport.width = this._frameBuffer.getWidth();
                this._defaultViewport.height = this._frameBuffer.getHeight();
                return this._defaultViewport;
            }
        },

        /**
         * @function
         * @name pc.gfx.RenderTarget#setFrameBuffer
         * @description Assigns a frame buffer to the render target. The frame buffer will
         * receive the results of all rendering output sent to this render target according
         * to the viewport.
         * @param {pc.gfx.FrameBuffer} frameBuffer The frame buffer to set on the specified render
         * target.
         * @author Will Eastcott
         */
        setFrameBuffer: function (frameBuffer) {
            this._frameBuffer = frameBuffer;
        },

        /**
         * @function
         * @name pc.gfx.RenderTarget#getFrameBuffer
         * @description Returns the frame buffer assigned to the specified render target.
         * @returns {pc.gfx.FrameBuffer} The frame buffer assigned to the render target.
         * @author Will Eastcott
         */
        getFrameBuffer: function () {
            return this._frameBuffer;
        },

        /**
         * @function
         * @name pc.gfx.RenderTarget#bind
         * @description Activates the specified render target to receive all subsequent rendering
         * output. All rendering will be clipped to the viewport of the render target and rendered
         * to the render target's frame buffer.
         * @author Will Eastcott
         */
        bind: function () {
            var gl = pc.gfx.Device.getCurrent().gl;
            // Make the render target's frame buffer the current recipient of any rasterization.
            this._frameBuffer.bind();

            // Restrict rendering to the viewport of the rendering target.
            var vp = this.getViewport();
            gl.viewport(vp.x, vp.y, vp.width, vp.height);
            gl.scissor(vp.x, vp.y, vp.width, vp.height);
        }
    };

    return {
        RenderTarget: RenderTarget
    }; 
}());