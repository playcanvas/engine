pc.extend(pc, function () {
    'use strict';

    var defaultOptions = {
        depth: true,
        face: 0
    };

    /**
     * @name pc.RenderTarget
     * @class A render target is a rectangular rendering surface.
     * @description Creates a new render target.
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device used to manage this frame buffer.
     * @param {pc.Texture} colorBuffer The texture that this render target will treat as a rendering surface.
     * @param {Object} options Object for passing optional arguments.
     * @param {Boolean} options.depth True if the render target is to include a depth buffer and false otherwise (default is true).
     * @param {Boolean} options.stencil True if the render target is to include a stencil buffer and false otherwise (default is false). Requires depth buffer.
     * Defaults to true.
     * @param {Number} options.face If the colorBuffer parameter is a cubemap, use this option to specify the
     * face of the cubemap to render to. Can be:
     * <ul>
     *     <li>pc.CUBEFACE_POSX</li>
     *     <li>pc.CUBEFACE_NEGX</li>
     *     <li>pc.CUBEFACE_POSY</li>
     *     <li>pc.CUBEFACE_NEGY</li>
     *     <li>pc.CUBEFACE_POSZ</li>
     *     <li>pc.CUBEFACE_NEGZ</li>
     * </ul>
     * Defaults to pc.CUBEFACE_POSX.
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
     * // Set the render target on an entity's camera component
     * entity.camera.renderTarget = renderTarget;
     */
    var RenderTarget = function (graphicsDevice, colorBuffer, options) {
        this._device = graphicsDevice;
        this._colorBuffer = colorBuffer;
        this._glFrameBuffer = null;
        this._glDepthBuffer = null;

        // Process optional arguments
        options = (options !== undefined) ? options : defaultOptions;
        this._face = (options.face !== undefined) ? options.face : 0;
        this._depth = (options.depth !== undefined) ? options.depth : true;
        this._stencil = (options.stencil !== undefined) ? options.stencil : false;
    };

    RenderTarget.prototype = {
        /**
         * @function
         * @name pc.RenderTarget#destroy
         * @description Frees resources associated with this render target.
         */
        destroy: function () {
            var gl = this._device.gl;

            if (this._glFrameBuffer) {
                gl.deleteFramebuffer(this._glFrameBuffer);
                this._glFrameBuffer = null;
            }

            if (this._glDepthBuffer) {
                gl.deleteRenderbuffer(this._glDepthBuffer);
                this._glDepthBuffer = null;
            }
        }
    };

    /**
     * @readonly
     * @name pc.RenderTarget#colorBuffer
     * @type pc.Texture
     * @description Color buffer set up on the render target.
     */
    Object.defineProperty(RenderTarget.prototype, 'colorBuffer', {
        get: function() {
            return this._colorBuffer;
        }
    });

    /**
     * @readonly
     * @name pc.RenderTarget#face
     * @type Number
     * @description If the render target is bound to a cubemap, this property
     * specifies which face of the cubemap is rendered to. Can be:
     * <ul>
     *     <li>pc.CUBEFACE_POSX</li>
     *     <li>pc.CUBEFACE_NEGX</li>
     *     <li>pc.CUBEFACE_POSY</li>
     *     <li>pc.CUBEFACE_NEGY</li>
     *     <li>pc.CUBEFACE_POSZ</li>
     *     <li>pc.CUBEFACE_NEGZ</li>
     * </ul>
     */
    Object.defineProperty(RenderTarget.prototype, 'face', {
        get: function() {
            return this._face;
        },
    });

    /**
     * @readonly
     * @name pc.RenderTarget#width
     * @type Number
     * @description Width of the render target in pixels.
     */
    Object.defineProperty(RenderTarget.prototype, 'width', {
        get: function() {
            return this._colorBuffer.width;
        }
    });

    /**
     * @readonly
     * @name pc.RenderTarget#height
     * @type Number
     * @description Height of the render target in pixels.
     */
    Object.defineProperty(RenderTarget.prototype, 'height', {
        get: function() {
            return this._colorBuffer.height;
        }
    });

    return {
        RenderTarget: RenderTarget
    };
}());
