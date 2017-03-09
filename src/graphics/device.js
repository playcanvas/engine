pc.extend(pc, function () {
    'use strict';

    var EVENT_RESIZE = 'resizecanvas';
    var uniformValue;
    var scopeX, scopeY, scopeZ, scopeW;

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
    }

    var _pixelFormat2Size = null;

    function gpuTexSize(gl, tex) {
        if (!_pixelFormat2Size) {
            _pixelFormat2Size = {};
            _pixelFormat2Size[pc.PIXELFORMAT_A8] = 1;
            _pixelFormat2Size[pc.PIXELFORMAT_L8] = 1;
            _pixelFormat2Size[pc.PIXELFORMAT_L8_A8] = 1;
            _pixelFormat2Size[pc.PIXELFORMAT_R5_G6_B5] = 2;
            _pixelFormat2Size[pc.PIXELFORMAT_R5_G5_B5_A1] = 2;
            _pixelFormat2Size[pc.PIXELFORMAT_R4_G4_B4_A4] = 2;
            _pixelFormat2Size[pc.PIXELFORMAT_R8_G8_B8] = 4;
            _pixelFormat2Size[pc.PIXELFORMAT_R8_G8_B8_A8] = 4;
            _pixelFormat2Size[pc.PIXELFORMAT_RGB16F] = 8;
            _pixelFormat2Size[pc.PIXELFORMAT_RGBA16F] = 8;
            _pixelFormat2Size[pc.PIXELFORMAT_RGB32F] = 16;
            _pixelFormat2Size[pc.PIXELFORMAT_RGBA32F] = 16;
            _pixelFormat2Size[pc.PIXELFORMAT_R32F] = 4;
            _pixelFormat2Size[pc.PIXELFORMAT_DEPTH] = 4; // can be smaller using WebGL1 extension?
            _pixelFormat2Size[pc.PIXELFORMAT_DEPTHSTENCIL] = 4;
            _pixelFormat2Size[pc.PIXELFORMAT_111110F] = 4;
            _pixelFormat2Size[pc.PIXELFORMAT_SRGB] = 4;
            _pixelFormat2Size[pc.PIXELFORMAT_SRGBA] = 4;
        }

        var mips = 1;
        if (tex._pot && (tex._mipmaps || tex._minFilter === gl.NEAREST_MIPMAP_NEAREST ||
            tex._minFilter === gl.NEAREST_MIPMAP_LINEAR || tex._minFilter === gl.LINEAR_MIPMAP_NEAREST ||
            tex._minFilter === gl.LINEAR_MIPMAP_LINEAR) && ! (tex._compressed && tex._levels.length === 1)) {

            mips = Math.round(Math.log2(Math.max(tex._width, tex._height)) + 1);
        }
        var mipWidth = tex._width;
        var mipHeight = tex._height;
        var mipDepth = tex._depth;
        var size = 0;

        for(var i=0; i<mips; i++) {
            if (! tex._compressed) {
                size += mipWidth * mipHeight * mipDepth * _pixelFormat2Size[tex._format];
            } else if (tex._format === pc.PIXELFORMAT_ETC1) {
                size += Math.floor((mipWidth + 3) / 4) * Math.floor((mipHeight + 3) / 4) * 8 * mipDepth;
            } else if (tex._format === pc.PIXELFORMAT_PVRTC_2BPP_RGB_1 || tex._format === pc.PIXELFORMAT_PVRTC_2BPP_RGBA_1) {
                size += Math.max(mipWidth, 16) * Math.max(mipHeight, 8) / 4 * mipDepth;
            } else if (tex._format === pc.PIXELFORMAT_PVRTC_4BPP_RGB_1 || tex._format === pc.PIXELFORMAT_PVRTC_4BPP_RGBA_1) {
                size += Math.max(mipWidth, 8) * Math.max(mipHeight, 8) / 2 * mipDepth;
            } else {
                var DXT_BLOCK_WIDTH = 4;
                var DXT_BLOCK_HEIGHT = 4;
                var blockSize = tex._format === pc.PIXELFORMAT_DXT1? 8 : 16;
                var numBlocksAcross = Math.floor((mipWidth + DXT_BLOCK_WIDTH - 1) / DXT_BLOCK_WIDTH);
                var numBlocksDown = Math.floor((mipHeight + DXT_BLOCK_HEIGHT - 1) / DXT_BLOCK_HEIGHT);
                var numBlocks = numBlocksAcross * numBlocksDown;
                size += numBlocks * blockSize * mipDepth;
            }
            mipWidth = Math.max(mipWidth * 0.5, 1);
            mipHeight = Math.max(mipHeight * 0.5, 1);
            mipDepth = Math.max(mipDepth * 0.5, 1);
        }

        if (tex._cubemap) size *= 6;
        return size;
    }

    function testRenderable(gl, ext, pixelFormat) {
        var __texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, __texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        var __width = 2;
        var __height = 2;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, __width, __height, 0, gl.RGBA, pixelFormat, null);

        // Try to use this texture as a render target.
        var __fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, __fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, __texture, 0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        // It is legal for a WebGL implementation exposing the OES_texture_float extension to
        // support floating-point textures but not as attachments to framebuffer objects.
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
            gl.deleteTexture(__texture);
            return false;
        }
        gl.deleteTexture(__texture);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return true;
    }

    /**
     * @name pc.GraphicsDevice
     * @class The graphics device manages the underlying graphics context. It is responsible
     * for submitting render state changes and graphics primitives to the hardware. A graphics
     * device is tied to a specific canvas HTML element. It is valid to have more than one
     * canvas element per page and create a new graphics device against each.
     * @description Creates a new graphics device.
     * @param {Object} canvas The canvas to which the graphics device is tied.
     * @param {Object} [options] Options passed when creating the WebGL context. More info here https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
     */
    /**
     * @readonly
     * @name pc.GraphicsDevice#precision
     * @type String
     * @description The highest shader precision supported by this graphics device. Can be 'hiphp', 'mediump' or 'lowp'.
     */
    /**
     * @readonly
     * @name pc.GraphicsDevice#maxCubeMapSize
     * @type Number
     * @description The maximum supported dimension of a cube map.
     */
    /**
     * @readonly
     * @name pc.GraphicsDevice#maxTextureSize
     * @type Number
     * @description The maximum supported dimension of a texture.
     */
    /**
     * @readonly
     * @name pc.GraphicsDevice#maxVolumeSize
     * @type Number
     * @description The maximum supported dimension of a 3D texture (any axis).
     */
    /**
     * @event
     * @name pc.GraphicsDevice#resizecanvas
     * @description The 'resizecanvas' event is fired when the canvas is resized
     * @param {Number} width The new width of the canvas in pixels
     * @param {Number} height The new height of the canvas in pixels
    */
    var GraphicsDevice = function (canvas, options) {
        this.gl = undefined;
        this.canvas = canvas;
        this.shader = null;
        this.indexBuffer = null;
        this.vertexBuffers = [ ];
        this.vbOffsets = [ ];
        this.precision = "highp";
        this._enableAutoInstancing = false;
        this.autoInstancingMaxObjects = 16384;
        this.attributesInvalidated = true;
        this.boundBuffer = null;
        this.instancedAttribs = { };
        this.enabledAttributes = { };
        this.textureUnits = [ ];
        this.commitFunction = { };
        this._maxPixelRatio = 1;
        // local width/height without pixelRatio applied
        this._width = 0;
        this._height = 0;

        this.updateClientRect();

        if (! window.WebGLRenderingContext)
            throw new pc.UnsupportedBrowserError();

        // Retrieve the WebGL context
        if (canvas)
            var preferWebGl2 = (options && options.preferWebGl2 !== undefined) ? options.preferWebGl2 : true;

            var names = preferWebGl2 ? ["webgl2", "experimental-webgl2", "webgl", "experimental-webgl"] :
                                       ["webgl", "experimental-webgl"];
            var context = null;
            options = options || {};
            options.stencil = true;
            for (var i = 0; i < names.length; i++) {
                try {
                    context = canvas.getContext(names[i], options);
                } catch(e) { }

                if (context) {
                    this.webgl2 = preferWebGl2 && i < 2;
                    break;
                }
            }
            this.gl = context;

        if (!this.gl)
            throw new pc.ContextCreationError();

        var gl = this.gl;

        // put the rest of the contructor in a function
        // so that the constructor remains small. Small constructors
        // are optimized by Firefox due to type inference
        (function() {
            var i;

            canvas.addEventListener("webglcontextlost", _contextLostHandler, false);
            canvas.addEventListener("webglcontextrestored", _contextRestoredHandler, false);

            this.canvas = canvas;
            this.shader = null;
            this.indexBuffer = null;
            this.vertexBuffers = [ ];
            this.vbOffsets = [ ];
            this.precision = "highp";

            this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            this.maxCubeMapSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
            this.maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);

            // Query the precision supported by ints and floats in vertex and fragment shaders.
            // Note that getShaderPrecisionFormat is not guaranteed to be present (such as some
            // instances of the default Android browser). In this case, assume highp is available.
            if (gl.getShaderPrecisionFormat) {
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
            }

            this.maxPrecision = this.precision;

            this.defaultClearOptions = {
                color: [0, 0, 0, 1],
                depth: 1,
                stencil: 0,
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
                // MIN - added later
                // MAX - added later
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

            this.glComparison = [
                gl.NEVER,
                gl.LESS,
                gl.EQUAL,
                gl.LEQUAL,
                gl.GREATER,
                gl.NOTEQUAL,
                gl.GEQUAL,
                gl.ALWAYS
            ];

            this.glStencilOp = [
                gl.KEEP,
                gl.ZERO,
                gl.REPLACE,
                gl.INCR,
                gl.INCR_WRAP,
                gl.DECR,
                gl.DECR_WRAP,
                gl.INVERT
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

            this.glCull = [
                0,
                gl.BACK,
                gl.FRONT,
                gl.FRONT_AND_BACK
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
            this.unmaskedRenderer = null;
            this.unmaskedVendor = null;
            this.extRendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (this.extRendererInfo) {
                this.unmaskedRenderer = gl.getParameter(this.extRendererInfo.UNMASKED_RENDERER_WEBGL);
                this.unmaskedVendor = gl.getParameter(this.extRendererInfo.UNMASKED_VENDOR_WEBGL);
            }

            // These features should be guaranteed in WebGL2, but are extensions in WebGL1
            if (this.webgl2) {
                this.extTextureFloat = true;
                this.extTextureHalfFloat = true;
                this.extTextureHalfFloatLinear = true;
                this.extUintElement = true;
                this.extTextureLod = true;
                this.extDepthTexture = false;
                this.extStandardDerivatives = true;
                gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.NICEST);
                this.extInstancing = true;
                this.extDrawBuffers = true;
                this.maxDrawBuffers = gl.getParameter(gl.MAX_DRAW_BUFFERS);
                this.maxColorAttachments = gl.getParameter(gl.MAX_COLOR_ATTACHMENTS);
                this.feedback = gl.createTransformFeedback();
                this.maxVolumeSize = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
                this.extBlendMinmax = true;
                this.glBlendEquation.push(gl.MIN);
                this.glBlendEquation.push(gl.MAX);
            } else {
                this.extTextureFloat = gl.getExtension("OES_texture_float");
                this.extTextureHalfFloat = gl.getExtension("OES_texture_half_float");
                this.extTextureHalfFloatLinear = gl.getExtension("OES_texture_half_float_linear");
                this.extUintElement = gl.getExtension("OES_element_index_uint");
                this.extTextureLod = gl.getExtension('EXT_shader_texture_lod');
                this.extDepthTexture = false;/*gl.getExtension("WEBKIT_WEBGL_depth_texture") ||
                                       gl.getExtension('WEBGL_depth_texture');*/
                this.extStandardDerivatives = gl.getExtension("OES_standard_derivatives");
                if (this.extStandardDerivatives) {
                    gl.hint(this.extStandardDerivatives.FRAGMENT_SHADER_DERIVATIVE_HINT_OES, gl.NICEST);
                }
                this.extInstancing = gl.getExtension("ANGLE_instanced_arrays");
                this.extDrawBuffers = gl.getExtension('EXT_draw_buffers');
                this.maxDrawBuffers = this.extDrawBuffers ? gl.getParameter(this.extDrawBuffers.MAX_DRAW_BUFFERS_EXT) : 1;
                this.maxColorAttachments = this.extDrawBuffers ? gl.getParameter(this.extDrawBuffers.MAX_COLOR_ATTACHMENTS_EXT) : 1;
                this.maxVolumeSize = 1;
                this.extBlendMinmax = gl.getExtension("EXT_blend_minmax");
                if (this.extBlendMinmax) {
                    this.glBlendEquation.push(this.extBlendMinmax.MIN_EXT);
                    this.glBlendEquation.push(this.extBlendMinmax.MAX_EXT);
                } else {
                    // Fallback when don't have minmax
                    this.glBlendEquation.push(gl.FUNC_ADD);
                    this.glBlendEquation.push(gl.FUNC_ADD);
                }
            }

            this.extTextureFloatLinear = gl.getExtension("OES_texture_float_linear");

            this.maxVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
            this.supportsBoneTextures = this.extTextureFloat && this.maxVertexTextures > 0;

            this.fragmentUniformsCount = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
            this.samplerCount = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);

            this.useTexCubeLod = this.extTextureLod && this.samplerCount < 16;

            this.extTextureFilterAnisotropic = gl.getExtension('EXT_texture_filter_anisotropic');
            if (!this.extTextureFilterAnisotropic)
                this.extTextureFilterAnisotropic = gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');

            this.extCompressedTextureS3TC = gl.getExtension('WEBGL_compressed_texture_s3tc');
            if (!this.extCompressedTextureS3TC)
                this.extCompressedTextureS3TC = gl.getExtension('WEBKIT_WEBGL_compressed_texture_s3tc');

            // IE 11 can't use mip maps with S3TC
            if (this.extCompressedTextureS3TC && _isIE())
                this.extCompressedTextureS3TC = false;

            if (this.extCompressedTextureS3TC) {
                var formats = gl.getParameter(gl.COMPRESSED_TEXTURE_FORMATS);
                for (i = 0; i < formats.length; i++) {
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

            this.extCompressedTextureETC1 = gl.getExtension('WEBGL_compressed_texture_etc1');
            this.extCompressedTexturePVRTC = gl.getExtension('WEBGL_compressed_texture_pvrtc') ||
                                             gl.getExtension('WEBKIT_WEBGL_compressed_texture_pvrtc');

            var contextAttribs = gl.getContextAttributes();
            this.supportsMsaa = contextAttribs.antialias;
            this.supportsStencil = contextAttribs.stencil;

            // Create the default render target
            this.renderTarget = null;

            // Create the ScopeNamespace for shader attributes and variables
            this.scope = new pc.ScopeSpace("Device");

            // Define the uniform commit functions
            this.commitFunction = {};
            this.commitFunction[pc.UNIFORMTYPE_BOOL] = function (uniform, value) {
                if (uniform.value !== value) {
                    gl.uniform1i(uniform.locationId, value);
                    uniform.value = value;
                }
            };
            this.commitFunction[pc.UNIFORMTYPE_INT] = this.commitFunction[pc.UNIFORMTYPE_BOOL];
            this.commitFunction[pc.UNIFORMTYPE_FLOAT] = function (uniform, value) {
                if (uniform.value !== value) {
                    gl.uniform1f(uniform.locationId, value);
                    uniform.value = value;
                }
            };
            this.commitFunction[pc.UNIFORMTYPE_VEC2]  = function (uniform, value) {
                uniformValue = uniform.value;
                scopeX = value[0];
                scopeY = value[1];
                if (uniformValue[0]!==scopeX || uniformValue[1]!==scopeY) {
                    gl.uniform2fv(uniform.locationId, value);
                    uniformValue[0] = scopeX;
                    uniformValue[1] = scopeY;
                }
            };
            this.commitFunction[pc.UNIFORMTYPE_VEC3]  = function (uniform, value) {
                uniformValue = uniform.value;
                scopeX = value[0];
                scopeY = value[1];
                scopeZ = value[2];
                if (uniformValue[0]!==scopeX || uniformValue[1]!==scopeY || uniformValue[2]!==scopeZ) {
                    gl.uniform3fv(uniform.locationId, value);
                    uniformValue[0] = scopeX;
                    uniformValue[1] = scopeY;
                    uniformValue[2] = scopeZ;
                }
            };
            this.commitFunction[pc.UNIFORMTYPE_VEC4]  = function (uniform, value) {
                uniformValue = uniform.value;
                scopeX = value[0];
                scopeY = value[1];
                scopeZ = value[2];
                scopeW = value[3];
                if (uniformValue[0]!==scopeX || uniformValue[1]!==scopeY || uniformValue[2]!==scopeZ || uniformValue[3]!==scopeW) {
                    gl.uniform4fv(uniform.locationId, value);
                    uniformValue[0] = scopeX;
                    uniformValue[1] = scopeY;
                    uniformValue[2] = scopeZ;
                    uniformValue[3] = scopeW;
                }
            };
            this.commitFunction[pc.UNIFORMTYPE_IVEC2] = function (uniform, value) {
                uniformValue = uniform.value;
                scopeX = value[0];
                scopeY = value[1];
                if (uniformValue[0]!==scopeX || uniformValue[1]!==scopeY) {
                    gl.uniform2iv(uniform.locationId, value);
                    uniformValue[0] = scopeX;
                    uniformValue[1] = scopeY;
                }
            };
            this.commitFunction[pc.UNIFORMTYPE_BVEC2] = this.commitFunction[pc.UNIFORMTYPE_IVEC2];
            this.commitFunction[pc.UNIFORMTYPE_IVEC3] = function (uniform, value) {
                uniformValue = uniform.value;
                scopeX = value[0];
                scopeY = value[1];
                scopeZ = value[2];
                if (uniformValue[0]!==scopeX || uniformValue[1]!==scopeY || uniformValue[2]!==scopeZ) {
                    gl.uniform3iv(uniform.locationId, value);
                    uniformValue[0] = scopeX;
                    uniformValue[1] = scopeY;
                    uniformValue[2] = scopeZ;
                }
            };
            this.commitFunction[pc.UNIFORMTYPE_BVEC3] = this.commitFunction[pc.UNIFORMTYPE_IVEC3];
            this.commitFunction[pc.UNIFORMTYPE_IVEC4] = function (uniform, value) {
                uniformValue = uniform.value;
                scopeX = value[0];
                scopeY = value[1];
                scopeZ = value[2];
                scopeW = value[3];
                if (uniformValue[0]!==scopeX || uniformValue[1]!==scopeY || uniformValue[2]!==scopeZ || uniformValue[3]!==scopeW) {
                    gl.uniform4iv(uniform.locationId, value);
                    uniformValue[0] = scopeX;
                    uniformValue[1] = scopeY;
                    uniformValue[2] = scopeZ;
                    uniformValue[3] = scopeW;
                }
            };
            this.commitFunction[pc.UNIFORMTYPE_BVEC4] = this.commitFunction[pc.UNIFORMTYPE_IVEC4];
            this.commitFunction[pc.UNIFORMTYPE_MAT2]  = function (uniform, value) { gl.uniformMatrix2fv(uniform.locationId, false, value); };
            this.commitFunction[pc.UNIFORMTYPE_MAT3]  = function (uniform, value) { gl.uniformMatrix3fv(uniform.locationId, false, value); };
            this.commitFunction[pc.UNIFORMTYPE_MAT4]  = function (uniform, value) { gl.uniformMatrix4fv(uniform.locationId, false, value); };
            this.commitFunction[pc.UNIFORMTYPE_FLOATARRAY] = function (uniform, value) {
                gl.uniform1fv(uniform.locationId, value);
            };

            // Set the initial render state
            this.setBlending(false);
            this.setBlendFunction(pc.BLENDMODE_ONE, pc.BLENDMODE_ZERO);
            this.setBlendEquation(pc.BLENDEQUATION_ADD);
            this.setColorWrite(true, true, true, true);
            this.cullMode = pc.CULLFACE_NONE;
            this.setCullMode(pc.CULLFACE_BACK);
            this.setDepthTest(true);
            this.setDepthFunc(pc.FUNC_LESSEQUAL);
            this.setDepthWrite(true);
            this.setStencilTest(false);
            this.setStencilFunc(pc.FUNC_ALWAYS, 0, 0xFF);
            this.setStencilOperation(pc.STENCILOP_KEEP, pc.STENCILOP_KEEP, pc.STENCILOP_KEEP, 0xFF);
            this.setAlphaToCoverage(false);
            this.setTransformFeedbackBuffer(null);
            this.setRaster(true);

            this.setClearDepth(1);
            this.setClearColor(0, 0, 0, 0);
            this.setClearStencil(0);

            gl.enable(gl.SCISSOR_TEST);

            this.programLib = new pc.ProgramLibrary(this);
            for (var generator in pc.programlib)
                this.programLib.register(generator, pc.programlib[generator]);

            // Calculate a estimate of the maximum number of bones that can be uploaded to the GPU
            // based on the number of available uniforms and the number of uniforms required for non-
            // bone data.  This is based off of the Standard shader.  A user defined shader may have
            // even less space available for bones so this calculated value can be overridden via
            // pc.GraphicsDevice.setBoneLimit.
            var numUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
            numUniforms -= 4 * 4; // Model, view, projection and shadow matrices
            numUniforms -= 8;     // 8 lights max, each specifying a position vector
            numUniforms -= 1;     // Eye position
            numUniforms -= 4 * 4; // Up to 4 texture transforms
            this.boneLimit = Math.floor(numUniforms / 4);

            // Put a limit on the number of supported bones before skin partitioning must be performed
            // Some GPUs have demonstrated performance issues if the number of vectors allocated to the
            // skin matrix palette is left unbounded
            this.boneLimit = Math.min(this.boneLimit, 128);

            if (this.unmaskedRenderer === 'Mali-450 MP') {
                this.boneLimit = 34;
            } else if (this.unmaskedRenderer === 'Apple A8 GPU') {
                this.forceCpuParticles = true;
            }

            pc.events.attach(this);

            // Cached viewport and scissor dimensions
            this.vx = this.vy = this.vw = this.vh = 0;
            this.sx = this.sy = this.sw = this.sh = 0;

            this.boundBuffer = null;
            this.instancedAttribs = {};

            this.activeFramebuffer = null;

            this.activeTexture = 0;
            this.textureUnits = [];

            this.attributesInvalidated = true;

            this.enabledAttributes = {};

            this._drawCallsPerFrame = 0;
            this._shaderSwitchesPerFrame = 0;
            this._primsPerFrame = [];
            for(i=pc.PRIMITIVE_POINTS; i<=pc.PRIMITIVE_TRIFAN; i++) {
                this._primsPerFrame[i] = 0;
            }
            this._renderTargetCreationTime = 0;

            this._vram = {
                // #ifdef PROFILER
                texShadow: 0,
                texAsset: 0,
                texLightmap: 0,
                // #endif
                tex: 0,
                vb: 0,
                ib: 0
            };

            this._shaderStats = {
                vsCompiled: 0,
                fsCompiled: 0,
                linked: 0,
                materialShaders: 0,
                compileTime: 0
            };

            // Handle IE11's inability to take UNSIGNED_BYTE as a param for vertexAttribPointer
            var bufferId = gl.createBuffer();
            var storage = new ArrayBuffer(16);
            gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
            gl.bufferData(gl.ARRAY_BUFFER, storage, gl.STATIC_DRAW);
            gl.getError(); // Clear error flag
            gl.vertexAttribPointer(0, 4, gl.UNSIGNED_BYTE, false, 4, 0);
            this.supportsUnsignedByte = (gl.getError() === 0);
            gl.deleteBuffer(bufferId);

            if (!pc._benchmarked) {
                if (this.extTextureFloat) {
                    if (this.webgl2) {
                        // In WebGL2 float texture renderability is dictated by the EXT_color_buffer_float extension
                        this.extTextureFloatRenderable = gl.getExtension("EXT_color_buffer_float");
                    } else {
                        // In WebGL1 we should just try rendering into a float texture
                        this.extTextureFloatRenderable = testRenderable(gl, this.extTextureFloat, gl.FLOAT);
                    }
                }
                if (this.extTextureHalfFloat) {
                    if (this.webgl2) {
                        // EXT_color_buffer_float should affect both float and halffloat formats
                        this.extTextureHalfFloatRenderable = this.extTextureFloatRenderable;
                    } else {
                        // Manual render check for half float
                        this.extTextureHalfFloatRenderable = testRenderable(gl, this.extTextureHalfFloat, this.extTextureHalfFloat.HALF_FLOAT_OES);
                    }
                }
                if (this.extTextureFloatRenderable) {
                    var device = this;
                    var chunks = pc.shaderChunks;
                    var test1 = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, chunks.precisionTestPS, "ptest1");
                    var test2 = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, chunks.precisionTest2PS, "ptest2");
                    var size = 1;

                    var tex = new pc.Texture(device, {
                        format: pc.PIXELFORMAT_RGBA32F,
                        width: size,
                        height: size,
                        mipmaps: false,
                        minFilter: pc.FILTER_NEAREST,
                        magFilter: pc.FILTER_NEAREST
                    });
                    var targ = new pc.RenderTarget(device, tex, {
                        depth: false
                    });
                    pc.drawQuadWithShader(device, targ, test1);

                    var tex2 = new pc.Texture(device, {
                        format: pc.PIXELFORMAT_R8_G8_B8_A8,
                        width: size,
                        height: size,
                        mipmaps: false,
                        minFilter: pc.FILTER_NEAREST,
                        magFilter: pc.FILTER_NEAREST
                    });
                    var targ2 = new pc.RenderTarget(device, tex2, {
                        depth: false
                    });
                    var constantTexSource = device.scope.resolve("source");
                    constantTexSource.setValue(tex);
                    pc.drawQuadWithShader(device, targ2, test2);

                    var pixels = new Uint8Array(size * size * 4);
                    gl.bindFramebuffer(gl.FRAMEBUFFER, targ2._glFrameBuffer);
                    gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

                    var x = pixels[0] / 255.0;
                    var y = pixels[1] / 255.0;
                    var z = pixels[2] / 255.0;
                    var w = pixels[3] / 255.0;
                    var f = x/(256.0 * 256.0 * 256.0) + y/(256.0 * 256.0) + z/256.0 + w;

                    this.extTextureFloatHighPrecision = f===0.0;

                    tex.destroy();
                    targ.destroy();
                    tex2.destroy();
                    targ2.destroy();
                    pc.destroyPostEffectQuad();
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                }
                pc.extTextureFloatRenderable = this.extTextureFloatRenderable;
                pc.extTextureHalfFloatRenderable = this.extTextureHalfFloatRenderable;
                pc.extTextureFloatHighPrecision = this.extTextureFloatHighPrecision;
                pc._benchmarked = true;
            } else {
                this.extTextureFloatRenderable = pc.extTextureFloatRenderable;
                this.extTextureHalfFloatRenderable = pc.extTextureHalfFloatRenderable;
                this.extTextureFloatHighPrecision = pc.extTextureFloatHighPrecision;
            }

        }).call(this);
    };

    GraphicsDevice.prototype = {
        updateClientRect: function () {
            this.clientRect = this.canvas.getBoundingClientRect();
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setViewport
         * @description Set the active rectangle for rendering on the specified device.
         * @param {Number} x The pixel space x-coordinate of the bottom left corner of the viewport.
         * @param {Number} y The pixel space y-coordinate of the bottom left corner of the viewport.
         * @param {Number} w The width of the viewport in pixels.
         * @param {Number} h The height of the viewport in pixels.
         */
        setViewport: function (x, y, w, h) {
            if ((this.vx !== x) || (this.vy !== y) || (this.vw !== w) || (this.vh !== h)) {
                this.gl.viewport(x, y, w, h);
                this.vx = x;
                this.vy = y;
                this.vw = w;
                this.vh = h;
            }
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
        setScissor: function (x, y, w, h) {
            if ((this.sx !== x) || (this.sy !== y) || (this.sw !== w) || (this.sh !== h)) {
                this.gl.scissor(x, y, w, h);
                this.sx = x;
                this.sy = y;
                this.sw = w;
                this.sh = h;
            }
        },

        /**
         * @private
         * @function
         * @name pc.GraphicsDevice#getProgramLibrary
         * @description Retrieves the program library assigned to the specified graphics device.
         * @returns {pc.ProgramLibrary} The program library assigned to the device.
         */
        getProgramLibrary: function () {
            return this.programLib;
        },

        /**
         * @private
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

        setFramebuffer: function (fb) {
            if (this.activeFramebuffer !== fb) {
                this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb);
                this.activeFramebuffer = fb;
            }
        },

        _checkFbo: function () {
            // Ensure all is well
            var gl = this.gl;
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

                    // #ifdef PROFILER
                    var startTime = pc.now();
                    this.fire('fbo:create', {
                        timestamp: startTime,
                        target: this
                    });
                    // #endif

                    // Set RT's device
                    target._device = this;

                    // ##### Create main FBO #####
                    target._glFrameBuffer = gl.createFramebuffer();
                    this.setFramebuffer(target._glFrameBuffer);

                    // --- Init the provided color buffer (optional) ---
                    var colorBuffer = target._colorBuffer;
                    if (colorBuffer) {
                        if (!colorBuffer._glTextureId) {
                            // Clamp the render buffer size to the maximum supported by the device
                            colorBuffer._width = Math.min(colorBuffer.width, this.maxRenderBufferSize);
                            colorBuffer._height = Math.min(colorBuffer.height, this.maxRenderBufferSize);
                            this.setTexture(colorBuffer, 0);
                        }
                        // Attach the color buffer
                        gl.framebufferTexture2D(
                            gl.FRAMEBUFFER,
                            gl.COLOR_ATTACHMENT0,
                            colorBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D,
                            colorBuffer._glTextureId,
                            0
                        );
                    }

                    var depthBuffer = target._depthBuffer;
                    if (depthBuffer && this.webgl2) {
                        // --- Init the provided depth/stencil buffer (optional, WebGL2 only) ---
                        if (!depthBuffer._glTextureId) {
                            // Clamp the render buffer size to the maximum supported by the device
                            depthBuffer._width = Math.min(depthBuffer.width, this.maxRenderBufferSize);
                            depthBuffer._height = Math.min(depthBuffer.height, this.maxRenderBufferSize);
                            this.setTexture(depthBuffer, 0);
                        }
                        // Attach
                        if (target._stencil) {
                            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT,
                                depthBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D,
                                target._depthBuffer._glTextureId, 0);
                        } else {
                            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
                                depthBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D,
                                target._depthBuffer._glTextureId, 0);
                        }
                    } else if (target._depth) {
                        // --- Init a new depth/stencil buffer (optional) ---
                        // if this is a MSAA RT, and no buffer to resolve to, skip creating non-MSAA depth
                        var willRenderMsaa = target._samples > 1 && this.webgl2;
                        if (!willRenderMsaa) {
                            if (!target._glDepthBuffer) {
                                target._glDepthBuffer = gl.createRenderbuffer();
                            }
                            gl.bindRenderbuffer(gl.RENDERBUFFER, target._glDepthBuffer);
                            if (target._stencil) {
                                gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, target.width, target.height);
                                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, target._glDepthBuffer);
                            } else {
                                gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, target.width, target.height);
                                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, target._glDepthBuffer);
                            }
                            gl.bindRenderbuffer(gl.RENDERBUFFER, null);
                        }
                    }

                    // #ifdef DEBUG
                    this._checkFbo();
                    // #endif

                    // ##### Create MSAA FBO (WebGL2 only) #####
                    if (this.webgl2 && target._samples > 1) {

                        // Use previous FBO for resolves
                        target._glResolveFrameBuffer = target._glFrameBuffer;

                        // Actual FBO will be MSAA
                        target._glFrameBuffer = gl.createFramebuffer();
                        this.setFramebuffer(target._glFrameBuffer);

                        // Create an optional MSAA color buffer
                        if (colorBuffer) {
                            if (!target._glMsaaColorBuffer) {
                                target._glMsaaColorBuffer = gl.createRenderbuffer();
                            }
                            gl.bindRenderbuffer(gl.RENDERBUFFER, target._glMsaaColorBuffer);
                            gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, colorBuffer._glInternalFormat, target.width, target.height);
                            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, target._glMsaaColorBuffer);
                        }

                        // Optionally add a MSAA depth/stencil buffer
                        if (target._depth) {
                            if (!target._glMsaaDepthBuffer) {
                                target._glMsaaDepthBuffer = gl.createRenderbuffer();
                            }
                            gl.bindRenderbuffer(gl.RENDERBUFFER, target._glMsaaDepthBuffer);
                            if (target._stencil) {
                                gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, gl.DEPTH24_STENCIL8, target.width, target.height);
                                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, target._glMsaaDepthBuffer);
                            } else {
                                gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, gl.DEPTH_COMPONENT32F, target.width, target.height);
                                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, target._glMsaaDepthBuffer);
                            }
                        }
                        // #ifdef DEBUG
                        this._checkFbo();
                        // #endif
                    }

                    // #ifdef PROFILER
                    this._renderTargetCreationTime += pc.now() - startTime;
                    // #endif

                } else {
                    this.setFramebuffer(target._glFrameBuffer);
                }
            } else {
                this.setFramebuffer(null);
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
                // Switch rendering back to the back buffer
                //this.setFramebuffer(null); // disabled - not needed?

                // If the active render target is auto-mipmapped, generate its mip chain
                var colorBuffer = target._colorBuffer;
                if (colorBuffer && colorBuffer._glTextureId && colorBuffer.mipmaps && colorBuffer._pot) {
                    gl.bindTexture(colorBuffer._glTarget, colorBuffer._glTextureId);
                    gl.generateMipmap(colorBuffer._glTarget);
                }

                // Resolve MSAA if needed
                if (this.webgl2 && target._samples > 1 && target.autoResolve) {
                    target.resolve();
                }
            }
        },

        initializeTexture: function (texture) {
            var gl = this.gl;
            var ext;

            texture._glTextureId = gl.createTexture();

            texture._glTarget = texture._cubemap ? gl.TEXTURE_CUBE_MAP :
                                (texture._volume? gl.TEXTURE_3D : gl.TEXTURE_2D);


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
                case pc.PIXELFORMAT_PVRTC_2BPP_RGB_1:
                    ext = this.extCompressedTexturePVRTC;
                    texture._glFormat = gl.RGB;
                    texture._glInternalFormat = ext.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;
                    break;
                case pc.PIXELFORMAT_PVRTC_2BPP_RGBA_1:
                    ext = this.extCompressedTexturePVRTC;
                    texture._glFormat = gl.RGBA;
                    texture._glInternalFormat = ext.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG;
                    break;
                case pc.PIXELFORMAT_PVRTC_4BPP_RGB_1:
                    ext = this.extCompressedTexturePVRTC;
                    texture._glFormat = gl.RGB;
                    texture._glInternalFormat = ext.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;
                    break;
                case pc.PIXELFORMAT_PVRTC_4BPP_RGBA_1:
                    ext = this.extCompressedTexturePVRTC;
                    texture._glFormat = gl.RGBA;
                    texture._glInternalFormat = ext.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;
                    break;
                case pc.PIXELFORMAT_RGB16F:
                    // definition varies between WebGL1 and 2
                    ext = this.extTextureHalfFloat;
                    texture._glFormat = gl.RGB;
                    if (this.webgl2) {
                        texture._glInternalFormat = gl.RGB16F;
                        texture._glPixelType = gl.HALF_FLOAT;
                    } else {
                        texture._glInternalFormat = gl.RGB;
                        texture._glPixelType = ext.HALF_FLOAT_OES;
                    }
                    break;
                case pc.PIXELFORMAT_RGBA16F:
                    // definition varies between WebGL1 and 2
                    ext = this.extTextureHalfFloat;
                    texture._glFormat = gl.RGBA;
                    if (this.webgl2) {
                        texture._glInternalFormat = gl.RGBA16F;
                        texture._glPixelType = gl.HALF_FLOAT;
                    } else {
                        texture._glInternalFormat = gl.RGBA;
                        texture._glPixelType = ext.HALF_FLOAT_OES;
                    }
                    break;
                case pc.PIXELFORMAT_RGB32F:
                    // definition varies between WebGL1 and 2
                    texture._glFormat = gl.RGB;
                    if (this.webgl2) {
                        texture._glInternalFormat = gl.RGB32F;
                    } else {
                        texture._glInternalFormat = gl.RGB;
                    }
                    texture._glPixelType = gl.FLOAT;
                    break;
                case pc.PIXELFORMAT_RGBA32F:
                    // definition varies between WebGL1 and 2
                    texture._glFormat = gl.RGBA;
                    if (this.webgl2) {
                        texture._glInternalFormat = gl.RGBA32F;
                    } else {
                        texture._glInternalFormat = gl.RGBA;
                    }
                    texture._glPixelType = gl.FLOAT;
                    break;
                case pc.PIXELFORMAT_R32F: // WebGL2 only
                    texture._glFormat = gl.RED;
                    texture._glInternalFormat = gl.R32F;
                    texture._glPixelType = gl.FLOAT;
                    break;
                case pc.PIXELFORMAT_DEPTH:
                    if (this.webgl2) {
                        // native WebGL2
                        texture._glFormat = gl.DEPTH_COMPONENT;
                        texture._glInternalFormat = gl.DEPTH_COMPONENT32F; // should allow 16/24 bits?
                        texture._glPixelType = gl.FLOAT;
                    } else {
                        // using WebGL1 extension
                        texture._glFormat = gl.DEPTH_COMPONENT;
                        texture._glInternalFormat = gl.DEPTH_COMPONENT;
                        texture._glPixelType = gl.UNSIGNED_SHORT; // the only acceptable value?
                    }
                    break;
                case pc.PIXELFORMAT_DEPTHSTENCIL: // WebGL2 only
                    texture._glFormat = gl.DEPTH_STENCIL;
                    texture._glInternalFormat = gl.DEPTH24_STENCIL8;
                    texture._glPixelType = gl.UNSIGNED_INT_24_8;
                    break;
                case pc.PIXELFORMAT_111110F: // WebGL2 only
                    texture._glFormat = gl.RGB;
                    texture._glInternalFormat = gl.R11F_G11F_B10F;
                    texture._glPixelType = gl.FLOAT;
                    break;
                case pc.PIXELFORMAT_SRGB: // WebGL2 only
                    texture._glFormat = gl.RGB;
                    texture._glInternalFormat = gl.SRGB8;
                    texture._glPixelType = gl.UNSIGNED_BYTE;
                    break;
                case pc.PIXELFORMAT_SRGBA: // WebGL2 only
                    texture._glFormat = gl.RGBA;
                    texture._glInternalFormat = gl.SRGB8_ALPHA8;
                    texture._glPixelType = gl.UNSIGNED_BYTE;
                    break;
            }
        },

        uploadTexture: function (texture) {
            var gl = this.gl;

            if (! texture._needsUpload && ((texture._needsMipmapsUpload && texture._mipmapsUploaded) || ! texture._pot))
                return;

            var mipLevel = 0;
            var mipObject;
            var resMult;

            while (texture._levels[mipLevel] || mipLevel === 0) {
                // Upload all existing mip levels. Initialize 0 mip anyway.

                if (! texture._needsUpload && mipLevel === 0) {
                    mipLevel++;
                    continue;
                } else if (mipLevel && (! texture._needsMipmapsUpload || ! texture._mipmaps)) {
                    break;
                }

                mipObject = texture._levels[mipLevel];

                if (mipLevel == 1 && ! texture._compressed) {
                    // We have more than one mip levels we want to assign, but we need all mips to make
                    // the texture complete. Therefore first generate all mip chain from 0, then assign custom mips.
                    gl.generateMipmap(texture._glTarget);
                    texture._mipmapsUploaded = true;
                }

                if (texture._cubemap) {
                    // ----- CUBEMAP -----
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

                            gl.texImage2D(
                                gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                                mipLevel,
                                texture._glInternalFormat,
                                texture._glFormat,
                                texture._glPixelType,
                                src
                            );
                        }
                    } else {
                        // Upload the byte array
                        resMult = 1 / Math.pow(2, mipLevel);
                        for (face = 0; face < 6; face++) {
                            if (! texture._levelsUpdated[0][face])
                                continue;

                            var texData = mipObject[face];
                            if (texture._compressed) {
                                gl.compressedTexImage2D(
                                    gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                                    mipLevel,
                                    texture._glInternalFormat,
                                    Math.max(texture._width * resMult, 1),
                                    Math.max(texture._height * resMult, 1),
                                    0,
                                    texData
                                );
                            } else {
                                gl.texImage2D(
                                    gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                                    mipLevel,
                                    texture._glInternalFormat,
                                    Math.max(texture._width * resMult, 1),
                                    Math.max(texture._height * resMult, 1),
                                    0,
                                    texture._glFormat,
                                    texture._glPixelType,
                                    texData
                                );
                            }
                        }
                    }
                } else if (texture._volume) {
                    // ----- 3D -----
                    // Image/canvas/video not supported (yet?)
                    // Upload the byte array
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                    resMult = 1 / Math.pow(2, mipLevel);
                    if (texture._compressed) {
                        gl.compressedTexImage3D(gl.TEXTURE_3D,
                                                mipLevel,
                                                texture._glInternalFormat,
                                                Math.max(texture._width * resMult, 1),
                                                Math.max(texture._height * resMult, 1),
                                                Math.max(texture._depth * resMult, 1),
                                                0,
                                                mipObject);
                    } else {
                        gl.texImage3D(gl.TEXTURE_3D,
                                      mipLevel,
                                      texture._glInternalFormat,
                                      Math.max(texture._width * resMult, 1),
                                      Math.max(texture._height * resMult, 1),
                                      Math.max(texture._depth * resMult, 1),
                                      0,
                                      texture._glFormat,
                                      texture._glPixelType,
                                      mipObject);
                    }
                } else {
                    // ----- 2D -----
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
                        gl.texImage2D(
                            gl.TEXTURE_2D,
                            mipLevel,
                            texture._glInternalFormat,
                            texture._glFormat,
                            texture._glPixelType,
                            mipObject
                        );
                    } else {
                        // Upload the byte array
                        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                        resMult = 1 / Math.pow(2, mipLevel);
                        if (texture._compressed) {
                            gl.compressedTexImage2D(
                                gl.TEXTURE_2D,
                                mipLevel,
                                texture._glInternalFormat,
                                Math.max(texture._width * resMult, 1),
                                Math.max(texture._height * resMult, 1),
                                0,
                                mipObject
                            );
                        } else {
                            gl.texImage2D(
                                gl.TEXTURE_2D,
                                mipLevel,
                                texture._glInternalFormat,
                                Math.max(texture._width * resMult, 1),
                                Math.max(texture._height * resMult, 1),
                                0,
                                texture._glFormat,
                                texture._glPixelType,
                                mipObject
                            );
                        }
                    }

                    if (mipLevel === 0) {
                        texture._mipmapsUploaded = false;
                    } else {
                        texture._mipmapsUploaded = true;
                    }
                }
                mipLevel++;
            }

            if (texture._needsUpload) {
                if (texture._cubemap) {
                    for(var i = 0; i < 6; i++)
                        texture._levelsUpdated[0][i] = false;
                } else {
                    texture._levelsUpdated[0] = false;
                }
            }

            if (! texture._compressed && texture._mipmaps && texture._needsMipmapsUpload && texture._pot && texture._levels.length === 1) {
                gl.generateMipmap(texture._glTarget);
                texture._mipmapsUploaded = true;
            }

            if (texture._gpuSize) {
                this._vram.tex -= texture._gpuSize;
                // #ifdef PROFILER
                if (texture.profilerHint === pc.TEXHINT_SHADOWMAP) {
                    this._vram.texShadow -= texture._gpuSize;
                } else if (texture.profilerHint === pc.TEXHINT_ASSET) {
                    this._vram.texAsset -= texture._gpuSize;
                } else if (texture.profilerHint === pc.TEXHINT_LIGHTMAP) {
                    this._vram.texLightmap -= texture._gpuSize;
                }
                // #endif
            }

            texture._gpuSize = gpuTexSize(gl, texture);
            this._vram.tex += texture._gpuSize;
            // #ifdef PROFILER
            if (texture.profilerHint === pc.TEXHINT_SHADOWMAP) {
                this._vram.texShadow += texture._gpuSize;
            } else if (texture.profilerHint === pc.TEXHINT_ASSET) {
                this._vram.texAsset += texture._gpuSize;
            } else if (texture.profilerHint === pc.TEXHINT_LIGHTMAP) {
                this._vram.texLightmap += texture._gpuSize;
            }
            // #endif
        },

        setTexture: function (texture, textureUnit) {
            var gl = this.gl;

            if (!texture._glTextureId)
                this.initializeTexture(texture);

            var paramDirty = texture._minFilterDirty || texture._magFilterDirty ||
                             texture._addressUDirty || texture._addressVDirty || texture._addressWDirty ||
                             texture._anisotropyDirty;

            if ((this.textureUnits[textureUnit] !== texture) || paramDirty) {
                if (this.activeTexture !== textureUnit) {
                    gl.activeTexture(gl.TEXTURE0 + textureUnit);
                    this.activeTexture = textureUnit;
                }
                gl.bindTexture(texture._glTarget, texture._glTextureId);
                this.textureUnits[textureUnit] = texture;
            }

            if (paramDirty) {
                if (texture._minFilterDirty) {
                    var filter = texture._minFilter;
                    if (! texture._pot || ! texture._mipmaps || (texture._compressed && texture._levels.length === 1)) {
                        if (filter === pc.FILTER_NEAREST_MIPMAP_NEAREST || filter === pc.FILTER_NEAREST_MIPMAP_LINEAR) {
                            filter = pc.FILTER_NEAREST;
                        } else if (filter === pc.FILTER_LINEAR_MIPMAP_NEAREST || filter === pc.FILTER_LINEAR_MIPMAP_LINEAR) {
                            filter = pc.FILTER_LINEAR;
                        }
                    }
                    gl.texParameteri(texture._glTarget, gl.TEXTURE_MIN_FILTER, this.glFilter[filter]);
                    texture._minFilterDirty = false;
                }
                if (texture._magFilterDirty) {
                    gl.texParameteri(texture._glTarget, gl.TEXTURE_MAG_FILTER, this.glFilter[texture._magFilter]);
                    texture._magFilterDirty = false;
                }
                if (texture._addressUDirty) {
                    if (this.webgl2) {
                        gl.texParameteri(texture._glTarget, gl.TEXTURE_WRAP_S, this.glAddress[texture._addressU]);
                    } else {
                        // WebGL1 doesn't support all addressing modes with NPOT textures
                        gl.texParameteri(texture._glTarget, gl.TEXTURE_WRAP_S, this.glAddress[texture._pot ? texture._addressU : pc.ADDRESS_CLAMP_TO_EDGE]);
                    }
                    texture._addressUDirty = false;
                }
                if (texture._addressVDirty) {
                    if (this.webgl2) {
                        gl.texParameteri(texture._glTarget, gl.TEXTURE_WRAP_T, this.glAddress[texture._addressV]);
                    } else {
                        // WebGL1 doesn't support all addressing modes with NPOT textures
                        gl.texParameteri(texture._glTarget, gl.TEXTURE_WRAP_T, this.glAddress[texture._pot ? texture._addressV : pc.ADDRESS_CLAMP_TO_EDGE]);
                    }
                    texture._addressVDirty = false;
                }
                if (this.webgl2 && texture._addressWDirty) {
                    gl.texParameteri(texture._glTarget, gl.TEXTURE_WRAP_R, this.glAddress[texture._addressW]);
                    texture._addressWDirty = false;
                }
                if (texture._anisotropyDirty) {
                    var ext = this.extTextureFilterAnisotropic;
                    if (ext) gl.texParameterf(texture._glTarget, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.max(1, Math.min(Math.round(texture._anisotropy), this.maxAnisotropy)));
                    texture._anisotropyDirty = false;
                }
            }

            if (texture._needsUpload || texture._needsMipmapsUpload) {
                this.uploadTexture(texture);
                texture._needsUpload = false;
                texture._needsMipmapsUpload = false;
            }
        },

        onVertexBufferDeleted: function () {
            this.boundBuffer = null;
            this.indexBuffer = null;
            this.vertexBuffers.length = 0;
            this.vbOffsets.length = 0;
            this.attributesInvalidated = true;
            for(var loc in this.enabledAttributes) {
                this.gl.disableVertexAttribArray(loc);
            }
            this.enabledAttributes = {};
        },

        /**
         * @function
         * @name pc.GraphicsDevice#draw
         * @description Submits a graphical primitive to the hardware for immediate rendering.
         * @param {Object} primitive Primitive object describing how to submit current vertex/index buffers defined as follows:
         * @param {Number} primitive.type The type of primitive to render. Can be:
         * <ul>
         *     <li>pc.PRIMITIVE_POINTS</li>
         *     <li>pc.PRIMITIVE_LINES</li>
         *     <li>pc.PRIMITIVE_LINELOOP</li>
         *     <li>pc.PRIMITIVE_LINESTRIP</li>
         *     <li>pc.PRIMITIVE_TRIANGLES</li>
         *     <li>pc.PRIMITIVE_TRISTRIP</li>
         *     <li>pc.PRIMITIVE_TRIFAN</li>
         * </ul>
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

            var i, j, len; // Loop counting
            var sampler, samplerValue, texture, numTextures; // Samplers
            var uniform, scopeId, uniformVersion, programVersion, locationId; // Uniforms
            var shader = this.shader;
            var samplers = shader.samplers;
            var uniforms = shader.uniforms;

            if (numInstances > 1) {
                this.boundBuffer = null;
                this.attributesInvalidated = true;
            }

            // Commit the vertex buffer inputs
            if (this.attributesInvalidated) {
                var attribute, element, vertexBuffer, vbOffset, bufferId;
                var attributes = shader.attributes;

                for (i = 0, len = attributes.length; i < len; i++) {
                    attribute = attributes[i];

                    // Retrieve vertex element for this shader attribute
                    element = attribute.scopeId.value;

                    // Check the vertex element is valid
                    if (element !== null) {
                        // Retrieve the vertex buffer that contains this element
                        vertexBuffer = this.vertexBuffers[element.stream];
                        vbOffset = this.vbOffsets[element.stream] || 0;

                        // Set the active vertex buffer object
                        bufferId = vertexBuffer.bufferId;
                        if (this.boundBuffer !== bufferId) {
                            gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
                            this.boundBuffer = bufferId;
                        }

                        // Hook the vertex buffer to the shader program
                        locationId = attribute.locationId;
                        if (!this.enabledAttributes[locationId]) {
                            gl.enableVertexAttribArray(locationId);
                            this.enabledAttributes[locationId] = true;
                        }
                        gl.vertexAttribPointer(
                            locationId,
                            element.numComponents,
                            this.glType[element.dataType],
                            element.normalize,
                            element.stride,
                            element.offset + vbOffset
                        );

                        if (element.stream===1 && numInstances>1) {
                            if (!this.instancedAttribs[locationId]) {
                                this.extInstancing.vertexAttribDivisorANGLE(locationId, 1);
                                this.instancedAttribs[locationId] = true;
                            }
                        } else if (this.instancedAttribs[locationId]) {
                            this.extInstancing.vertexAttribDivisorANGLE(locationId, 0);
                            this.instancedAttribs[locationId] = false;
                        }
                    }
                }

                this.attributesInvalidated = false;
            }

            // Commit the shader program variables
            var textureUnit = 0;

            for (i = 0, len = samplers.length; i < len; i++) {
                sampler = samplers[i];
                samplerValue = sampler.scopeId.value;
                if (!samplerValue) {
                    continue; // Because unset constants shouldn't raise random errors
                }

                if (samplerValue instanceof pc.Texture) {
                    texture = samplerValue;
                    this.setTexture(texture, textureUnit);

                    // #ifdef DEBUG
                    if (this.renderTarget) {
                        // Set breakpoint here to debug "Source and destination textures of the draw are the same" errors
                        if (this.renderTarget.colorBuffer && this.renderTarget.colorBuffer===texture) {
                            console.error("Trying to bind current color buffer as a texture");
                        } else if (this.renderTarget.depthBuffer && this.renderTarget.depthBuffer===texture) {
                            console.error("Trying to bind current depth buffer as a texture");
                        }
                    }
                    // #endif

                    if (sampler.slot !== textureUnit) {
                        gl.uniform1i(sampler.locationId, textureUnit);
                        sampler.slot = textureUnit;
                    }
                    textureUnit++;
                } else { // Array
                    sampler.array.length = 0;
                    numTextures = samplerValue.length;
                    for (j = 0; j < numTextures; j++) {
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
                    if (scopeId.value !== null) {
                        this.commitFunction[uniform.dataType](uniform, scopeId.value);
                    }
                }
            }

            this._drawCallsPerFrame++;
            this._primsPerFrame[primitive.type] += primitive.count * (numInstances > 1? numInstances : 1);

            if (this.webgl2 && this.transformFeedbackBuffer) {
                // Enable TF, start writing to out buffer
                gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.transformFeedbackBuffer.bufferId);
                gl.beginTransformFeedback(gl.POINTS);
            }

            if (primitive.indexed) {
                if (numInstances > 1) {
                    this.extInstancing.drawElementsInstancedANGLE(
                        this.glPrimitive[primitive.type],
                        primitive.count,
                        this.indexBuffer.glFormat,
                        primitive.base * 2,
                        numInstances
                    );
                    this.boundBuffer = null;
                    this.attributesInvalidated = true;
                } else {
                    gl.drawElements(
                        this.glPrimitive[primitive.type],
                        primitive.count,
                        this.indexBuffer.glFormat,
                        primitive.base * this.indexBuffer.bytesPerIndex
                    );
                }
            } else {
                if (numInstances > 1) {
                    this.extInstancing.drawArraysInstancedANGLE(
                        this.glPrimitive[primitive.type],
                        primitive.base,
                        primitive.count,
                        numInstances
                    );
                    this.boundBuffer = null;
                    this.attributesInvalidated = true;
                } else {
                    gl.drawArrays(
                        this.glPrimitive[primitive.type],
                        primitive.base,
                        primitive.count
                    );
                }
            }

            if (this.webgl2 && this.transformFeedbackBuffer) {
                // disable TF
                gl.endTransformFeedback();
                gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#clear
         * @description Clears the frame buffer of the currently set render target.
         * @param {Object} options Optional options object that controls the behavior of the clear operation defined as follows:
         * @param {Number[]} options.color The color to clear the color buffer to in the range 0.0 to 1.0 for each component.
         * @param {Number} options.depth The depth value to clear the depth buffer to in the range 0.0 to 1.0.
         * @param {Number} options.flags The buffers to clear (the types being color, depth and stencil). Can be any bitwise
         * combination of:
         * <ul>
         *     <li>pc.CLEARFLAG_COLOR</li>
         *     <li>pc.CLEARFLAG_DEPTH</li>
         *     <li>pc.CLEARFLAG_STENCIL</li>
         * </ul>
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

            var flags = (options.flags == undefined) ? defaultOptions.flags : options.flags;
            if (flags !== 0) {
                var gl = this.gl;

                // Set the clear color
                if (flags & pc.CLEARFLAG_COLOR) {
                    var color = (options.color == undefined) ? defaultOptions.color : options.color;
                    this.setClearColor(color[0], color[1], color[2], color[3]);
                }

                if (flags & pc.CLEARFLAG_DEPTH) {
                    // Set the clear depth
                    var depth = (options.depth == undefined) ? defaultOptions.depth : options.depth;
                    this.setClearDepth(depth);
                    if (!this.depthWrite) {
                        gl.depthMask(true);
                    }
                }

                if (flags & pc.CLEARFLAG_STENCIL) {
                    // Set the clear stencil
                    var stencil = (options.stencil == undefined) ? defaultOptions.stencil : options.stencil;
                    this.setClearStencil(stencil);
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

        setClearStencil: function (value) {
            if (value !== this.clearStencil) {
                this.gl.clearStencil(value);
                this.clearStencil = value;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setRenderTarget
         * @description Sets the specified render target on the device. If null
         * is passed as a parameter, the back buffer becomes the current target
         * for all rendering operations.
         * @param {pc.RenderTarget} renderTarget The render target to activate.
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
         * @name pc.GraphicsDevice#setDepthFunc
         * @description Configures the depth test.
         * @param {Number} func A function to compare a new depth value with an existing z-buffer value and decide if to write a pixel. Can be:
         * <ul>
         *     <li>pc.FUNC_NEVER: don't draw</li>
         *     <li>pc.FUNC_LESS: draw if new depth < depth buffer</li>
         *     <li>pc.FUNC_EQUAL: draw if new depth == depth buffer</li>
         *     <li>pc.FUNC_LESSEQUAL: draw if new depth <= depth buffer</li>
         *     <li>pc.FUNC_GREATER: draw if new depth > depth buffer</li>
         *     <li>pc.FUNC_NOTEQUAL: draw if new depth != depth buffer</li>
         *     <li>pc.FUNC_GREATEREQUAL: draw if new depth >= depth buffer</li>
         *     <li>pc.FUNC_ALWAYS: always draw</li>
         * </ul>
         */
        setDepthFunc: function (func) {
            if (this.depthFunc===func) return;
            this.gl.depthFunc(this.glComparison[func]);
            this.depthFunc = func;
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
         * @private
         * @function
         * @name pc.GraphicsDevice#setAlphaToCoverage
         * @description Enables or disables alpha to coverage (WebGL2 only).
         * @param {Boolean} state True to enable alpha to coverage and false to disable it.
         */
        setAlphaToCoverage: function (state) {
            if (!this.webgl2) return;
            if (this.alphaToCoverage === state) return;
            this.alphaToCoverage = state;

            if (state) {
                this.gl.enable(this.gl.SAMPLE_ALPHA_TO_COVERAGE);
            } else {
                this.gl.disable(this.gl.SAMPLE_ALPHA_TO_COVERAGE);
            }
        },

        /**
         * @private
         * @function
         * @name pc.GraphicsDevice#setTransformFeedbackBuffer
         * @description Sets the output vertex buffer. It will be written to by a shader with transform feedback varyings.
         * @param {pc.VertexBuffer} tf The output vertex buffer
         */
        setTransformFeedbackBuffer: function (tf) {
            if (this.transformFeedbackBuffer === tf)
                return;

            this.transformFeedbackBuffer = tf;

            if (this.webgl2) {
                var gl = this.gl;
                if (tf) {
                    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.feedback);
                } else {
                    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
                }
            }
        },

        /**
         * @private
         * @function
         * @name pc.GraphicsDevice#setRaster
         * @description Enables or disables rasterization. Useful with transform feedback, when you only need to process the data without drawing.
         * @param {Boolean} on True to enable rasterization and false to disable it.
         */
        setRaster: function (on) {
            if (this.raster === on) return;

            this.raster = on;

            if (this.webgl2) {
                var gl = this.gl;
                if (on) {
                    gl.disable(gl.RASTERIZER_DISCARD);
                } else {
                    gl.enable(gl.RASTERIZER_DISCARD);
                }
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
         * @name pc.GraphicsDevice#setStencilTest
         * @description Enables or disables stencil test.
         * @param {Boolean} enable True to enable stencil test and false to disable it.
         */
        setStencilTest: function (enable) {
            if (this.stencil !== enable) {
                var gl = this.gl;
                if (enable) {
                    gl.enable(gl.STENCIL_TEST);
                } else {
                    gl.disable(gl.STENCIL_TEST);
                }
                this.stencil = enable;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setStencilFunc
         * @description Configures stencil test for both front and back faces.
         * @param {Number} func A comparison function that decides if the pixel should be written, based on the current stencil buffer value,
         * reference value, and mask value. Can be:
         * <ul>
         *     <li>pc.FUNC_NEVER: never pass</li>
         *     <li>pc.FUNC_LESS: pass if (ref & mask) < (stencil & mask)</li>
         *     <li>pc.FUNC_EQUAL: pass if (ref & mask) == (stencil & mask)</li>
         *     <li>pc.FUNC_LESSEQUAL: pass if (ref & mask) <= (stencil & mask)</li>
         *     <li>pc.FUNC_GREATER: pass if (ref & mask) > (stencil & mask)</li>
         *     <li>pc.FUNC_NOTEQUAL: pass if (ref & mask) != (stencil & mask)</li>
         *     <li>pc.FUNC_GREATEREQUAL: pass if (ref & mask) >= (stencil & mask)</li>
         *     <li>pc.FUNC_ALWAYS: always pass</li>
         * </ul>
         * @param {Number} ref Reference value used in comparison.
         * @param {Number} mask Mask applied to stencil buffer value and reference value before comparison.
         */
        setStencilFunc: function (func, ref, mask) {
            if (this.stencilFuncFront!==func || this.stencilRefFront!==ref || this.stencilMaskFront!==mask ||
                this.stencilFuncBack!==func || this.stencilRefBack!==ref || this.stencilMaskBack!==mask) {
                var gl = this.gl;
                gl.stencilFunc(this.glComparison[func], ref, mask);
                this.stencilFuncFront = this.stencilFuncBack = func;
                this.stencilRefFront = this.stencilRefBack = ref;
                this.stencilMaskFront = this.stencilMaskBack = mask;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setStencilFuncFront
         * @description Same as pc.GraphicsDevice#setStencilFunc, but only for front faces.
         */
        setStencilFuncFront: function (func, ref, mask) {
            if (this.stencilFuncFront!==func || this.stencilRefFront!==ref || this.stencilMaskFront!==mask) {
                var gl = this.gl;
                gl.stencilFuncSeparate(gl.FRONT, this.glComparison[func], ref, mask);
                this.stencilFuncFront = func;
                this.stencilRefFront = ref;
                this.stencilMaskFront = mask;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setStencilFuncBack
         * @description Same as pc.GraphicsDevice#setStencilFunc, but only for back faces.
         */
        setStencilFuncBack: function (func, ref, mask) {
            if (this.stencilFuncBack!==func || this.stencilRefBack!==ref || this.stencilMaskBack!==mask) {
                var gl = this.gl;
                gl.stencilFuncSeparate(gl.BACK, this.glComparison[func], ref, mask);
                this.stencilFuncBack = func;
                this.stencilRefBack = ref;
                this.stencilMaskBack = mask;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setStencilOperation
         * @description Configures how stencil buffer values should be modified based on the result of depth/stencil tests. Works for both front and back faces.
         * @param {Number} fail Action to take if stencil test is failed
         * @param {Number} zfail Action to take if depth test is failed
         * @param {Number} zpass Action to take if both depth and stencil test are passed
         * All arguments can be:
         * <ul>
         *     <li>pc.STENCILOP_KEEP: don't change the stencil buffer value</li>
         *     <li>pc.STENCILOP_ZERO: set value to zero</li>
         *     <li>pc.STENCILOP_REPLACE: replace value with the reference value (see pc.GraphicsDevice#setStencilFunc)</li>
         *     <li>pc.STENCILOP_INCREMENT: increment the value</li>
         *     <li>pc.STENCILOP_INCREMENTWRAP: increment the value, but wrap it to zero when it's larger than a maximum representable value</li>
         *     <li>pc.STENCILOP_DECREMENT: decrement the value</li>
         *     <li>pc.STENCILOP_DECREMENTWRAP: decrement the value, but wrap it to a maximum representable value, if the current value is 0</li>
         *     <li>pc.STENCILOP_INVERT: invert the value bitwise</li>
         * </ul>
         * @param {Number} writeMask A bit mask applied to the reference value, when written.
         */
        setStencilOperation: function (fail, zfail, zpass, writeMask) {
            if (this.stencilFailFront!==fail || this.stencilZfailFront!==zfail || this.stencilZpassFront!==zpass ||
                this.stencilFailBack!==fail || this.stencilZfailBack!==zfail || this.stencilZpassBack!==zpass) {
                this.gl.stencilOp(this.glStencilOp[fail], this.glStencilOp[zfail], this.glStencilOp[zpass]);
                this.stencilFailFront = this.stencilFailBack = fail;
                this.stencilZfailFront = this.stencilZfailBack = zfail;
                this.stencilZpassFront = this.stencilZpassBack = zpass;
            }
            if (this.stencilWriteMaskFront!==writeMask || this.stencilWriteMaskBack!==writeMask) {
                this.gl.stencilMask(writeMask);
                this.stencilWriteMaskFront = writeMask;
                this.stencilWriteMaskBack = writeMask;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setStencilOperationFront
         * @description Same as pc.GraphicsDevice#setStencilOperation, but only for front faces.
         */
        setStencilOperationFront: function (fail, zfail, zpass, writeMask) {
            if (this.stencilFailFront!==fail || this.stencilZfailFront!==zfail || this.stencilZpassFront!==zpass) {
                this.gl.stencilOpSeparate(this.gl.FRONT, this.glStencilOp[fail], this.glStencilOp[zfail], this.glStencilOp[zpass]);
                this.stencilFailFront = fail;
                this.stencilZfailFront = zfail;
                this.stencilZpassFront = zpass;
            }
            if (this.stencilWriteMaskFront!==writeMask) {
                this.gl.stencilMaskSeparate(this.gl.FRONT, writeMask);
                this.stencilWriteMaskFront = writeMask;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setStencilOperationBack
         * @description Same as pc.GraphicsDevice#setStencilOperation, but only for back faces.
         */
        setStencilOperationBack: function (fail, zfail, zpass, writeMask) {
            if (this.stencilFailBack!==fail || this.stencilZfailBack!==zfail || this.stencilZpassBack!==zpass) {
                this.gl.stencilOpSeparate(this.gl.BACK, this.glStencilOp[fail], this.glStencilOp[zfail], this.glStencilOp[zpass]);
                this.stencilFailBack = fail;
                this.stencilZfailBack = zfail;
                this.stencilZpassBack = zpass;
            }
            if (this.stencilWriteMaskBack!==writeMask) {
                this.gl.stencilMaskSeparate(this.gl.BACK, writeMask);
                this.stencilWriteMaskBack = writeMask;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setBlendFunction
         * @description Configures blending operations. Both source and destination
         * blend modes can take the following values:
         * <ul>
         *     <li>pc.BLENDMODE_ZERO</li>
         *     <li>pc.BLENDMODE_ONE</li>
         *     <li>pc.BLENDMODE_SRC_COLOR</li>
         *     <li>pc.BLENDMODE_ONE_MINUS_SRC_COLOR</li>
         *     <li>pc.BLENDMODE_DST_COLOR</li>
         *     <li>pc.BLENDMODE_ONE_MINUS_DST_COLOR</li>
         *     <li>pc.BLENDMODE_SRC_ALPHA</li>
         *     <li>pc.BLENDMODE_SRC_ALPHA_SATURATE</li>
         *     <li>pc.BLENDMODE_ONE_MINUS_SRC_ALPHA</li>
         *     <li>pc.BLENDMODE_DST_ALPHA</li>
         *     <li>pc.BLENDMODE_ONE_MINUS_DST_ALPHA</li>
         * </ul>
         * @param {Number} blendSrc The source blend function.
         * @param {Number} blendDst The destination blend function.
         */
        setBlendFunction: function (blendSrc, blendDst) {
            if (this.blendSrc !== blendSrc || this.blendDst !== blendDst || this.separateAlphaBlend) {
                this.gl.blendFunc(this.glBlendFunction[blendSrc], this.glBlendFunction[blendDst]);
                this.blendSrc = blendSrc;
                this.blendDst = blendDst;
                this.separateAlphaBlend = false;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setBlendFunctionSeparate
         * @description Configures blending operations. Both source and destination
         * blend modes can take the following values:
         * <ul>
         *     <li>pc.BLENDMODE_ZERO</li>
         *     <li>pc.BLENDMODE_ONE</li>
         *     <li>pc.BLENDMODE_SRC_COLOR</li>
         *     <li>pc.BLENDMODE_ONE_MINUS_SRC_COLOR</li>
         *     <li>pc.BLENDMODE_DST_COLOR</li>
         *     <li>pc.BLENDMODE_ONE_MINUS_DST_COLOR</li>
         *     <li>pc.BLENDMODE_SRC_ALPHA</li>
         *     <li>pc.BLENDMODE_SRC_ALPHA_SATURATE</li>
         *     <li>pc.BLENDMODE_ONE_MINUS_SRC_ALPHA</li>
         *     <li>pc.BLENDMODE_DST_ALPHA</li>
         *     <li>pc.BLENDMODE_ONE_MINUS_DST_ALPHA</li>
         * </ul>
         * @param {Number} blendSrc The source blend function.
         * @param {Number} blendDst The destination blend function.
         * @param {Number} blendSrcAlpha The separate source blend function for the alpha channel.
         * @param {Number} blendDstAlpha The separate destination blend function for the alpha channel.
         */
        setBlendFunctionSeparate: function (blendSrc, blendDst, blendSrcAlpha, blendDstAlpha) {
            if (this.blendSrc !== blendSrc || this.blendDst !== blendDst || this.blendSrcAlpha !== blendSrcAlpha || this.blendDstAlpha !== blendDstAlpha || !this.separateAlphaBlend) {
                this.gl.blendFuncSeparate(this.glBlendFunction[blendSrc], this.glBlendFunction[blendDst],
                                          this.glBlendFunction[blendSrcAlpha], this.glBlendFunction[blendDstAlpha]);
                this.blendSrc = blendSrc;
                this.blendDst = blendDst;
                this.blendSrcAlpha = blendSrcAlpha;
                this.blendDstAlpha = blendDstAlpha;
                this.separateAlphaBlend = true;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setBlendEquation
         * @description Configures the blending equation. The default blend equation is
         * pc.BLENDEQUATION_ADD.
         * @param {Number} blendEquation The blend equation. Can be:
         * <ul>
         *     <li>pc.BLENDEQUATION_ADD</li>
         *     <li>pc.BLENDEQUATION_SUBTRACT</li>
         *     <li>pc.BLENDEQUATION_REVERSE_SUBTRACT</li>
         *     <li>pc.BLENDEQUATION_MIN</li>
         *     <li>pc.BLENDEQUATION_MAX</li>
         * Note that MIN and MAX modes require either EXT_blend_minmax or WebGL2 to work (check device.extBlendMinmax).
         * </ul>
         */
        setBlendEquation: function (blendEquation) {
            if (this.blendEquation !== blendEquation || this.separateAlphaEquation) {
                this.gl.blendEquation(this.glBlendEquation[blendEquation]);
                this.blendEquation = blendEquation;
                this.separateAlphaEquation = false;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setBlendEquationSeparate
         * @description Configures the blending equation. The default blend equation is
         * pc.BLENDEQUATION_ADD.
         * @param {Number} blendEquation The blend equation. Can be:
         * <ul>
         *     <li>pc.BLENDEQUATION_ADD</li>
         *     <li>pc.BLENDEQUATION_SUBTRACT</li>
         *     <li>pc.BLENDEQUATION_REVERSE_SUBTRACT</li>
         *     <li>pc.BLENDEQUATION_MIN</li>
         *     <li>pc.BLENDEQUATION_MAX</li>
         * Note that MIN and MAX modes require either EXT_blend_minmax or WebGL2 to work (check device.extBlendMinmax).
         * @param {Number} blendAlphaEquation A separate blend equation for the alpha channel. Accepts same values as blendEquation.
         * </ul>
         */
        setBlendEquationSeparate: function (blendEquation, blendAlphaEquation) {
            if (this.blendEquation !== blendEquation || this.blendAlphaEquation !== blendAlphaEquation || !this.separateAlphaEquation) {
                this.gl.blendEquationSeparate(this.glBlendEquation[blendEquation], this.glBlendEquation[blendAlphaEquation]);
                this.blendEquation = blendEquation;
                this.blendAlphaEquation = blendAlphaEquation;
                this.separateAlphaEquation = true;
            }
        },

        /**
         * @function
         * @name pc.GraphicsDevice#setCullMode
         * @description Controls how triangles are culled based on their face direction.
         * The default cull mode is pc.CULLFACE_BACK.
         * @param {Number} cullMode The cull mode to set. Can be:
         * <ul>
         *     <li>pc.CULLFACE_NONE</li>
         *     <li>pc.CULLFACE_BACK</li>
         *     <li>pc.CULLFACE_FRONT</li>
         *     <li>pc.CULLFACE_FRONTANDBACK</li>
         * </ul>
         */
        setCullMode: function (cullMode) {
            if (this.cullMode !== cullMode) {
                if (cullMode === pc.CULLFACE_NONE) {
                    this.gl.disable(this.gl.CULL_FACE);
                } else {
                    if (this.cullMode === pc.CULLFACE_NONE) {
                        this.gl.enable(this.gl.CULL_FACE);
                    }

                    var mode = this.glCull[cullMode];
                    if (this.cullFace !== mode) {
                        this.gl.cullFace(mode);
                        this.cullFace = mode;
                    }
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
        setVertexBuffer: function (vertexBuffer, stream, vbOffset) {
            if (this.vertexBuffers[stream] !== vertexBuffer || this.vbOffsets[stream] !== vbOffset) {
                // Store the vertex buffer for this stream index
                this.vertexBuffers[stream] = vertexBuffer;
                this.vbOffsets[stream] = vbOffset;

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

                if (!shader.ready) {
                    if (!shader.link()) {
                        return false;
                    }
                }

                // Set the active shader
                this._shaderSwitchesPerFrame++;
                this.gl.useProgram(shader.program);

                this.attributesInvalidated = true;
            }
            return true;
        },

        getHdrFormat: function() {
            if (this.extTextureHalfFloatRenderable) {
                return pc.PIXELFORMAT_RGB16F;
            } else if (this.extTextureFloatRenderable) {
                return pc.PIXELFORMAT_RGB32F;
            }
            return pc.PIXELFORMAT_R8_G8_B8_A8;
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
        },

        setResolution: function (width, height) {
            this._width = width;
            this._height = height;
            this.canvas.width = width;
            this.canvas.height = height;
            this.fire(EVENT_RESIZE, width, height);
        },

        /**
        * @function
        * @name pc.GraphicsDevice#clearShaderCache
        * @description Frees memory from all shaders ever allocated with this device
        */
        clearShaderCache: function () {
            this.programLib.clearCache();
        },

        removeShaderFromCache: function (shader) {
            this.programLib.removeFromCache(shader);
        },

        destroy: function () {
            if (this.webgl2 && this.feedback) {
                this.gl.deleteTransformFeedback(this.feedback);
            }
        }
    };

    /**
     * @readonly
     * @name pc.GraphicsDevice#width
     * @type Number
     * @description Width of the back buffer in pixels.
     */
    Object.defineProperty(GraphicsDevice.prototype, 'width', {
        get: function () { return this.gl.drawingBufferWidth || this.canvas.width; }
    });

    /**
     * @readonly
     * @name pc.GraphicsDevice#height
     * @type Number
     * @description Height of the back buffer in pixels.
     */
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

    Object.defineProperty(GraphicsDevice.prototype, 'enableAutoInstancing', {
        get: function () { return this._enableAutoInstancing; },
        set: function (value) {
            this._enableAutoInstancing = value && this.extInstancing;
        }
    });

    /**
     * @readonly
     * @name pc.GraphicsDevice#maxAnisotropy
     * @type Number
     * @description The maximum supported texture anisotropy setting.
     */
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
            };
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
