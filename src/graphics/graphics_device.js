pc.extend(pc, function () {
    'use strict';

    var EVENT_RESIZE = 'resizecanvas';

    // Exceptions
    function UnsupportedBrowserError(message) {
        this.name = "UnsupportedBrowserError";
        this.message = (message || "");
    }
    UnsupportedBrowserError.prototype = Error.prototype;

    function ContextCreationError(message) {
        this.name = "ContextCreationError";
        this.message = (message || "");
    }
    ContextCreationError.prototype = Error.prototype;

    var _contextLostHandler = function () {
        logWARNING("Context lost.");
    };

    var _contextRestoredHandler = function () {
        logINFO("Context restored.");
    };

    var _createContext = function (canvas, options) {
        var names = ["webgl", "experimental-webgl"];
        var context = null;
        for (var i = 0; i < names.length; i++) {
            try {
                context = canvas.getContext(names[i], options);
            } catch(e) {}
            if (context) {
                break;
            }
        }
        return context;
    };

    var _downsampleImage = function (image, size) {
        var srcW = image.width;
        var srcH = image.height;

        if ((srcW > size) || (srcH > size)) {
            var scale = size / Math.max(srcW, srcH);
            var dstW = Math.floor(srcW * scale);
            var dstH = Math.floor(srcH * scale);

            console.warn('Image dimensions larger than max supported texture size of ' + size + '. ' +
                         'Resizing from ' + srcW + ', ' + srcH + ' to ' + dstW + ', ' + dstH + '.');

            var canvas = document.createElement('canvas');
            canvas.width = dstW;
            canvas.height = dstH;

            var context = canvas.getContext('2d');
            context.drawImage(image, 0, 0, srcW, srcH, 0, 0, dstW, dstH);

            return canvas;
        }

        return image;
    };

    function _isIE() {
        var ua = window.navigator.userAgent;
        var msie = ua.indexOf("MSIE ");
        var trident = navigator.userAgent.match(/Trident.*rv\:11\./);

        return (msie > 0 || !!trident);
    };

    /**
     * @name pc.GraphicsDevice
     * @class The graphics device manages the underlying graphics context. It is responsible
     * for submitting render state changes and graphics primitives to the hardware. A graphics
     * device is tied to a specific canvas HTML element. It is valid to have more than one
     * canvas element per page and create a new graphics device against each.
     * @constructor Creates a new graphics device.
     * @param {Object} canvas The canvas to which the graphics device is tied.
     * @property {Number} width Width of the back buffer in pixels (read-only).
     * @property {Number} height Height of the back buffer in pixels (read-only).
     * @property {Number} maxAnisotropy The maximum supported texture anisotropy setting (read-only).
     * @property {Number} maxCubeMapSize The maximum supported dimension of a cube map (read-only).
     * @property {Number} maxTextureSize The maximum supported dimension of a texture (read-only).
     * is attached is fullscreen or not.
     */

     /**
     * @event
     * @name pc.GraphicsDevice#resizecanvas
     * @description The 'resizecanvas' event is fired when the canvas is resized
     * @param {Number} width The new width of the canvas in pixels
     * @param {Number} height The new height of the canvas in pixels
    */
    var GraphicsDevice = function (canvas) {
        this.gl = undefined;
        this.canvas = canvas;
        this.shader = null;
        this.indexBuffer = null;
        this.vertexBuffers = [];
        this.precision = "highp";
        this.enableAutoInstancing = false;
        this.autoInstancingMaxObjects = 16384;
        this.attributesInvalidated = true;
        this.boundBuffer = null;
        this.instancedAttribs = {};
        this.enabledAttributes = {};
        this.textureUnits = [];
        this.commitFunction = {};
        this._maxPixelRatio = 1;
        // local width/height without pixelRatio applied
        this._width = 0;
        this._height = 0;

        if (!window.WebGLRenderingContext) {
            throw new pc.UnsupportedBrowserError();
        }

        // Retrieve the WebGL context
        if (canvas) {
            this.gl = _createContext(canvas);
        }

        if (!this.gl) {
            throw new pc.ContextCreationError();
        }

        var gl = this.gl;

        // put the rest of the contructor in a function
        // so that the constructor remains small. Small constructors
        // are optimized by Firefox due to type inference
        (function() {

            canvas.addEventListener("webglcontextlost", _contextLostHandler, false);
            canvas.addEventListener("webglcontextrestored", _contextRestoredHandler, false);

            this.canvas        = canvas;
            this.shader        = null;
            this.indexBuffer   = null;
            this.vertexBuffers = [];
            this.precision     = 'highp';

            this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            this.maxCubeMapSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
            this.maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);

            // Query the precision supported by ints and floats in vertex and fragment shaders
            var vertexShaderPrecisionHighpFloat = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
            var vertexShaderPrecisionMediumpFloat = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT);
            var vertexShaderPrecisionLowpFloat = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.LOW_FLOAT);

            var fragmentShaderPrecisionHighpFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
            var fragmentShaderPrecisionMediumpFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT );
            var fragmentShaderPrecisionLowpFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.LOW_FLOAT);

            var vertexShaderPrecisionHighpInt = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_INT);
            var vertexShaderPrecisionMediumpInt = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_INT);
            var vertexShaderPrecisionLowpInt = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.LOW_INT);

            var fragmentShaderPrecisionHighpInt = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_INT);
            var fragmentShaderPrecisionMediumpInt = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_INT);
            var fragmentShaderPrecisionLowpInt = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.LOW_INT);

            var highpAvailable = vertexShaderPrecisionHighpFloat.precision > 0 && fragmentShaderPrecisionHighpFloat.precision > 0;
            var mediumpAvailable = vertexShaderPrecisionMediumpFloat.precision > 0 && fragmentShaderPrecisionMediumpFloat.precision > 0;

            if (!highpAvailable) {
                if (mediumpAvailable) {
                    this.precision = "mediump";
                    console.warn("WARNING: highp not supported, using mediump");
                } else {
                    this.precision = "lowp";
                    console.warn( "WARNING: highp and mediump not supported, using lowp" );
                }
            }

            this.maxPrecision = this.precision;

            this.defaultClearOptions = {
                color: [0, 0, 0, 1],
                depth: 1,
                flags: pc.CLEARFLAG_COLOR | pc.CLEARFLAG_DEPTH
            };

            this.glAddress = [
                gl.REPEAT,
                gl.CLAMP_TO_EDGE,
                gl.MIRRORED_REPEAT
            ];

            this.glBlendEquation = [
                gl.FUNC_ADD,
                gl.FUNC_SUBTRACT,
                gl.FUNC_REVERSE_SUBTRACT
            ];

            this.glBlendFunction = [
                gl.ZERO,
                gl.ONE,
                gl.SRC_COLOR,
                gl.ONE_MINUS_SRC_COLOR,
                gl.DST_COLOR,
                gl.ONE_MINUS_DST_COLOR,
                gl.SRC_ALPHA,
                gl.SRC_ALPHA_SATURATE,
                gl.ONE_MINUS_SRC_ALPHA,
                gl.DST_ALPHA,
                gl.ONE_MINUS_DST_ALPHA
            ];

            this.glClearFlag = [
                0,
                gl.COLOR_BUFFER_BIT,
                gl.DEPTH_BUFFER_BIT,
                gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT,
                gl.STENCIL_BUFFER_BIT,
                gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT,
                gl.STENCIL_BUFFER_BIT | gl.DEPTH_BUFFER_BIT,
                gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT
            ];

            this.glFilter = [
                gl.NEAREST,
                gl.LINEAR,
                gl.NEAREST_MIPMAP_NEAREST,
                gl.NEAREST_MIPMAP_LINEAR,
                gl.LINEAR_MIPMAP_NEAREST,
                gl.LINEAR_MIPMAP_LINEAR
            ];

            this.glPrimitive = [
                gl.POINTS,
                gl.LINES,
                gl.LINE_LOOP,
                gl.LINE_STRIP,
                gl.TRIANGLES,
                gl.TRIANGLE_STRIP,
                gl.TRIANGLE_FAN
            ];

            this.glType = [
                gl.BYTE,
                gl.UNSIGNED_BYTE,
                gl.SHORT,
                gl.UNSIGNED_SHORT,
                gl.INT,
                gl.UNSIGNED_INT,
                gl.FLOAT
            ];

            // Initialize extensions
            this.extTextureFloat = gl.getExtension("OES_texture_float");
            this.extTextureFloatLinear = gl.getExtension("OES_texture_float_linear");
            this.extTextureHalfFloat = gl.getExtension("OES_texture_half_float");

            this.extUintElement = gl.getExtension("OES_element_index_uint");

            this.maxVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
            this.supportsBoneTextures = this.extTextureFloat && this.maxVertexTextures > 0;

            // Test if we can render to floating-point RGBA texture
            this.extTextureFloatRenderable = !!this.extTextureFloat;
            if (this.extTextureFloat) {
                var __texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, __texture);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

                var __width = 2;
                var __height = 2;
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, __width, __height, 0, gl.RGBA, gl.FLOAT, null);

                // Try to use this texture as a render target.
                var __fbo = gl.createFramebuffer();
                gl.bindFramebuffer(gl.FRAMEBUFFER, __fbo);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, __texture, 0);
                gl.bindTexture(gl.TEXTURE_2D, null);
                // It is legal for a WebGL implementation exposing the OES_texture_float extension to
                // support floating-point textures but not as attachments to framebuffer objects.
                if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
                    this.extTextureFloatRenderable = false;
                }
            }

            this.extTextureLod = gl.getExtension('EXT_shader_texture_lod');

            this.fragmentUniformsCount = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
            this.samplerCount = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);

            this.useTexCubeLod = this.extTextureLod && this.samplerCount < 16;

            this.extDepthTexture = null; //gl.getExtension("WEBKIT_WEBGL_depth_texture");
            this.extStandardDerivatives = gl.getExtension("OES_standard_derivatives");
            if (this.extStandardDerivatives) {
                gl.hint(this.extStandardDerivatives.FRAGMENT_SHADER_DERIVATIVE_HINT_OES, gl.NICEST);
            }

            this.extTextureFilterAnisotropic = gl.getExtension('EXT_texture_filter_anisotropic');
            if (!this.extTextureFilterAnisotropic) {
                this.extTextureFilterAnisotropic = gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
            }

            this.extCompressedTextureS3TC = gl.getExtension('WEBGL_compressed_texture_s3tc');
            if (!this.extCompressedTextureS3TC) {
                this.extCompressedTextureS3TC = gl.getExtension('WEBKIT_WEBGL_compressed_texture_s3tc');
            }

            if (this.extCompressedTextureS3TC) {
                if (_isIE()) {
                    // IE 11 can't use mip maps with S3TC
                    this.extCompressedTextureS3TC = false;
                }
            }

            if (this.extCompressedTextureS3TC) {
                var formats = gl.getParameter(gl.COMPRESSED_TEXTURE_FORMATS);
                for (var i = 0; i < formats.length; i++) {
                    switch (formats[i]) {
                        case this.extCompressedTextureS3TC.COMPRESSED_RGB_S3TC_DXT1_EXT:
                            break;
                        case this.extCompressedTextureS3TC.COMPRESSED_RGBA_S3TC_DXT1_EXT:
                            break;
                        case this.extCompressedTextureS3TC.COMPRESSED_RGBA_S3TC_DXT3_EXT:
                            break;
                        case this.extCompressedTextureS3TC.COMPRESSED_RGBA_S3TC_DXT5_EXT:
                            break;
                        default:
                            break;
                    }
                }
            }

            this.extInstancing = gl.getExtension("ANGLE_instanced_arrays");

            this.extCompressedTextureETC1 = gl.getExtension('WEBGL_compressed_texture_etc1');
            this.extDrawBuffers = gl.getExtension('EXT_draw_buffers');
            this.maxDrawBuffers = this.extDrawBuffers ? gl.getParameter(this.extDrawBuffers.MAX_DRAW_BUFFERS_EXT) : 1;
            this.maxColorAttachments = this.extDrawBuffers ? gl.getParameter(this.extDrawBuffers.MAX_COLOR_ATTACHMENTS_EXT) : 1;

            // Create the default render target
            this.renderTarget = null;

            // Create the ScopeNamespace for shader attributes and variables
            this.scope = new pc.ScopeSpace("Device");

            // Define the uniform commit functions
            this.commitFunction = {};
            this.commitFunction[pc.UNIFORMTYPE_BOOL ] = function (locationId, value) { gl.uniform1i(locationId, value); };
            this.commitFunction[pc.UNIFORMTYPE_INT  ] = function (locationId, value) { gl.uniform1i(locationId, value); };
            this.commitFunction[pc.UNIFORMTYPE_FLOAT] = function (locationId, value) {
                if (typeof value == "number")
                    gl.uniform1f(locationId, value);
                else
                    gl.uniform1fv(locationId, value);
                };
            this.commitFunction[pc.UNIFORMTYPE_VEC2]  = function (locationId, value) { gl.uniform2fv(locationId, value); };
            this.commitFunction[pc.UNIFORMTYPE_VEC3]  = function (locationId, value) { gl.uniform3fv(locationId, value); };
            this.commitFunction[pc.UNIFORMTYPE_VEC4]  = function (locationId, value) { gl.uniform4fv(locationId, value); };
            this.commitFunction[pc.UNIFORMTYPE_IVEC2] = function (locationId, value) { gl.uniform2iv(locationId, value); };
            this.commitFunction[pc.UNIFORMTYPE_BVEC2] = function (locationId, value) { gl.uniform2iv(locationId, value); };
            this.commitFunction[pc.UNIFORMTYPE_IVEC3] = function (locationId, value) { gl.uniform3iv(locationId, value); };
            this.commitFunction[pc.UNIFORMTYPE_BVEC3] = function (locationId, value) { gl.uniform3iv(locationId, value); };
            this.commitFunction[pc.UNIFORMTYPE_IVEC4] = function (locationId, value) { gl.uniform4iv(locationId, value); };
            this.commitFunction[pc.UNIFORMTYPE_BVEC4] = function (locationId, value) { gl.uniform4iv(locationId, value); };
            this.commitFunction[pc.UNIFORMTYPE_MAT2]  = function (locationId, value) { gl.uniformMatrix2fv(locationId, false, value); };
            this.commitFunction[pc.UNIFORMTYPE_MAT3]  = function (locationId, value) { gl.uniformMatrix3fv(locationId, false, value); };
            this.commitFunction[pc.UNIFORMTYPE_MAT4]  = function (locationId, value) { gl.uniformMatrix4fv(locationId, false, value); };

            // Set the initial render state
            this.setBlending(false);
            this.setBlendFunction(pc.BLENDMODE_ONE, pc.BLENDMODE_ZERO);
            this.setBlendEquation(pc.BLENDEQUATION_ADD);
            this.setColorWrite(true, true, true, true);
            this.setCullMode(pc.CULLFACE_BACK);
            this.setDepthTest(true);
            this.setDepthWrite(true);

            this.setClearDepth(1);
            this.setClearColor(0, 0, 0, 0);

            gl.enable(gl.SCISSOR_TEST);

            this.programLib = new pc.ProgramLibrary(this);
            for (var generator in pc.programlib) {
                this.programLib.register(generator, pc.programlib[generator]);
            }

            // Calculate a estimate of the maximum number of bones that can be uploaded to the GPU
            // based on the number of available uniforms and the number of uniforms required for non-
            // bone data.  This is based off of the Phong shader.  A user defined shader may have
            // even less space available for bones so this calculated value can be overridden via
            // pc.GraphicsDevice.setBoneLimit.
            var numUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
            numUniforms -= 4 * 4; // Model, view, projection and shadow matrices
            numUniforms -= 8;     // 8 lights max, each specifying a position vector
            numUniforms -= 1;     // Eye position
            numUniforms -= 4 * 4; // Up to 4 texture transforms
            this.boneLimit = Math.floor(numUniforms / 4);
            // HACK: If the number of bones is above ~120-124, performance on the Mac Mini
            // degrades drastically
            if (this.boneLimit > 110) {
                this.boneLimit = 110;
            }

            pc.events.attach(this);

            this.boundBuffer = null;
            this.instancedAttribs = {};

            this.activeTexture = 0;
            this.textureUnits = [];

            this.attributesInvalidated = true;

            this.enabledAttributes = {};

            // Handle IE11's inability to take UNSIGNED_BYTE as a param for vertexAttribPointer
            var bufferId = gl.createBuffer();
            var storage = new ArrayBuffer(16);
            gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
            gl.bufferData(gl.ARRAY_BUFFER, storage, gl.STATIC_DRAW);
            gl.getError(); // Clear error flag
            gl.vertexAttribPointer(0, 4, gl.UNSIGNED_BYTE, false, 4, 0);
            this.supportsUnsignedByte = (gl.getError() === 0);
            gl.deleteBuffer(bufferId);
        }).call(this);
    };

    GraphicsDevice.prototype = {
        /**
         * @function
         * @name pc.GraphicsDevice#setViewport
         * @description Set the active rectangle for rendering on the specified device.
         * @param {Number} x The pixel space x-coordinate of the bottom left corner of the viewport.
         * @param {Number} y The pixel space y-coordinate of the bottom left corner of the viewport.
         * @param {Number} w The width of the viewport in pixels.
         * @param {Number} h The height of the viewport in pixels.
         */
        setViewport: function (x, y, width, height) {
            var gl = this.gl;
            gl.viewport(x, y, width, height);
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setScissor
         * @description Set the active scissor rectangle on the specified device.
         * @param {Number} x The pixel space x-coordinate of the bottom left corner of the scissor rectangle.
         * @param {Number} y The pixel space y-coordinate of the bottom left corner of the scissor rectangle.
         * @param {Number} w The width of the scissor rectangle in pixels.
         * @param {Number} h The height of the scissor rectangle in pixels.
         */
        setScissor: function (x, y, width, height) {
            var gl = this.gl;
            gl.scissor(x, y, width, height);
        },

        /**
         * @function
         * @name pc.GraphicsDevice#getProgramLibrary
         * @description Retrieves the program library assigned to the specified graphics device.
         * @returns {pc.ProgramLibrary} The program library assigned to the device.
         */
        getProgramLibrary: function () {
            return this.programLib;
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setProgramLibrary
         * @description Assigns a program library to the specified device. By default, a graphics
         * device is created with a program library that manages all of the programs that are
         * used to render any graphical primitives. However, this function allows the user to
         * replace the existing program library with a new one.
         * @param {pc.ProgramLibrary} programLib The program library to assign to the device.
         */
        setProgramLibrary: function (programLib) {
            this.programLib = programLib;
        },

        /**
         * @function
         * @name pc.GraphicsDevice#updateBegin
         * @description Marks the beginning of a block of rendering. Internally, this function
         * binds the render target currently set on the device. This function should be matched
         * with a call to pc.GraphicsDevice#updateEnd. Calls to pc.GraphicsDevice#updateBegin
         * and pc.GraphicsDevice#updateEnd must not be nested.
         */
        updateBegin: function () {
            var gl = this.gl;

            this.boundBuffer = null;
            this.indexBuffer = null;

            // Set the render target
            var target = this.renderTarget;
            if (target) {
                // Create a new WebGL frame buffer object
                if (!target._glFrameBuffer) {
                    target._glFrameBuffer = gl.createFramebuffer();
                    gl.bindFramebuffer(gl.FRAMEBUFFER, target._glFrameBuffer);

                    var colorBuffer = target._colorBuffer;
                    if (!colorBuffer._glTextureId) {
                        // Clamp the render buffer size to the maximum supported by the device
                        colorBuffer._width = Math.min(colorBuffer.width, this.maxRenderBufferSize);
                        colorBuffer._height = Math.min(colorBuffer.height, this.maxRenderBufferSize);

                        this.setTexture(colorBuffer, 0);
                    }

                    gl.framebufferTexture2D(gl.FRAMEBUFFER,
                                            gl.COLOR_ATTACHMENT0,
                                            colorBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D,
                                            colorBuffer._glTextureId,
                                            0);

                    if (target._depth) {
                        if (!target._glDepthBuffer) {
                            target._glDepthBuffer = gl.createRenderbuffer();
                        }

                        gl.bindRenderbuffer(gl.RENDERBUFFER, target._glDepthBuffer);
                        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, target.width, target.height);
                        gl.bindRenderbuffer(gl.RENDERBUFFER, null);

                        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, target._glDepthBuffer);
                    }

                    // Ensure all is well
                    var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
                    switch (status) {
                        case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                            console.error("ERROR: FRAMEBUFFER_INCOMPLETE_ATTACHMENT");
                            break;
                        case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                            console.error("ERROR: FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT");
                            break;
                        case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
                            console.error("ERROR: FRAMEBUFFER_INCOMPLETE_DIMENSIONS");
                            break;
                        case gl.FRAMEBUFFER_UNSUPPORTED:
                            console.error("ERROR: FRAMEBUFFER_UNSUPPORTED");
                            break;
                        case gl.FRAMEBUFFER_COMPLETE:
                            break;
                        default:
                            break;
                    }
                } else {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, target._glFrameBuffer);
                }
            } else {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            }

            for (var i = 0; i < 16; i++) {
                this.textureUnits[i] = null;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#updateEnd
         * @description Marks the end of a block of rendering. This function should be called
         * after a matching call to pc.GraphicsDevice#updateBegin. Calls to pc.GraphicsDevice#updateBegin
         * and pc.GraphicsDevice#updateEnd must not be nested.
         */
        updateEnd: function () {
            var gl = this.gl;

            // Unset the render target
            var target = this.renderTarget;
            if (target) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            }
        },

        initializeTexture: function (texture) {
            var gl = this.gl;

            texture._glTextureId = gl.createTexture();

            texture._glTarget = texture._cubemap ? gl.TEXTURE_CUBE_MAP : gl.TEXTURE_2D;

            switch (texture._format) {
                case pc.PIXELFORMAT_A8:
                    texture._glFormat = gl.ALPHA;
                    texture._glInternalFormat = gl.ALPHA;
                    texture._glPixelType = gl.UNSIGNED_BYTE;
                    break;
                case pc.PIXELFORMAT_L8:
                    texture._glFormat = gl.LUMINANCE;
                    texture._glInternalFormat = gl.LUMINANCE;
                    texture._glPixelType = gl.UNSIGNED_BYTE;
                    break;
                case pc.PIXELFORMAT_L8_A8:
                    texture._glFormat = gl.LUMINANCE_ALPHA;
                    texture._glInternalFormat = gl.LUMINANCE_ALPHA;
                    texture._glPixelType = gl.UNSIGNED_BYTE;
                    break;
                case pc.PIXELFORMAT_R5_G6_B5:
                    texture._glFormat = gl.RGB;
                    texture._glInternalFormat = gl.RGB;
                    texture._glPixelType = gl.UNSIGNED_SHORT_5_6_5;
                    break;
                case pc.PIXELFORMAT_R5_G5_B5_A1:
                    texture._glFormat = gl.RGBA;
                    texture._glInternalFormat = gl.RGBA;
                    texture._glPixelType = gl.UNSIGNED_SHORT_5_5_5_1;
                    break;
                case pc.PIXELFORMAT_R4_G4_B4_A4:
                    texture._glFormat = gl.RGBA;
                    texture._glInternalFormat = gl.RGBA;
                    texture._glPixelType = gl.UNSIGNED_SHORT_4_4_4_4;
                    break;
                case pc.PIXELFORMAT_R8_G8_B8:
                    texture._glFormat = gl.RGB;
                    texture._glInternalFormat = gl.RGB;
                    texture._glPixelType = gl.UNSIGNED_BYTE;
                    break;
                case pc.PIXELFORMAT_R8_G8_B8_A8:
                    texture._glFormat = gl.RGBA;
                    texture._glInternalFormat = gl.RGBA;
                    texture._glPixelType = gl.UNSIGNED_BYTE;
                    break;
                case pc.PIXELFORMAT_DXT1:
                    ext = this.extCompressedTextureS3TC;
                    texture._glFormat = gl.RGB;
                    texture._glInternalFormat = ext.COMPRESSED_RGB_S3TC_DXT1_EXT;
                    break;
                case pc.PIXELFORMAT_DXT3:
                    ext = this.extCompressedTextureS3TC;
                    texture._glFormat = gl.RGBA;
                    texture._glInternalFormat = ext.COMPRESSED_RGBA_S3TC_DXT3_EXT;
                    break;
                case pc.PIXELFORMAT_DXT5:
                    ext = this.extCompressedTextureS3TC;
                    texture._glFormat = gl.RGBA;
                    texture._glInternalFormat = ext.COMPRESSED_RGBA_S3TC_DXT5_EXT;
                    break;
                case pc.PIXELFORMAT_ETC1:
                    ext = this.extCompressedTextureETC1;
                    texture._glFormat = gl.RGB;
                    texture._glInternalFormat = ext.COMPRESSED_RGB_ETC1_WEBGL;
                    break;
                case pc.PIXELFORMAT_RGB16F:
                    ext = this.extTextureHalfFloat;
                    texture._glFormat = gl.RGB;
                    texture._glInternalFormat = gl.RGB;
                    texture._glPixelType = ext.HALF_FLOAT_OES;
                    break;
                case pc.PIXELFORMAT_RGBA16F:
                    ext = this.extTextureHalfFloat;
                    texture._glFormat = gl.RGBA;
                    texture._glInternalFormat = gl.RGBA;
                    texture._glPixelType = ext.HALF_FLOAT_OES;
                    break;
                case pc.PIXELFORMAT_RGB32F:
                    texture._glFormat = gl.RGB;
                    texture._glInternalFormat = gl.RGB;
                    texture._glPixelType = gl.FLOAT;
                    break;
                case pc.PIXELFORMAT_RGBA32F:
                    texture._glFormat = gl.RGBA;
                    texture._glInternalFormat = gl.RGBA;
                    texture._glPixelType = gl.FLOAT;
                    break;
            }
        },

        uploadTexture: function (texture) {
            var gl = this.gl;

            var mipLevel = 0;
            var mipObject;

            while(texture._levels[mipLevel] || mipLevel==0) { // Upload all existing mip levels. Initialize 0 mip anyway.
                mipObject = texture._levels[mipLevel];

                if (mipLevel == 1 && ! texture._compressed) {
                    // We have more than one mip levels we want to assign, but we need all mips to make
                    // the texture complete. Therefore first generate all mip chain from 0, then assign custom mips.
                    gl.generateMipmap(texture._glTarget);
                }

                if (texture._cubemap) {
                    var face;

                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
                    if ((mipObject[0] instanceof HTMLCanvasElement) || (mipObject[0] instanceof HTMLImageElement) || (mipObject[0] instanceof HTMLVideoElement)) {
                        // Upload the image, canvas or video
                        for (face = 0; face < 6; face++) {
                            if (! texture._levelsUpdated[0][face])
                                continue;

                            var src = mipObject[face];
                            // Downsize images that are too large to be used as cube maps
                            if (src instanceof HTMLImageElement) {
                                if (src.width > this.maxCubeMapSize || src.height > this.maxCubeMapSize) {
                                    src = _downsampleImage(src, this.maxCubeMapSize);
                                    if (mipLevel===0) {
                                        texture.width = src.width;
                                        texture.height = src.height;
                                    }
                                }
                            }

                            gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                                          mipLevel,
                                          texture._glInternalFormat,
                                          texture._glFormat,
                                          texture._glPixelType,
                                          src);
                        }
                    } else {
                        // Upload the byte array
                        var resMult = 1 / Math.pow(2, mipLevel);
                        for (face = 0; face < 6; face++) {
                            if (! texture._levelsUpdated[0][face])
                                continue;

                            if (texture._compressed) {
                                gl.compressedTexImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                                                        mipLevel,
                                                        texture._glInternalFormat,
                                                        Math.max(texture._width * resMult, 1),
                                                        Math.max(texture._height * resMult, 1),
                                                        0,
                                                        mipObject[face]);
                            } else {
                                gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                                              mipLevel,
                                              texture._glInternalFormat,
                                              Math.max(texture._width * resMult, 1),
                                              Math.max(texture._height * resMult, 1),
                                              0,
                                              texture._glFormat,
                                              texture._glPixelType,
                                              mipObject[face]);
                            }
                        }
                    }
                } else {
                    if ((mipObject instanceof HTMLCanvasElement) || (mipObject instanceof HTMLImageElement) || (mipObject instanceof HTMLVideoElement)) {
                        // Downsize images that are too large to be used as textures
                        if (mipObject instanceof HTMLImageElement) {
                            if (mipObject.width > this.maxTextureSize || mipObject.height > this.maxTextureSize) {
                                mipObject = _downsampleImage(mipObject, this.maxTextureSize);
                                if (mipLevel===0) {
                                    texture.width = mipObject.width;
                                    texture.height = mipObject.height;
                                }
                            }
                        }

                        // Upload the image, canvas or video
                        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
                        gl.texImage2D(gl.TEXTURE_2D,
                                      mipLevel,
                                      texture._glInternalFormat,
                                      texture._glFormat,
                                      texture._glPixelType,
                                      mipObject);
                    } else {
                        // Upload the byte array
                        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                        var resMult = 1 / Math.pow(2, mipLevel);
                        if (texture._compressed) {
                            gl.compressedTexImage2D(gl.TEXTURE_2D,
                                                    mipLevel,
                                                    texture._glInternalFormat,
                                                    Math.max(texture._width * resMult, 1),
                                                    Math.max(texture._height * resMult, 1),
                                                    0,
                                                    mipObject);
                        } else {
                            gl.texImage2D(gl.TEXTURE_2D,
                                          mipLevel,
                                          texture._glInternalFormat,
                                          Math.max(texture._width * resMult, 1),
                                          Math.max(texture._height * resMult, 1),
                                          0,
                                          texture._glFormat,
                                          texture._glPixelType,
                                          mipObject);
                        }
                    }
                }
                mipLevel++;
            }

            if (texture._cubemap) {
                for(var i = 0; i < 6; i++)
                    texture._levelsUpdated[0][i] = false;
            } else {
                texture._levelsUpdated[0] = false;
            }

            if (texture.autoMipmap && pc.math.powerOfTwo(texture._width) && pc.math.powerOfTwo(texture._height) && texture._levels.length === 1 && !texture._compressed) {
                gl.generateMipmap(texture._glTarget);
            }
        },

        setTexture: function (texture, textureUnit) {
            var gl = this.gl;

            if (!texture._glTextureId) {
                this.initializeTexture(texture);
            }

            if (this.activeTexture !== textureUnit) {
                gl.activeTexture(gl.TEXTURE0 + textureUnit);
                this.activeTexture = textureUnit;
            }

            var target = texture._glTarget;
            if (this.textureUnits[textureUnit] !== texture) {
                gl.bindTexture(target, texture._glTextureId);
                this.textureUnits[textureUnit] = texture;
            }

            if (texture._minFilterDirty) {
                gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, this.glFilter[texture._minFilter]);
                texture._minFilterDirty = false;
            }
            if (texture._magFilterDirty) {
                gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, this.glFilter[texture._magFilter]);
                texture._magFilterDirty = false;
            }
            if (texture._addressUDirty) {
                gl.texParameteri(target, gl.TEXTURE_WRAP_S, this.glAddress[texture._addressU]);
                texture._addressUDirty = false;
            }
            if (texture._addressVDirty) {
                gl.texParameteri(target, gl.TEXTURE_WRAP_T, this.glAddress[texture._addressV]);
                texture._addressVDirty = false;
            }
            if (texture._anisotropyDirty) {
                var ext = this.extTextureFilterAnisotropic;
                if (ext) {
                    var maxAnisotropy = this.maxAnisotropy;
                    var anisotropy = texture.anisotropy;
                    anisotropy = Math.min(anisotropy, maxAnisotropy);
                    gl.texParameterf(target, ext.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);
                }
                texture._anisotropyDirty = false;
            }

            if (texture._needsUpload) {
                this.uploadTexture(texture);
                texture._needsUpload = false;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#draw
         * @description Submits a graphical primitive to the hardware for immediate rendering.
         * @param {Object} primitive Primitive object describing how to submit current vertex/index buffers defined as follows:
         * @param {pc.PRIMITIVE} primitive.type The type of primitive to render.
         * @param {Number} primitive.base The offset of the first index or vertex to dispatch in the draw call.
         * @param {Number} primitive.count The number of indices or vertices to dispatch in the draw call.
         * @param {Boolean} primitive.indexed True to interpret the primitive as indexed, thereby using the currently set index buffer and false otherwise.
         * @example
         * // Render a single, unindexed triangle
         * device.draw({
         *     type: pc.PRIMITIVE_TRIANGLES,
         *     base: 0,
         *     count: 3,
         *     indexed: false
         * )};
         */
        draw: function (primitive, numInstances) {
            var gl = this.gl;

            var i, j, len, sampler, samplerValue, texture, numTextures, uniform, scopeId, uniformVersion, programVersion;
            var shader = this.shader;
            var samplers = shader.samplers;
            var uniforms = shader.uniforms;

            if (numInstances > 1) {
                this.boundBuffer = null;
                this.attributesInvalidated = true;
            }

            // Commit the vertex buffer inputs
            if (this.attributesInvalidated) {
                var attribute, element, vertexBuffer;
                var attributes = shader.attributes;

                for (i = 0, len = attributes.length; i < len; i++) {
                    attribute = attributes[i];

                    // Retrieve vertex element for this shader attribute
                    element = attribute.scopeId.value;

                    // Check the vertex element is valid
                    if (element !== null) {
                        // Retrieve the vertex buffer that contains this element
                        vertexBuffer = this.vertexBuffers[element.stream];

                        // Set the active vertex buffer object
                        if (this.boundBuffer !== vertexBuffer.bufferId) {
                            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer.bufferId);
                            this.boundBuffer = vertexBuffer.bufferId;
                        }

                        // Hook the vertex buffer to the shader program
                        if (!this.enabledAttributes[attribute.locationId]) {
                            gl.enableVertexAttribArray(attribute.locationId);
                            this.enabledAttributes[attribute.locationId] = true;
                        }
                        gl.vertexAttribPointer(attribute.locationId,
                                               element.numComponents,
                                               this.glType[element.dataType],
                                               element.normalize,
                                               element.stride,
                                               element.offset);

                        if (element.stream===1 && numInstances>1) {
                            if (!this.instancedAttribs[attribute.locationId]) {
                                this.extInstancing.vertexAttribDivisorANGLE(attribute.locationId, 1);
                                this.instancedAttribs[attribute.locationId] = true;
                            }
                        } else if (this.instancedAttribs[attribute.locationId]) {
                            this.extInstancing.vertexAttribDivisorANGLE(attribute.locationId, 0);
                            this.instancedAttribs[attribute.locationId] = false;
                        }
                    }
                }

                this.attributesInvalidated = false;
            }

            // Commit the shader program variables
            textureUnit = 0;
            for (i = 0, len = samplers.length; i < len; i++) {
                sampler = samplers[i];
                samplerValue = sampler.scopeId.value;

                if (samplerValue instanceof pc.Texture) {
                    texture = samplerValue;
                    this.setTexture(texture, textureUnit);

                    if (sampler.slot !== textureUnit) {
                        gl.uniform1i(sampler.locationId, textureUnit);
                        sampler.slot = textureUnit;
                    }
                    textureUnit++;
                } else { // Array
                    sampler.array.length = 0;
                    numTexures = samplerValue.length;
                    for (j = 0; j < numTexures; j++) {
                        texture = samplerValue[j];
                        this.setTexture(texture, textureUnit);

                        sampler.array[j] = textureUnit;
                        textureUnit++;
                    }
                    gl.uniform1iv(sampler.locationId, sampler.array);
                }
            }

            // Commit any updated uniforms
            for (i = 0, len = uniforms.length; i < len; i++) {
                uniform = uniforms[i];
                scopeId = uniform.scopeId;
                uniformVersion = uniform.version;
                programVersion = scopeId.versionObject.version;

                // Check the value is valid
                if (uniformVersion.globalId !== programVersion.globalId || uniformVersion.revision !== programVersion.revision) {
                    uniformVersion.globalId = programVersion.globalId;
                    uniformVersion.revision = programVersion.revision;

                    // Call the function to commit the uniform value
                    if (scopeId.value!==null) {
                        this.commitFunction[uniform.dataType](uniform.locationId, scopeId.value);
                    }
                }
            }

            if (primitive.indexed) {
                if (numInstances > 1) {
                    this.extInstancing.drawElementsInstancedANGLE(this.glPrimitive[primitive.type],
                                                                  primitive.count,
                                                                  this.indexBuffer.glFormat,
                                                                  primitive.base * 2,
                                                                  numInstances);
                    this.boundBuffer = null;
                    this.attributesInvalidated = true;
                } else {
                    gl.drawElements(this.glPrimitive[primitive.type],
                                    primitive.count,
                                    this.indexBuffer.glFormat,
                                    primitive.base * this.indexBuffer.bytesPerIndex);
                }
            } else {
                if (numInstances > 1) {
                    this.extInstancing.drawArraysInstancedANGLE(this.glPrimitive[primitive.type],
                                  primitive.base,
                                  primitive.count,
                                  numInstances);
                    this.boundBuffer = null;
                    this.attributesInvalidated = true;
                } else {
                    gl.drawArrays(this.glPrimitive[primitive.type],
                                  primitive.base,
                                  primitive.count);
                }
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#clear
         * @description Clears the frame buffer of the currently set render target.
         * @param {Object} options Optional options object that controls the behavior of the clear operation defined as follows:
         * @param {Array} options.color The color to clear the color buffer to in the range 0.0 to 1.0 for each component.
         * @param {Number} options.depth The depth value to clear the depth buffer to in the range 0.0 to 1.0.
         * @param {pc.CLEARFLAG} options.flags The buffers to clear (the types being color, depth and stencil).
         * @example
         * // Clear color buffer to black and depth buffer to 1.0
         * device.clear();
         *
         * // Clear just the color buffer to red
         * device.clear({
         *     color: [1, 0, 0, 1],
         *     flags: pc.CLEARFLAG_COLOR
         * });
         *
         * // Clear color buffer to yellow and depth to 1.0
         * device.clear({
         *     color: [1, 1, 0, 1],
         *     depth: 1.0,
         *     flags: pc.CLEARFLAG_COLOR | pc.CLEARFLAG_DEPTH
         * });
         */
        clear: function (options) {
            var defaultOptions = this.defaultClearOptions;
            options = options || defaultOptions;

            var flags = (options.flags === undefined) ? defaultOptions.flags : options.flags;
            if (flags !== 0) {
                var gl = this.gl;

                // Set the clear color
                if (flags & pc.CLEARFLAG_COLOR) {
                    var color = (options.color === undefined) ? defaultOptions.color : options.color;
                    this.setClearColor(color[0], color[1], color[2], color[3]);
                }

                if (flags & pc.CLEARFLAG_DEPTH) {
                    // Set the clear depth
                    var depth = (options.depth === undefined) ? defaultOptions.depth : options.depth;
                    this.setClearDepth(depth);
                    if (!this.depthWrite) {
                        gl.depthMask(true);
                    }
                }

                // Clear the frame buffer
                gl.clear(this.glClearFlag[flags]);

                if (flags & pc.CLEARFLAG_DEPTH) {
                    if (!this.depthWrite) {
                        gl.depthMask(false);
                    }
                }
            }
        },

        readPixels: function (x, y, w, h, pixels) {
            var gl = this.gl;
            gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        },

        setClearDepth: function (depth) {
            if (depth !== this.clearDepth) {
                this.gl.clearDepth(depth);
                this.clearDepth = depth;
            }
        },

        setClearColor: function (r, g, b, a) {
            if ((r !== this.clearRed) || (g !== this.clearGreen) || (b !== this.clearBlue) || (a !== this.clearAlpha)) {
                this.gl.clearColor(r, g, b, a);
                this.clearRed = r;
                this.clearGreen = g;
                this.clearBlue = b;
                this.clearAlpha = a;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setRenderTarget
         * @description Sets the specified render target on the device. If null
         * is passed as a parameter, the back buffer becomes the current target
         * for all rendering operations.
         * @param {pc.RenderTarget} The render target to activate.
         * @example
         * // Set a render target to receive all rendering output
         * device.setRenderTarget(renderTarget);
         *
         * // Set the back buffer to receive all rendering output
         * device.setRenderTarget(null);
         */
        setRenderTarget: function (renderTarget) {
            this.renderTarget = renderTarget;
        },

        /**
         * @function
         * @name pc.GraphicsDevice#getRenderTarget
         * @description Queries the currently set render target on the device.
         * @returns {pc.RenderTarget} The current render target.
         * @example
         * // Get the current render target
         * var renderTarget = device.getRenderTarget();
         */
        getRenderTarget: function () {
            return this.renderTarget;
        },

        /**
         * @function
         * @name pc.GraphicsDevice#getDepthTest
         * @description Queries whether depth testing is enabled.
         * @returns {Boolean} true if depth testing is enabled and false otherwise.
         * @example
         * var depthTest = device.getDepthTest();
         * console.log('Depth testing is ' + depthTest ? 'enabled' : 'disabled');
         */
        getDepthTest: function () {
            return this.depthTest;
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setDepthTest
         * @description Enables or disables depth testing of fragments. Once this state
         * is set, it persists until it is changed. By default, depth testing is enabled.
         * @param {Boolean} depthTest true to enable depth testing and false otherwise.
         * @example
         * device.setDepthTest(true);
         */
        setDepthTest: function (depthTest) {
            if (this.depthTest !== depthTest) {
                var gl = this.gl;
                if (depthTest) {
                    gl.enable(gl.DEPTH_TEST);
                } else {
                    gl.disable(gl.DEPTH_TEST);
                }
                this.depthTest = depthTest;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#getDepthWrite
         * @description Queries whether writes to the depth buffer are enabled.
         * @returns {Boolean} true if depth writing is enabled and false otherwise.
         * @example
         * var depthWrite = device.getDepthWrite();
         * console.log('Depth writing is ' + depthWrite ? 'enabled' : 'disabled');
         */
        getDepthWrite: function () {
            return this.depthWrite;
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setDepthWrite
         * @description Enables or disables writes to the depth buffer. Once this state
         * is set, it persists until it is changed. By default, depth writes are enabled.
         * @param {Boolean} writeDepth true to enable depth writing and false otherwise.
         * @example
         * device.setDepthWrite(true);
         */
        setDepthWrite: function (writeDepth) {
            if (this.depthWrite !== writeDepth) {
                this.gl.depthMask(writeDepth);
                this.depthWrite = writeDepth;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setColorWrite
         * @description Enables or disables writes to the color buffer. Once this state
         * is set, it persists until it is changed. By default, color writes are enabled
         * for all color channels.
         * @param {Boolean} writeRed true to enable writing  of the red channel and false otherwise.
         * @param {Boolean} writeGreen true to enable writing  of the green channel and false otherwise.
         * @param {Boolean} writeBlue true to enable writing  of the blue channel and false otherwise.
         * @param {Boolean} writeAlpha true to enable writing  of the alpha channel and false otherwise.
         * @example
         * // Just write alpha into the frame buffer
         * device.setColorWrite(false, false, false, true);
         */
        setColorWrite: function (writeRed, writeGreen, writeBlue, writeAlpha) {
            if ((this.writeRed !== writeRed) ||
                (this.writeGreen !== writeGreen) ||
                (this.writeBlue !== writeBlue) ||
                (this.writeAlpha !== writeAlpha)) {
                this.gl.colorMask(writeRed, writeGreen, writeBlue, writeAlpha);
                this.writeRed = writeRed;
                this.writeGreen = writeGreen;
                this.writeBlue = writeBlue;
                this.writeAlpha = writeAlpha;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#getBlending
         * @description Queries whether blending is enabled.
         * @returns {Boolean} True if blending is enabled and false otherwise.
         */
        getBlending: function () {
            return this.blending;
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setBlending
         * @description Enables or disables blending.
         * @param {Boolean} blending True to enable blending and false to disable it.
         */
        setBlending: function (blending) {
            if (this.blending !== blending) {
                var gl = this.gl;
                if (blending) {
                    gl.enable(gl.BLEND);
                } else {
                    gl.disable(gl.BLEND);
                }
                this.blending = blending;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setBlendFunction
         * @description Configures blending operations.
         * @param {pc.BLENDMODE} blendSrc The source blend function.
         * @param {pc.BLENDMODE} blendDst The destination blend function.
         */
        setBlendFunction: function (blendSrc, blendDst) {
            if ((this.blendSrc !== blendSrc) || (this.blendDst !== blendDst)) {
                this.gl.blendFunc(this.glBlendFunction[blendSrc], this.glBlendFunction[blendDst]);
                this.blendSrc = blendSrc;
                this.blendDst = blendDst;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setBlendEquation
         * @description Configures the blending equation. The default blend equation is
         * pc.BLENDEQUATION_ADD.
         * @param {pc.BLENDEQUATION} blendEquation The blend equation.
         */
        setBlendEquation: function (blendEquation) {
            if (this.blendEquation !== blendEquation) {
                var gl = this.gl;
                gl.blendEquation(this.glBlendEquation[blendEquation]);
                this.blendEquation = blendEquation;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setCullMode
         * @description Configures the cull mode. The default cull mode is
         * pc.CULLFACE_BACK.
         * @param {pc.CULLFACE} cullMode The cull mode.
         */
        setCullMode: function (cullMode) {
            if (this.cullMode !== cullMode) {
                var gl = this.gl;
                switch (cullMode) {
                    case pc.CULLFACE_NONE:
                        gl.disable(gl.CULL_FACE);
                        break;
                    case pc.CULLFACE_FRONT:
                        gl.enable(gl.CULL_FACE);
                        gl.cullFace(gl.FRONT);
                        break;
                    case pc.CULLFACE_BACK:
                        gl.enable(gl.CULL_FACE);
                        gl.cullFace(gl.BACK);
                        break;
                    case pc.CULLFACE_FRONTANDBACK:
                        gl.enable(gl.CULL_FACE);
                        gl.cullFace(gl.FRONT_AND_BACK);
                        break;
                }
                this.cullMode = cullMode;
            }
        },

        getCullMode: function () {
            return this.cullMode;
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setIndexBuffer
         * @description Sets the current index buffer on the graphics device. On subsequent
         * calls to pc.GraphicsDevice#draw, the specified index buffer will be used to provide
         * index data for any indexed primitives.
         * @param {pc.IndexBuffer} indexBuffer The index buffer to assign to the device.
         */
        setIndexBuffer: function (indexBuffer) {
            // Store the index buffer
            if (this.indexBuffer !== indexBuffer) {
                this.indexBuffer = indexBuffer;

                // Set the active index buffer object
                var gl = this.gl;
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer ? indexBuffer.bufferId : null);
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setVertexBuffer
         * @description Sets the current vertex buffer for a specific stream index on the graphics
         * device. On subsequent calls to pc.GraphicsDevice#draw, the specified vertex buffer will be
         * used to provide vertex data for any primitives.
         * @param {pc.VertexBuffer} vertexBuffer The vertex buffer to assign to the device.
         * @param {Number} stream The stream index for the vertex buffer, indexed from 0 upwards.
         */
        setVertexBuffer: function (vertexBuffer, stream) {
            if (this.vertexBuffers[stream] !== vertexBuffer) {
                // Store the vertex buffer for this stream index
                this.vertexBuffers[stream] = vertexBuffer;

                // Push each vertex element in scope
                var vertexFormat = vertexBuffer.getFormat();
                var i = 0;
                var elements = vertexFormat.elements;
                var numElements = elements.length;
                while (i < numElements) {
                    var vertexElement = elements[i++];
                    vertexElement.stream = stream;
                    vertexElement.scopeId.setValue(vertexElement);
                }

                this.attributesInvalidated = true;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setShader
         * @description Sets the active shader to be used during subsequent draw calls.
         * @param {pc.Shader} shader The shader to set to assign to the device.
         */
        setShader: function(shader) {
            if (shader !== this.shader) {
                this.shader = shader;

                if (! shader.ready)
                    shader.link();

                // Set the active shader
                this.gl.useProgram(shader.program);

                this.attributesInvalidated = true;
            }
        },

        /**
         * @private
         * @function
         * @name pc.GraphicsDevice#getBoneLimit
         * @description Queries the maximum number of bones that can be referenced by a shader.
         * The shader generators (pc.programlib) use this number to specify the matrix array
         * size of the uniform 'matrix_pose[0]'. The value is calculated based on the number of
         * available uniform vectors available after subtracting the number taken by a typical
         * heavyweight shader. If a different number is required, it can be tuned via
         * pc.GraphicsDevice#setBoneLimit.
         * @returns {Number} The maximum number of bones that can be supported by the host hardware.
         */
        getBoneLimit: function () {
            return this.boneLimit;
        },

        /**
         * @private
         * @function
         * @name pc.GraphicsDevice#setBoneLimit
         * @description Specifies the maximum number of bones that the device can support on
         * the current hardware. This function allows the default calculated value based on
         * available vector uniforms to be overridden.
         * @param {Number} maxBones The maximum number of bones supported by the host hardware.
         */
        setBoneLimit: function (maxBones) {
            this.boneLimit = maxBones;
        },

        /* DEPRECATED */
        enableValidation: function (enable) {
            console.warn('enableValidation: This function is deprecated and will be removed shortly.');
        },

        validate: function () {
            console.warn('validate: This function is deprecated and will be removed shortly.');
        },

        /**
        * @function
        * @name pc.GraphicsDevice#resizeCanvas
        * @description Sets the width and height of the canvas, then fires the 'resizecanvas' event.
        */
        resizeCanvas: function (width, height) {
            this._width = width;
            this._height = height;

            var ratio = Math.min(this._maxPixelRatio, window.devicePixelRatio);
            width *= ratio;
            height *= ratio;
            this.canvas.width = width;
            this.canvas.height = height;
            this.fire(EVENT_RESIZE, width, height);
        }
    };

    Object.defineProperty(GraphicsDevice.prototype, 'width', {
        get: function () { return this.gl.drawingBufferWidth || this.canvas.width; }
    });

    Object.defineProperty(GraphicsDevice.prototype, 'height', {
        get: function () { return this.gl.drawingBufferHeight || this.canvas.height; }
    });

    Object.defineProperty(GraphicsDevice.prototype, 'fullscreen', {
        get: function () { return !!document.fullscreenElement; },
        set: function (fullscreen) {
            if (fullscreen) {
                var canvas = this.gl.canvas;
                canvas.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        }
    });

    Object.defineProperty(GraphicsDevice.prototype, 'maxAnisotropy', {
        get: ( function () {
            var maxAniso;

            return function () {
                if (maxAniso === undefined) {
                    maxAniso = 1;

                    var gl = this.gl;
                    var glExt = this.extTextureFilterAnisotropic;
                    if (glExt) {
                        maxAniso = gl.getParameter(glExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
                    }
                }

                return maxAniso;
            }
        } )()
    });

    Object.defineProperty(GraphicsDevice.prototype, 'maxPixelRatio', {
        get: function () { return this._maxPixelRatio; },
        set: function (ratio) {
            this._maxPixelRatio = ratio;
            this.resizeCanvas(this._width, this._height);
        }
    });

    return {
        UnsupportedBrowserError: UnsupportedBrowserError,
        ContextCreationError: ContextCreationError,
        GraphicsDevice: GraphicsDevice,
        precalculatedTangents: true
    };
}());
