pc.extend(pc.gfx, function () {
    var _typeToString = {};
    _typeToString[WebGLRenderingContext.BOOL]         = "bool";
    _typeToString[WebGLRenderingContext.INT]          = "int";
    _typeToString[WebGLRenderingContext.FLOAT]        = "float";
    _typeToString[WebGLRenderingContext.FLOAT_VEC2]   = "vec2";
    _typeToString[WebGLRenderingContext.FLOAT_VEC3]   = "vec3";
    _typeToString[WebGLRenderingContext.FLOAT_VEC4]   = "vec4";
    _typeToString[WebGLRenderingContext.INT_VEC2]     = "ivec2";
    _typeToString[WebGLRenderingContext.INT_VEC3]     = "ivec3";
    _typeToString[WebGLRenderingContext.INT_VEC4]     = "ivec4";
    _typeToString[WebGLRenderingContext.BOOL_VEC2]    = "bvec2";
    _typeToString[WebGLRenderingContext.BOOL_VEC3]    = "bvec3";
    _typeToString[WebGLRenderingContext.BOOL_VEC4]    = "bvec4";
    _typeToString[WebGLRenderingContext.FLOAT_MAT2]   = "mat2";
    _typeToString[WebGLRenderingContext.FLOAT_MAT3]   = "mat3";
    _typeToString[WebGLRenderingContext.FLOAT_MAT4]   = "mat4";
    _typeToString[WebGLRenderingContext.SAMPLER_2D]   = "sampler2D";
    _typeToString[WebGLRenderingContext.SAMPLER_CUBE] = "samplerCube";

    var _typeToPc = {};
    _typeToPc[WebGLRenderingContext.BOOL]         = pc.gfx.ShaderInputType.BOOL;
    _typeToPc[WebGLRenderingContext.INT]          = pc.gfx.ShaderInputType.INT;
    _typeToPc[WebGLRenderingContext.FLOAT]        = pc.gfx.ShaderInputType.FLOAT;
    _typeToPc[WebGLRenderingContext.FLOAT_VEC2]   = pc.gfx.ShaderInputType.VEC2;
    _typeToPc[WebGLRenderingContext.FLOAT_VEC3]   = pc.gfx.ShaderInputType.VEC3;
    _typeToPc[WebGLRenderingContext.FLOAT_VEC4]   = pc.gfx.ShaderInputType.VEC4;
    _typeToPc[WebGLRenderingContext.INT_VEC2]     = pc.gfx.ShaderInputType.IVEC2;
    _typeToPc[WebGLRenderingContext.INT_VEC3]     = pc.gfx.ShaderInputType.IVEC3;
    _typeToPc[WebGLRenderingContext.INT_VEC4]     = pc.gfx.ShaderInputType.IVEC4;
    _typeToPc[WebGLRenderingContext.BOOL_VEC2]    = pc.gfx.ShaderInputType.BVEC2;
    _typeToPc[WebGLRenderingContext.BOOL_VEC3]    = pc.gfx.ShaderInputType.BVEC3;
    _typeToPc[WebGLRenderingContext.BOOL_VEC4]    = pc.gfx.ShaderInputType.BVEC4;
    _typeToPc[WebGLRenderingContext.FLOAT_MAT2]   = pc.gfx.ShaderInputType.MAT2;
    _typeToPc[WebGLRenderingContext.FLOAT_MAT3]   = pc.gfx.ShaderInputType.MAT3;
    _typeToPc[WebGLRenderingContext.FLOAT_MAT4]   = pc.gfx.ShaderInputType.MAT4;
    _typeToPc[WebGLRenderingContext.SAMPLER_2D]   = pc.gfx.ShaderInputType.TEXTURE2D;
    _typeToPc[WebGLRenderingContext.SAMPLER_CUBE] = pc.gfx.ShaderInputType.TEXTURECUBE;
    
    /**
     * @name pc.gfx.Program
     * @class A program representing a compiled and linked vertex and fragment shader pair.
     * @param {pc.gfx.Shader} vertexShader
     * @param {pc.gfx.Shader} fragmentShader
     */
    var Program = function (vertexShader, fragmentShader) {
        this.attributes = [];
        this.uniforms   = [];
        
        // Create the WebGL program ID
        var gl = pc.gfx.Device.getCurrent().gl;
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
        var numAttributes = gl.getProgramParameter(this.programId, gl.ACTIVE_ATTRIBUTES);
        while (i < numAttributes) {
            var info = gl.getActiveAttrib(this.programId, i++);
            var locationId = gl.getAttribLocation(this.programId, info.name);
            this.attributes.push(new pc.gfx.ShaderInput(info.name, _typeToPc[info.type], locationId));

            logDEBUG("Added shader attribute: " + _typeToString[info.type] + " " + info.name);
        }

        // Query the program for each shader state (GLSL 'uniform')
        i = 0;
        var numUniforms = gl.getProgramParameter(this.programId, gl.ACTIVE_UNIFORMS);
        while (i < numUniforms) {
            var info = gl.getActiveUniform(this.programId, i++);
            var locationId = gl.getUniformLocation(this.programId, info.name);
            this.uniforms.push(new pc.gfx.ShaderInput(info.name, _typeToPc[info.type], locationId));

            logDEBUG("Added shader uniform: " + _typeToString[info.type] + " " + info.name);
        }
    }

    return {
        Program: Program
    }; 
}());