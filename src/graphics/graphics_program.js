pc.extend(pc.gfx, function () {
    var id = 0;

    /**
     * @name pc.gfx.Program
     * @class A program representing a compiled and linked vertex and fragment shader pair.
     * @param {pc.gfx.Shader} vertexShader The vertex shader to be linked into the new program.
     * @param {pc.gfx.Shader} fragmentShader The fragment shader to be linked into the new program.
     */
    var Program = function (vertexShader, fragmentShader) {
        this.id = id++;

        this.attributes = [];
        this.samplers   = [];
        this.uniforms   = [];
        
        // Create the WebGL program ID
        this.gl = pc.gfx.Device.getCurrent().gl;
        var gl = this.gl;

        var _typeToString = {};
        _typeToString[gl.BOOL]         = "bool";
        _typeToString[gl.INT]          = "int";
        _typeToString[gl.FLOAT]        = "float";
        _typeToString[gl.FLOAT_VEC2]   = "vec2";
        _typeToString[gl.FLOAT_VEC3]   = "vec3";
        _typeToString[gl.FLOAT_VEC4]   = "vec4";
        _typeToString[gl.INT_VEC2]     = "ivec2";
        _typeToString[gl.INT_VEC3]     = "ivec3";
        _typeToString[gl.INT_VEC4]     = "ivec4";
        _typeToString[gl.BOOL_VEC2]    = "bvec2";
        _typeToString[gl.BOOL_VEC3]    = "bvec3";
        _typeToString[gl.BOOL_VEC4]    = "bvec4";
        _typeToString[gl.FLOAT_MAT2]   = "mat2";
        _typeToString[gl.FLOAT_MAT3]   = "mat3";
        _typeToString[gl.FLOAT_MAT4]   = "mat4";
        _typeToString[gl.SAMPLER_2D]   = "sampler2D";
        _typeToString[gl.SAMPLER_CUBE] = "samplerCube";

        var _typeToPc = {};
        _typeToPc[gl.BOOL]         = pc.gfx.ShaderInputType.BOOL;
        _typeToPc[gl.INT]          = pc.gfx.ShaderInputType.INT;
        _typeToPc[gl.FLOAT]        = pc.gfx.ShaderInputType.FLOAT;
        _typeToPc[gl.FLOAT_VEC2]   = pc.gfx.ShaderInputType.VEC2;
        _typeToPc[gl.FLOAT_VEC3]   = pc.gfx.ShaderInputType.VEC3;
        _typeToPc[gl.FLOAT_VEC4]   = pc.gfx.ShaderInputType.VEC4;
        _typeToPc[gl.INT_VEC2]     = pc.gfx.ShaderInputType.IVEC2;
        _typeToPc[gl.INT_VEC3]     = pc.gfx.ShaderInputType.IVEC3;
        _typeToPc[gl.INT_VEC4]     = pc.gfx.ShaderInputType.IVEC4;
        _typeToPc[gl.BOOL_VEC2]    = pc.gfx.ShaderInputType.BVEC2;
        _typeToPc[gl.BOOL_VEC3]    = pc.gfx.ShaderInputType.BVEC3;
        _typeToPc[gl.BOOL_VEC4]    = pc.gfx.ShaderInputType.BVEC4;
        _typeToPc[gl.FLOAT_MAT2]   = pc.gfx.ShaderInputType.MAT2;
        _typeToPc[gl.FLOAT_MAT3]   = pc.gfx.ShaderInputType.MAT3;
        _typeToPc[gl.FLOAT_MAT4]   = pc.gfx.ShaderInputType.MAT4;
        _typeToPc[gl.SAMPLER_2D]   = pc.gfx.ShaderInputType.TEXTURE2D;
        _typeToPc[gl.SAMPLER_CUBE] = pc.gfx.ShaderInputType.TEXTURECUBE;
    
        this.programId = gl.createProgram();

        // Link together the vertex and fragment shaders
        gl.attachShader(this.programId, vertexShader.shaderId);
        gl.attachShader(this.programId, fragmentShader.shaderId);
        gl.linkProgram(this.programId);

        var ok = gl.getProgramParameter(this.programId, gl.LINK_STATUS);
        if (!ok) {
            var error = gl.getProgramInfoLog(this.programId);
            logERROR("Failed to link shader program. Error: " + error);
        }

        // Query the program for each vertex buffer input (GLSL 'attribute')
        var i = 0;
        var info, locationId;

        var numAttributes = gl.getProgramParameter(this.programId, gl.ACTIVE_ATTRIBUTES);
        while (i < numAttributes) {
            info = gl.getActiveAttrib(this.programId, i++);
            locationId = gl.getAttribLocation(this.programId, info.name);
            this.attributes.push(new pc.gfx.ShaderInput(info.name, _typeToPc[info.type], locationId));
        }

        // Query the program for each shader state (GLSL 'uniform')
        i = 0;
        var numUniforms = gl.getProgramParameter(this.programId, gl.ACTIVE_UNIFORMS);
        while (i < numUniforms) {
            info = gl.getActiveUniform(this.programId, i++);
            locationId = gl.getUniformLocation(this.programId, info.name);
            if ((info.type === gl.SAMPLER_2D) || (info.type === gl.SAMPLER_CUBE)) {
                this.samplers.push(new pc.gfx.ShaderInput(info.name, _typeToPc[info.type], locationId));
            } else {
                this.uniforms.push(new pc.gfx.ShaderInput(info.name, _typeToPc[info.type], locationId));
            }
        }
    };

    Program.prototype = {
        /**
         * @function
         * @name pc.gfx.Program#destroy
         * @description Frees resources associated with this program.
         * @author Will Eastcott
         */
        destroy: function () {
            var gl = this.gl;
            gl.deleteProgram(this.programId);
        }
    };

    return {
        Program: Program
    };
}());