// DEPRECATED! See pc.gfx.PRIMITIVE_
pc.gfx.PrimType = {
    POINTS: 0,
    LINES: 1,
    LINE_STRIP: 2,
    TRIANGLES: 3,
    TRIANGLE_STRIP: 4
};

// DEPRECATED! See pc.gfx.BLENDMODE_
pc.gfx.BlendMode = {
    ZERO: 0,
    ONE: 1,
    SRC_COLOR: 2,
    ONE_MINUS_SRC_COLOR: 3,
    DST_COLOR: 4,
    ONE_MINUS_DST_COLOR: 5,
    SRC_ALPHA: 6,
    SRC_ALPHA_SATURATE: 7,
    ONE_MINUS_SRC_ALPHA: 8,
    DST_ALPHA: 9,
    ONE_MINUS_DST_ALPHA: 10
};

/**
 * @enum {Number}
 * @name pc.gfx.DepthFunc
 * @description Constants for blending modes.
 */
pc.gfx.DepthFunc = {
    LEQUAL: 0
};

pc.gfx.FrontFace = {
    CW: 0,
    CCW: 1
};

pc.extend(pc.gfx, function () {
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
        var names = ["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"];
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

    /**
     * @name pc.gfx.Device
     * @class The graphics device manages the underlying graphics context. It is responsible
     * for submitting render state changes and graphics primitives to the hardware. A graphics
     * device is tied to a specific canvas HTML element. It is valid to have more than one 
     * canvas element per page and create a new graphics device against each.
     * @param {Object} canvas The canvas to which the graphics device is tied.
     */
    var Device = function (canvas) {
        if (!window.WebGLRenderingContext) {
            throw new pc.gfx.UnsupportedBrowserError();
        }

        // Retrieve the WebGL context
        this.gl = _createContext(canvas, {alpha: false});

        if (!this.gl) {
            throw new pc.gfx.ContextCreationError();
        }

        canvas.addEventListener("webglcontextlost", _contextLostHandler, false);
        canvas.addEventListener("webglcontextrestored", _contextRestoredHandler, false);

        this.canvas        = canvas;
        this.program       = null;
        this.indexBuffer   = null;
        this.vertexBuffers = [];

        var gl = this.gl;
        logINFO("Device started");
        logINFO("WebGL version:             " + gl.getParameter(gl.VERSION));
        logINFO("WebGL shader version:      " + gl.getParameter(gl.SHADING_LANGUAGE_VERSION));
        logINFO("WebGL vendor:              " + gl.getParameter(gl.VENDOR));
        logINFO("WebGL renderer:            " + gl.getParameter(gl.RENDERER));
        logINFO("WebGL extensions:          " + gl.getSupportedExtensions());
        logINFO("WebGL num texture units:   " + gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS));
        logINFO("WebGL max texture size:    " + gl.getParameter(gl.MAX_TEXTURE_SIZE));
        logINFO("WebGL max cubemap size:    " + gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE));
        logINFO("WebGL max vertex attribs:  " + gl.getParameter(gl.MAX_VERTEX_ATTRIBS));
        logINFO("WebGL max vshader vectors: " + gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS));
        logINFO("WebGL max fshader vectors: " + gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS));
        logINFO("WebGL max varying vectors: " + gl.getParameter(gl.MAX_VARYING_VECTORS));

        this.defaultClearOptions = {
            color: [0, 0, 0, 1],
            depth: 1,
            flags: pc.gfx.CLEARFLAG_COLOR | pc.gfx.CLEARFLAG_COLOR 
        };

        this.lookupPrim = [
            gl.POINTS, 
            gl.LINES, 
            gl.LINE_STRIP, 
            gl.TRIANGLES, 
            gl.TRIANGLE_STRIP 
        ];

        this.lookupClear = [
            0,
            gl.COLOR_BUFFER_BIT,
            gl.DEPTH_BUFFER_BIT,
            gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT,
            gl.STENCIL_BUFFER_BIT,
            gl.STENCIL_BUFFER_BIT|gl.COLOR_BUFFER_BIT,
            gl.STENCIL_BUFFER_BIT|gl.DEPTH_BUFFER_BIT,
            gl.STENCIL_BUFFER_BIT|gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT
        ];

        this.lookup = {
            blendMode: [
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
            ],
            elementType: [
                gl.BYTE,
                gl.UNSIGNED_BYTE,
                gl.SHORT,
                gl.UNSIGNED_SHORT,
                gl.INT,
                gl.UNSIGNED_INT,
                gl.FLOAT
            ],
            frontFace: [
                gl.CW,
                gl.CCW
            ]
        };

        // Initialize extensions
        this.extTextureFloat = gl.getExtension("OES_texture_float");
        this.extDepthTexture = null; //gl.getExtension("WEBKIT_WEBGL_depth_texture");
        this.extStandardDerivatives = gl.getExtension("OES_standard_derivatives");
        if (this.extStandardDerivatives) {
            gl.hint(this.extStandardDerivatives.FRAGMENT_SHADER_DERIVATIVE_HINT_OES, gl.NICEST);
        }

        this.extTextureFilterAnisotropic = gl.getExtension('EXT_texture_filter_anisotropic');
        if (!this.extTextureFilterAnisotropic) {
            this.extTextureFilterAnisotropic = gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
        }
        this.extCompressedTextureS3TC = gl.getExtension('WEBKIT_WEBGL_compressed_texture_s3tc');
        if (this.extCompressedTextureS3TC) {
            var formats = gl.getParameter(gl.COMPRESSED_TEXTURE_FORMATS);
            var formatMsg = "WebGL compressed texture formats:";
            for (var i = 0; i < formats.length; i++) {
                switch (formats[i]) {
                    case this.extCompressedTextureS3TC.COMPRESSED_RGB_S3TC_DXT1_EXT:
                        formatMsg += ' COMPRESSED_RGB_S3TC_DXT1_EXT';
                        break;
                    case this.extCompressedTextureS3TC.COMPRESSED_RGBA_S3TC_DXT1_EXT:
                        formatMsg += ' COMPRESSED_RGBA_S3TC_DXT1_EXT';
                        break;
                    case this.extCompressedTextureS3TC.COMPRESSED_RGBA_S3TC_DXT3_EXT:
                        formatMsg += ' COMPRESSED_RGBA_S3TC_DXT3_EXT';
                        break;
                    case this.extCompressedTextureS3TC.COMPRESSED_RGBA_S3TC_DXT5_EXT:
                        formatMsg += ' COMPRESSED_RGBA_S3TC_DXT5_EXT';
                        break;
                    default:
                        formatMsg += ' UNKOWN(' + formats[i] + ')';
                        break;
                }
            }
            logINFO(formatMsg);
        }

        // Create the default render target
        var backBuffer = pc.gfx.FrameBuffer.getBackBuffer();
        var viewport = { x: 0, y: 0, width: canvas.width, height: canvas.height };
        this.renderTarget = new pc.gfx.RenderTarget(backBuffer, viewport);

        // Create the ScopeNamespace for shader attributes and variables
        this.scope = new pc.gfx.ScopeSpace("Device");

        // Define the uniform commit functions
        var self = this;
        this.commitFunction = {};
        this.commitFunction[pc.gfx.ShaderInputType.BOOL ] = function (locationId, value) { self.gl.uniform1i(locationId, value); };
        this.commitFunction[pc.gfx.ShaderInputType.INT  ] = function (locationId, value) { self.gl.uniform1i(locationId, value); };
        this.commitFunction[pc.gfx.ShaderInputType.FLOAT] = function (locationId, value) { 
            if (typeof value == "number") 
                self.gl.uniform1f(locationId, value);
            else
                self.gl.uniform1fv(locationId, value); 
            };
        this.commitFunction[pc.gfx.ShaderInputType.VEC2 ] = function (locationId, value) { self.gl.uniform2fv(locationId, value); };
        this.commitFunction[pc.gfx.ShaderInputType.VEC3 ] = function (locationId, value) { self.gl.uniform3fv(locationId, value); };
        this.commitFunction[pc.gfx.ShaderInputType.VEC4 ] = function (locationId, value) { self.gl.uniform4fv(locationId, value); };
        this.commitFunction[pc.gfx.ShaderInputType.IVEC2] = function (locationId, value) { self.gl.uniform2iv(locationId, value); };
        this.commitFunction[pc.gfx.ShaderInputType.BVEC2] = function (locationId, value) { self.gl.uniform2iv(locationId, value); };
        this.commitFunction[pc.gfx.ShaderInputType.IVEC3] = function (locationId, value) { self.gl.uniform3iv(locationId, value); };
        this.commitFunction[pc.gfx.ShaderInputType.BVEC3] = function (locationId, value) { self.gl.uniform3iv(locationId, value); };
        this.commitFunction[pc.gfx.ShaderInputType.IVEC4] = function (locationId, value) { self.gl.uniform4iv(locationId, value); };
        this.commitFunction[pc.gfx.ShaderInputType.BVEC4] = function (locationId, value) { self.gl.uniform4iv(locationId, value); };
        this.commitFunction[pc.gfx.ShaderInputType.MAT2 ] = function (locationId, value) { self.gl.uniformMatrix2fv(locationId, false, value); };
        this.commitFunction[pc.gfx.ShaderInputType.MAT3 ] = function (locationId, value) { self.gl.uniformMatrix3fv(locationId, false, value); };
        this.commitFunction[pc.gfx.ShaderInputType.MAT4 ] = function (locationId, value) { self.gl.uniformMatrix4fv(locationId, false, value); };

        // Set the default render state
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.depthFunc(gl.LEQUAL);
        gl.depthRange(0.0, 1.0);

        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.frontFace(gl.CCW);

        gl.disable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ZERO);

        gl.enable(gl.SCISSOR_TEST);

        this.scope.resolve("fog_color").setValue([0.0, 0.0, 0.0]);
        this.scope.resolve("fog_density").setValue(0.0);
        this.scope.resolve("alpha_ref").setValue(0.0);

        // Set up render state
        var _getStartupState = function () {
            return {
                alphaTest: false,
                alphaRef: 0.0,
                blend: false,
                blendModes: { srcBlend: pc.gfx.BLENDMODE_ONE, dstBlend: pc.gfx.BLENDMODE_ZERO },
                colorWrite: { red: true, green: true, blue: true, alpha: true },
                cull: true,
                depthTest: true,
                depthWrite: true,
                depthFunc: pc.gfx.DepthFunc.LEQUAL,
                fog: false,
                fogColor: [0, 0, 0],
                fogDensity: 0.0,
                frontFace: pc.gfx.FrontFace.CCW
            };
        };
        this._globalState = _getStartupState();
        this._currentState = _getStartupState();
        this._localState = {};

        this._stateFuncs = {};
        this._stateFuncs.alphaTest = function (value) {
            self._currentState.alphaTest = value;
        };
        this._stateFuncs.alphaRef = function (value) {
            self.scope.resolve("alpha_ref").setValue(value);
            self._currentState.alphaRef = value;
        };
        this._stateFuncs.blend = function (value) {
            if (self._currentState.blend !== value) {
                if (value) {
                    self.gl.enable(gl.BLEND);
                } else {
                    self.gl.disable(gl.BLEND);
                }
                self._currentState.blend = value;
            }
        };
        this._stateFuncs.blendModes = function (value) {
            if ((self._currentState.blendModes.srcBlend !== value.srcBlend) ||
                (self._currentState.blendModes.dstBlend !== value.dstBlend)) {
                self.gl.blendFunc(self.lookup.blendMode[value.srcBlend], self.lookup.blendMode[value.dstBlend]);
                self._currentState.blendModes.srcBlend = value.srcBlend;
                self._currentState.blendModes.dstBlend = value.dstBlend;
            }
        };
        this._stateFuncs.colorWrite = function (value) {
            if ((self._currentState.colorWrite.red !== value.red) ||
                (self._currentState.colorWrite.green !== value.green) || 
                (self._currentState.colorWrite.blue !== value.blue) || 
                (self._currentState.colorWrite.alpha !== value.alpha)) {
                self.gl.colorMask(value.red, value.green, value.blue, value.alpha);
                self._currentState.colorWrite.red = value.red;
                self._currentState.colorWrite.green = value.green;
                self._currentState.colorWrite.blue = value.blue;
                self._currentState.colorWrite.alpha = value.alpha;
            }
        };
        this._stateFuncs.cull = function (value) {
            if (self._currentState.cull !== value) {
                if (value) {
                    self.gl.enable(gl.CULL_FACE);
                } else {
                    self.gl.disable(gl.CULL_FACE);
                }
                self._currentState.cull = value;
            }
        };
        this._stateFuncs.depthTest = function (value) {
            if (self._currentState.depthTest !== value) {
                if (value) {
                    self.gl.enable(gl.DEPTH_TEST);
                } else {
                    self.gl.disable(gl.DEPTH_TEST);
                }
                self._currentState.depthTest = value;
            }
        };
        this._stateFuncs.depthWrite = function (value) { 
            if (self._currentState.depthWrite !== value) {
                self.gl.depthMask(value);
                self._currentState.depthWrite = value;
            }
        };
        this._stateFuncs.fog = function (value) {
            self._currentState.fog = value;
        };
        this._stateFuncs.fogColor = function (value) {
            self.scope.resolve("fog_color").setValue(value);
            self._currentState.fogColor = value;
        };
        this._stateFuncs.fogDensity = function (value) {
            if (self._currentState.fogDensity !== value) {
                self.scope.resolve("fog_density").setValue(value);
                self._currentState.fogDensity = value;
            }
        };
        this._stateFuncs.frontFace = function (value) {
            if (self._currentState.frontFace !== value) {
                self.gl.frontFace(self.lookup.frontFace[value]);
                self._currentState.frontFace = value;
            }
        };

        this.programLib = new pc.gfx.ProgramLibrary();
        for (var generator in pc.gfx.programlib) {
            this.programLib.register(generator, pc.gfx.programlib[generator]);
        }

        // Calculate a estimate of the maximum number of bones that can be uploaded to the GPU
        // based on the number of available uniforms and the number of uniforms required for non-
        // bone data.  This is based off of the Phong shader.  A user defined shader may have
        // even less space available for bones so this calculated value can be overridden via
        // pc.gfx.Device.setBoneLimit.
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

        pc.extend(this, pc.events);
        
        this.boundBuffer = null;

        this.precalculatedTangents = true;

        this.textureUnits = [];

        this.attributesInvalidated = true;
    };

    /**
     * @function
     * @name pc.gfx.Device.setCurrent
     * @description Sets the current graphics device. After creating a new pc.gfx.Device,
     * it must be set as the current device before it can be used.
     * @param {pc.gfx.Device} device The graphics device to make current.
     * @author Will Eastcott
     */
    Device.setCurrent = function (device) {
        Device._current = device;
    };

    /**
     * @function
     * @name pc.gfx.Device.getCurrent
     * @description Returns the current graphics device.
     * @returns {pc.gfx.Device} The current graphics device.
     * @author Will Eastcott
     */
    Device.getCurrent = function () {
        return Device._current;
    };

    Device.prototype = {
        /**
         * @function
         * @name pc.gfx.Device#getProgramLibrary
         * @description Retrieves the program library assigned to the specified graphics device.
         * @returns {pc.gfx.ProgramLibrary} The program library assigned to the device.
         * @author Will Eastcott
         */
        getProgramLibrary: function () {
            return this.programLib;
        },

        /**
         * @function
         * @name pc.gfx.Device#setProgramLibrary
         * @description Assigns a program library to the specified device. By default, a graphics
         * device is created with a program library that manages all of the programs that are
         * used to render any graphical primitives. However, this function allows the user to
         * replace the existing program library with a new one.
         * @param {pc.gfx.ProgramLibrary} programLib The program library to assign to the device.
         * @author Will Eastcott
         */
        setProgramLibrary: function (programLib) {
            this.programLib = programLib;
        },

        /**
         * @function
         * @name pc.gfx.Device#updateBegin
         * @description Marks the beginning of a block of rendering. Internally, this function
         * binds the render target currently set on the device. This function should be matched
         * with a call to pc.gfx.Device#updateEnd. Calls to pc.gfx.Device#updateBegin
         * and pc.gfx.Device#updateEnd must not be nested.
         * @author Will Eastcott
         */
        updateBegin: function () {
            logASSERT(this.canvas !== null, "Device has not been started");

            this.boundBuffer = null;

            // Set the render target
            this.renderTarget.bind();

            for (var i = 0; i < 16; i++) {
                this.textureUnits[i] = null;
            }
        },

        /**
         * @function
         * @name pc.gfx.Device#updateEnd
         * @description Marks the end of a block of rendering. This function should be called
         * after a matching call to pc.gfx.Device#updateBegin. Calls to pc.gfx.Device#updateBegin
         * and pc.gfx.Device#updateEnd must not be nested.
         * @author Will Eastcott
         */
        updateEnd: function () {
        },

        /**
         * @function
         * @name pc.gfx.Device#draw
         * @description Submits a graphical primitive to the hardware for immediate rendering.
         * @param {Object} primitive Primitive object describing how to submit current vertex/index buffers defined as follows:
         * @param {pc.gfx.PRIMITIVE} primitive.type The type of primitive to render.
         * @param {Number} primitive.base The offset of the first index or vertex to dispatch in the draw call.
         * @param {Number} primitive.count The number of indices or vertices to dispatch in the draw call.
         * @param {Boolean} primitive.indexed True to interpret the primitive as indexed, thereby using the currently set index buffer and false otherwise.
         * @example
         * // Render a single, unindexed triangle
         * device.draw({
         *     type: pc.gfx.PRIMITIVE_TRIANGLES,
         *     base: 0,
         *     count: 3,
         *     indexed: false
         * )};
         * @author Will Eastcott
         */
        draw: function (primitive) {
            // Commit the vertex buffer inputs
            if (this.attributesInvalidated) {
                this.commitAttributes();
                this.attributesInvalidated = false;
            }

            // Commit the shader program variables
            this.commitSamplers();
            this.commitUniforms();

            var gl = this.gl;
            if (primitive.indexed) {
                gl.drawElements(this.lookupPrim[primitive.type],
                                primitive.count,
                                this.indexBuffer.glFormat,
                                primitive.base * 2);
            } else {
                gl.drawArrays(this.lookupPrim[primitive.type],
                              primitive.base,
                              primitive.count);
            }
        },

        /**
         * @function
         * @name pc.gfx.Device#clear
         * @description Clears the frame buffer of the currently set render target.
         * @param {Object} options Optional options object that controls the behavior of the clear operation defined as follows:
         * @param {Array} options.color The color to clear the color buffer to in the range 0.0 to 1.0 for each component.
         * @param {Number} options.depth The depth value to clear the depth buffer to in the range 0.0 to 1.0.
         * @param {pc.gfx.CLEARFLAG} options.flags The buffers to clear (the types being color, depth and stencil).
         * @example
         * // Clear color buffer to black and depth buffer to 1.0
         * device.clear();
         *
         * // Clear just the color buffer to red
         * device.clear({
         *     color: [1, 0, 0, 1],
         *     flags: pc.gfx.CLEARFLAG_COLOR 
         * });
         *
         * // Clear color buffer to yellow and depth to 1.0
         * device.clear({
         *     color: [1, 1, 0, 1],
         *     depth: 1.0,
         *     flags: pc.gfx.CLEARFLAG_COLOR | pc.gfx.CLEARFLAG_DEPTH
         * });
         * @author Will Eastcott
         */
        clear: function (options) {
            var defaultOptions = this.defaultClearOptions;
            options = options || defaultOptions;

            var flags = options.flags || defaultOptions.flags;
            var glFlags = this.lookupClear[flags];

            // Set the clear color
            var gl = this.gl;
            if (glFlags & gl.COLOR_BUFFER_BIT) {
                var color = options.color || defaultOptions.color;
                gl.clearColor(color[0], color[1], color[2], color[3]);
            }

            if (glFlags & gl.DEPTH_BUFFER_BIT) {
                // Set the clear depth
                var depth = options.depth || defaultOptions.depth;
                gl.clearDepth(depth);
            }

            // Clear the frame buffer
            gl.clear(glFlags);
        },

        /**
         * @function
         * @name pc.gfx.Device#getGlobalState
         * @author Will Eastcott
         */
        getGlobalState: function (state) {
            return this._globalState;
        },

        /**
         * @function
         * @name pc.gfx.Device#updateGlobalState
         * @author Will Eastcott
         */
        updateGlobalState: function (delta) {
            for (var key in delta) {
                if (this._localState[key] === undefined) {
                    this._stateFuncs[key](delta[key]);
                }
                this._globalState[key] = delta[key];
            }
        },

        /**
         * @function
         * @name pc.gfx.Device#getLocalState
         * @author Will Eastcott
         */
        getLocalState: function (state) {
            return this._localState;
        },

        /**
         * @function
         * @name pc.gfx.Device#updateLocalState
         * @author Will Eastcott
         */
        updateLocalState: function (localState) {
            for (var key in localState) {
                this._stateFuncs[key](localState[key]);
                this._localState[key] = localState[key];
            }
        },

        /**
         * @function
         * @name pc.gfx.Device#clearLocalState
         * @author Will Eastcott
         */
        clearLocalState: function () {
            for (var key in this._localState) {
                // Reset to global state
                this._stateFuncs[key](this._globalState[key]);
                delete this._localState[key];
            }
        },

        /**
         * @function
         * @name pc.gfx.Device#getCurrentState
         * @author Will Eastcott
         */
        getCurrentState: function () {
            return this._currentState;
        },

        /**
         * @function
         * @name pc.gfx.Device#setRenderTarget
         * @author Will Eastcott
         */
        setRenderTarget: function (renderTarget) {
            this.renderTarget = renderTarget;
        },

        /**
         * @function
         * @name pc.gfx.Device#getRenderTarget
         * @author Will Eastcott
         */
        getRenderTarget: function () {
            return this.renderTarget;
        },

        /**
         * @function
         * @name pc.gfx.Device#setIndexBuffer
         * @description Sets the current index buffer on the graphics device. On subsequent
         * calls to pc.gfx.Device#draw, the specified index buffer will be used to provide
         * index data for any indexed primitives.
         * @param {pc.gfx.IndexBuffer} indexBuffer The index buffer to assign to the device.
         * @author Will Eastcott
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
         * @name pc.gfx.Device#setVertexBuffer
         * @description Sets the current vertex buffer for a specific stream index on the graphics
         * device. On subsequent calls to pc.gfx.Device#draw, the specified vertex buffer will be 
         * used to provide vertex data for any primitives.
         * @param {pc.gfx.VertexBuffer} vertexBuffer The vertex buffer to assign to the device.
         * @param {Number} stream The stream index for the vertex buffer, indexed from 0 upwards.
         * @author Will Eastcott
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
         * @name pc.gfx.Device#setProgram
         * @author Will Eastcott
         */
        setProgram: function(program) {
            if (program !== this.program) {
                // Store the program
                this.program = program;

                // Set the active shader program
                var gl = this.gl;
                gl.useProgram(program.programId);

                this.attributesInvalidated = true;
            }
        },

        /**
         * @private
         * @name pc.gfx.Device#commitAttributes
         * @author Will Eastcott
         */
        commitAttributes: function () {
            var i, len, attribute, element, vertexBuffer;
            var attributes = this.program.attributes;
            var gl = this.gl;

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
                    gl.enableVertexAttribArray(attribute.locationId);
                    gl.vertexAttribPointer(attribute.locationId, 
                                           element.numComponents, 
                                           this.lookup.elementType[element.dataType], 
                                           element.normalize,
                                           element.stride,
                                           element.offset);
                }
            }
        },

        /**
         * @private
         * @name pc.gfx.Device#commitSamplers
         * @author Will Eastcott
         */
        commitSamplers: function () {
            var gl = this.gl;
            var i, len, sampler, value;
            var samplers = this.program.samplers;

            for (i = 0, len = samplers.length; i < len; i++) {
                sampler = samplers[i];
                texture = sampler.scopeId.value;
                if (this.textureUnits[i] !== texture) {
                    gl.activeTexture(gl.TEXTURE0 + i);
                    texture.bind();
                    this.textureUnits[i] = texture;
                }
                if (sampler.slot !== i) {
                    gl.uniform1i(sampler.locationId, i);
                    sampler.slot = i;
                }
            }
        },

        /**
         * @private
         * @name pc.gfx.Device#commitUniforms
         * @author Will Eastcott
         */
        commitUniforms: function () {
            var i, len, uniform;
            var uniforms = this.program.uniforms;
            var gl = this.gl;

            for (i = 0, len = uniforms.length; i < len; i++) {
                uniform = uniforms[i];
                // Check the value is valid
                if (uniform.version.notequals(uniform.scopeId.versionObject.version)) {

                    // Copy the version to track that its now up to date
                    uniform.version.copy(uniform.scopeId.versionObject.version);

                    // Retrieve value for this shader uniform
                    var value = uniform.scopeId.value;

                    // Call the function to commit the uniform value
                    this.commitFunction[uniform.dataType](uniform.locationId, value);

    //              uniform.commitArgs[uniform.valueIndex] = uniform.scopeId.value;
    //              uniform.commitFunc.apply(gl, uniform.commitArgs);
                }
            }
        },

        /**
         * @function
         * @name pc.gfx.Device#getBoneLimit
         * @description Queries the maximum number of bones that can be referenced by a shader.
         * The shader generators (pc.gfx.programlib) use this number to specify the matrix array
         * size of the uniform 'matrix_pose[0]'. The value is calculated based on the number of 
         * available uniform vectors available after subtracting the number taken by a typical 
         * heavyweight shader. If a different number is required, it can be tuned via
         * pc.gfx.Device#setBoneLimit.
         * @returns {Number} The maximum number of bones that can be supported by the host hardware.
         * @author Will Eastcott
         */
        getBoneLimit: function () {
            return this.boneLimit;
        },

        /**
         * @function
         * @name pc.gfx.Device#setBoneLimit
         * @description Specifies the maximum number of bones that the device can support on
         * the current hardware. This function allows the default calculated value based on
         * available vector uniforms to be overridden.
         * @param {Number} maxBones The maximum number of bones supported by the host hardware.
         * @author Will Eastcott
         */
        setBoneLimit: function (maxBones) {
            this.boneLimit = maxBones;
        },

        /**
         * @function
         * @name pc.gfx.Device#enableValidation
         * @description Activates additional validation within the engine. Internally,
         * the WebGL error code is checked after every call to a WebGL function. If an error
         * is detected, it will be output to the Javascript console. Note that enabling
         * validation will have negative performance implications for the PlayCanvas runtime.
         * @param {Boolean} enable true to activate validation and false to deactivate it.
         * @author Will Eastcott
         */
        enableValidation: function (enable) {
            if (enable === true) {
                if (this.gl instanceof WebGLRenderingContext) {

                    // Create a new WebGLValidator object to
                    // usurp the real WebGL context
                    this.gl = new WebGLValidator(this.gl);
                }
            } else {
                if (this.gl instanceof WebGLValidator) {

                    // Unwrap the real WebGL context
                    this.gl = Context.gl;
                }
            }
        },

        /**
         * @function
         * @name pc.gfx.Device#validate
         * @description Performs a one time validation on the error state of the underlying
         * WebGL API. Note that pc.gfx.Device#enableValidation does not have to be activated
         * for this function to operate. If an error is detected, it is output to the
         * Javascript console and the function returns false. Otherwise, the function returns
         * true. If an error is detected, it will have been triggered by a WebGL call between
         * the previous and this call to pc.gfx.Device#validate. If this is the first call to
         * pc.gfx.Device#validate, it detects errors since the device was created.
         * @returns {Boolean} false if there was an error and true otherwise.
         * @author Will Eastcott
         */
        validate: function () {
            var gl = this.gl;
            var error = gl.getError();

            if (error !== gl.NO_ERROR) {
                Log.error("WebGL error: " + WebGLValidator.ErrorString[error]);
                return false;
            }

            return true;
        }
    };

    Object.defineProperty(Device.prototype, 'maxSupportedMaxAnisotropy', {
        get: function() {
            var maxAnisotropy = 1;
            var glExt = this.extTextureFilterAnisotropic;
            if (glExt) {
                var gl = this.gl;
                maxAnisotropy = gl.getParameter(glExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
            }
            return maxAnisotropy;
        }
    });

    return {
        UnsupportedBrowserError: UnsupportedBrowserError,
        ContextCreationError: ContextCreationError,
        Device: Device
    }; 
}());