pc.extend(pc, function () {
    'use strict';

    function addLineNumbers(src) {
        var chunks = src.split("\n");

        // Chrome reports shader errors on lines indexed from 1
        for (var i = 0, len = chunks.length; i < len; i ++) {
            chunks[i] = (i+1) + ":\t" + chunks[i];
        }

        return chunks.join( "\n" );
    }

    function createShader(gl, type, src) {
        var shader = gl.createShader(type);

        gl.shaderSource(shader, src);
        gl.compileShader(shader);

        return shader;
    }

    function createProgram(gl, vertexShader, fragmentShader) {
        var program = gl.createProgram();

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);

        return program;
    }

    /**
     * @name pc.Shader
     * @class A shader is a program that is repsonsible for rendering graphical primitives on a device's
     * graphics processor.
     * @constructor Creates a new shader object. The shader is generated from a shader definition. This
     * shader definition specifies the code for processing vertices and fragments processed by the GPU.
     * The language of the code is GLSL (or more specifically ESSL, the OpenGL ES Shading Language). The
     * shader definition also describes how the PlayCanvas engine should map vertex buffer elements onto
     * the attributes specified in the vertex shader code.
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device used to manage this shader.
     * @param {Object} definition The shader definition from which to build the shader.
     * @param {Object} definition.attributes Object detailing the mapping of vertex shader attribute names to semantics (pc.SEMANTIC_*).
     * @param {String} definition.vshader Vertex shader source (GLSL code).
     * @param {String} definition.fshader Fragment shader source (GLSL code).
     * @example
     * // Create a shader that renders primitives with a solid red color
     * var shaderDefinition = {
     *     attributes: {
     *         aPosition: pc.SEMANTIC_POSITION
     *     },
     *     vshader: [
     *         "attribute vec3 aPosition;",
     *         "",
     *         "void main(void)",
     *         "{",
     *         "    gl_Position = vec4(aPosition, 1.0);",
     *         "}"
     *     ].join("\n"),
     *     fshader: [
     *         "precision mediump float;",
     *         "",
     *         "void main(void)",
     *         "{",
     *         "    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);",
     *         "}"
     *     ].join("\n")
     * };
     *
     * shader = new pc.Shader(graphicsDevice, shaderDefinition);
     * @author Will Eastcott
     */
    var Shader = function (graphicsDevice, definition) {
        this.device = graphicsDevice;
        this.definition = definition;
        this.ready = false;

        var gl = this.device.gl;
        this.vshader = createShader(gl, gl.VERTEX_SHADER, definition.vshader);
        this.fshader = createShader(gl, gl.FRAGMENT_SHADER, definition.fshader);
        this.program = createProgram(gl, this.vshader, this.fshader);
    };

    Shader.prototype = {
        link: function () {
            var gl = this.device.gl;

            gl.linkProgram(this.program);

            // check for errors
            // vshader
            if (! gl.getShaderParameter(this.vshader, gl.COMPILE_STATUS))
                logERROR("Failed to compile vertex shader:\n\n" + addLineNumbers(this.definition.vshader) + "\n\n" + gl.getShaderInfoLog(this.vshader));
            // fshader
            if (! gl.getShaderParameter(this.fshader, gl.COMPILE_STATUS))
                logERROR("Failed to compile fragment shader:\n\n" + addLineNumbers(this.definition.fshader) + "\n\n" + gl.getShaderInfoLog(this.fshader));
            // program
            if (! gl.getProgramParameter(this.program, gl.LINK_STATUS))
                logERROR("Failed to link shader program. Error: " + gl.getProgramInfoLog(this.program));

            gl.deleteShader(this.vshader);
            gl.deleteShader(this.fshader);

            this.attributes = [];
            this.uniforms = [];
            this.samplers = [];

            // Query the program for each vertex buffer input (GLSL 'attribute')
            var i = 0;
            var info, location;

            var _typeToPc = {};
            _typeToPc[gl.BOOL]         = pc.UNIFORMTYPE_BOOL;
            _typeToPc[gl.INT]          = pc.UNIFORMTYPE_INT;
            _typeToPc[gl.FLOAT]        = pc.UNIFORMTYPE_FLOAT;
            _typeToPc[gl.FLOAT_VEC2]   = pc.UNIFORMTYPE_VEC2;
            _typeToPc[gl.FLOAT_VEC3]   = pc.UNIFORMTYPE_VEC3;
            _typeToPc[gl.FLOAT_VEC4]   = pc.UNIFORMTYPE_VEC4;
            _typeToPc[gl.INT_VEC2]     = pc.UNIFORMTYPE_IVEC2;
            _typeToPc[gl.INT_VEC3]     = pc.UNIFORMTYPE_IVEC3;
            _typeToPc[gl.INT_VEC4]     = pc.UNIFORMTYPE_IVEC4;
            _typeToPc[gl.BOOL_VEC2]    = pc.UNIFORMTYPE_BVEC2;
            _typeToPc[gl.BOOL_VEC3]    = pc.UNIFORMTYPE_BVEC3;
            _typeToPc[gl.BOOL_VEC4]    = pc.UNIFORMTYPE_BVEC4;
            _typeToPc[gl.FLOAT_MAT2]   = pc.UNIFORMTYPE_MAT2;
            _typeToPc[gl.FLOAT_MAT3]   = pc.UNIFORMTYPE_MAT3;
            _typeToPc[gl.FLOAT_MAT4]   = pc.UNIFORMTYPE_MAT4;
            _typeToPc[gl.SAMPLER_2D]   = pc.UNIFORMTYPE_TEXTURE2D;
            _typeToPc[gl.SAMPLER_CUBE] = pc.UNIFORMTYPE_TEXTURECUBE;

            var numAttributes = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
            while (i < numAttributes) {
                info = gl.getActiveAttrib(this.program, i++);
                location = gl.getAttribLocation(this.program, info.name);

                // Check attributes are correctly linked up
                if (this.definition.attributes[info.name] === undefined) {
                    console.error('Vertex shader attribute "' + info.name + '" is not mapped to a semantic in shader definition.');
                }

                var attr = new pc.ShaderInput(this.device, this.definition.attributes[info.name], _typeToPc[info.type], location);
                this.attributes.push(attr);
            }

            // Query the program for each shader state (GLSL 'uniform')
            i = 0;
            var numUniforms = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
            while (i < numUniforms) {
                info = gl.getActiveUniform(this.program, i++);
                location = gl.getUniformLocation(this.program, info.name);
                if ((info.type === gl.SAMPLER_2D) || (info.type === gl.SAMPLER_CUBE)) {
                    this.samplers.push(new pc.ShaderInput(this.device, info.name, _typeToPc[info.type], location));
                } else {
                    this.uniforms.push(new pc.ShaderInput(this.device, info.name, _typeToPc[info.type], location));
                }
            }

            this.ready = true;
        },

        /**
         * @function
         * @name pc.Shader#destroy
         * @description Frees resources associated with this shader.
         */
        destroy: function () {
            var gl = this.device.gl;
            gl.deleteProgram(this.program);
        }
    };

    return {
        Shader: Shader
    };
}());
