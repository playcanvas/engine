Object.assign(pc, function () {
    'use strict';

    var defaultOptions = {
        depth: true,
        face: 0
    };

    /**
     * @constructor
     * @name pc.RenderTarget
     * @classdesc A render target is a rectangular rendering surface.
     * @description Creates a new render target. A color buffer or a depth buffer must be set.
     * @param {Object} options Object for passing optional arguments.
     * @param {pc.Texture} [options.colorBuffer] The texture that this render target will treat as a rendering surface.
     * @param {Boolean} [options.depth] If set to true, depth buffer will be created. Defaults to true. Ignored if depthBuffer is defined.
     * @param {Boolean} [options.stencil] If set to true, depth buffer will include stencil. Defaults to false. Ignored if depthBuffer is defined or depth is false.
     * @param {pc.Texture} [options.depthBuffer] The texture that this render target will treat as a depth/stencil surface (WebGL2 only). If set, the 'depth' and 'stencil' properties are ignored.
     * Texture must have pc.PIXELFORMAT_DEPTH or PIXELFORMAT_DEPTHSTENCIL format.
     * @param {Number} [options.samples] Number of hardware anti-aliasing samples (WebGL2 only). Default is 1.
     * @param {Boolean} [options.autoResolve] If samples > 1, enables or disables automatic MSAA resolve after rendering to this RT (see pc.RenderTarget#resolve). Defaults to true;
     * Defaults to true.
     * @param {Number} [options.face] If the colorBuffer parameter is a cubemap, use this option to specify the
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
     * var renderTarget = new pc.RenderTarget({
     *     colorBuffer: colorBuffer,
     *     depth: true
     * });
     *
     * // Set the render target on a layer
     * layer.renderTarget = renderTarget;
     */
    var RenderTarget = function (options) {
        var _arg2 = arguments[1];
        var _arg3 = arguments[2];

        if (options instanceof pc.GraphicsDevice) {
            // old constructor
            this._colorBuffer = _arg2;
            options = _arg3;
        } else {
            // new constructor
            this._colorBuffer = options.colorBuffer;
        }

        this._glFrameBuffer = null;
        this._glDepthBuffer = null;

        // Process optional arguments
        options = (options !== undefined) ? options : defaultOptions;
        this._depthBuffer = options.depthBuffer;
        this._face = (options.face !== undefined) ? options.face : 0;

        if (this._depthBuffer) {
            var format = this._depthBuffer._format;
            if (format === pc.PIXELFORMAT_DEPTH) {
                this._depth = true;
                this._stencil = false;
            } else if (format === pc.PIXELFORMAT_DEPTHSTENCIL) {
                this._depth = true;
                this._stencil = true;
            } else {
                // #ifdef DEBUG
                console.warn('Incorrect depthBuffer format. Must be pc.PIXELFORMAT_DEPTH or pc.PIXELFORMAT_DEPTHSTENCIL');
                // #endif
                this._depth = false;
                this._stencil = false;
            }
        } else {
            this._depth = (options.depth !== undefined) ? options.depth : true;
            this._stencil = (options.stencil !== undefined) ? options.stencil : false;
        }

        this._samples = (options.samples !== undefined) ? options.samples : 1;
        this.autoResolve = (options.autoResolve !== undefined) ? options.autoResolve : true;
        this._glResolveFrameBuffer = null;
        this._glMsaaColorBuffer = null;
        this._glMsaaDepthBuffer = null;
    };

    Object.assign(RenderTarget.prototype, {
        /**
         * @function
         * @name pc.RenderTarget#destroy
         * @description Frees resources associated with this render target.
         */
        destroy: function () {
            if (!this._device) return;

            var device = this._device;
            var idx = device.targets.indexOf(this);
            if (idx !== -1) {
                device.targets.splice(idx, 1);
            }

            var gl = device.gl;
            if (this._glFrameBuffer) {
                gl.deleteFramebuffer(this._glFrameBuffer);
                this._glFrameBuffer = null;
            }

            if (this._glDepthBuffer) {
                gl.deleteRenderbuffer(this._glDepthBuffer);
                this._glDepthBuffer = null;
            }

            if (this._glResolveFrameBuffer) {
                gl.deleteFramebuffer(this._glResolveFrameBuffer);
                this._glResolveFrameBuffer = null;
            }

            if (this._glMsaaColorBuffer) {
                gl.deleteRenderbuffer(this._glMsaaColorBuffer);
                this._glMsaaColorBuffer = null;
            }

            if (this._glMsaaDepthBuffer) {
                gl.deleteRenderbuffer(this._glMsaaDepthBuffer);
                this._glMsaaDepthBuffer = null;
            }
        },

        /**
         * @function
         * @name pc.RenderTarget#resolve
         * @description If samples > 1, resolves the anti-aliased render target (WebGL2 only).
         * When you're rendering to an anti-aliased render target, pixels aren't written directly to the readable texture.
         * Instead, they're first written to a MSAA buffer, where each sample for each pixel is stored independently.
         * In order to read the results, you first need to 'resolve' the buffer - to average all samples and create a simple texture with one color per pixel.
         * This function performs this averaging and updates the colorBuffer and the depthBuffer.
         * If autoResolve is set to true, the resolve will happen after every rendering to this render target, otherwise you can do it manually,
         * during the app update or inside a pc.Command.
         * @param {Boolean} color Resolve color buffer
         * @param {Boolean} depth Resolve depth buffer
         */
        resolve: function (color, depth) {
            if (!this._device) return;
            if (!this._device.webgl2) return;
            var gl = this._device.gl;

            if (color === undefined) color = true;
            if (depth === undefined && this._depthBuffer) depth = true;

            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this._glFrameBuffer);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._glResolveFrameBuffer);
            gl.blitFramebuffer( 0, 0, this.width, this.height,
                                0, 0, this.width, this.height,
                                (color ? gl.COLOR_BUFFER_BIT : 0) | (depth ? gl.DEPTH_BUFFER_BIT : 0),
                                gl.NEAREST);

            gl.bindFramebuffer(gl.FRAMEBUFFER, this._glFrameBuffer);
        },

        /**
         * @function
         * @name pc.RenderTarget#copy
         * @description Copies color and/or depth contents of source render target to this one. Formats, sizes and anti-aliasing samples must match.
         * Depth buffer can only be copied on WebGL 2.0.
         * @param {pc.RenderTarget} source Source render target to copy from
         * @param {Boolean} color Copy color buffer
         * @param {Boolean} depth Copy depth buffer
         * @returns {Boolean} true if the copy was successfull, false otherwise.
         */
        copy: function (source, color, depth) {
            if (!this._device) {
                if (source._device) {
                    this._device = source._device;
                } else {
                    // #ifdef DEBUG
                    console.error("Render targets are not initialized");
                    // #endif
                    return false;
                }
            }
            return this._device.copyRenderTarget(source, this, color, depth);
        }
    });

    /**
     * @readonly
     * @name pc.RenderTarget#colorBuffer
     * @type pc.Texture
     * @description Color buffer set up on the render target.
     */
    Object.defineProperty(RenderTarget.prototype, 'colorBuffer', {
        get: function () {
            return this._colorBuffer;
        }
    });

    /**
     * @readonly
     * @name pc.RenderTarget#depthBuffer
     * @type pc.Texture
     * @description Depth buffer set up on the render target. Only available, if depthBuffer was set in constructor.
     * Not available, if depth property was used instead.
     */
    Object.defineProperty(RenderTarget.prototype, 'depthBuffer', {
        get: function () {
            return this._depthBuffer;
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
        get: function () {
            return this._face;
        }
    });

    /**
     * @readonly
     * @name pc.RenderTarget#width
     * @type Number
     * @description Width of the render target in pixels.
     */
    Object.defineProperty(RenderTarget.prototype, 'width', {
        get: function () {
            return this._colorBuffer ? this._colorBuffer.width : this._depthBuffer.width;
        }
    });

    /**
     * @readonly
     * @name pc.RenderTarget#height
     * @type Number
     * @description Height of the render target in pixels.
     */
    Object.defineProperty(RenderTarget.prototype, 'height', {
        get: function () {
            return this._colorBuffer ? this._colorBuffer.height : this._depthBuffer.height;
        }
    });

    return {
        RenderTarget: RenderTarget
    };
}());
