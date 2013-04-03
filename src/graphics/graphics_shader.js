pc.extend(pc.gfx, function () {
    /**
     * @name pc.gfx.Shader
     * @class A shader object. Can be a vertex or fragment shader. A vertex and fragment shader
     * pair can be linked into a program which is used to process geometry on the GPU (see pc.gfx.Program).
     * @param {Number} type The type of shader to generate (see pc.gfx.SHADERTYPE_*).
     * @param {String} src The shader source to be compiled into the shader object.
     */
    var Shader = function (type, src) {
        // Store the shader type
        this.type = type;

        // Store the shader source code
        this.src = src;

        // Create the WebGL shader ID
        this.gl = pc.gfx.Device.getCurrent().gl;
        var gl = this.gl;
        var glType = (this.type === pc.gfx.SHADERTYPE_VERTEX) ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER;
        this.shaderId = gl.createShader(glType);

        // Compile the shader
        gl.shaderSource(this.shaderId, this.src);
        gl.compileShader(this.shaderId);

        var ok = gl.getShaderParameter(this.shaderId, gl.COMPILE_STATUS);
        if (!ok) {
            var error = gl.getShaderInfoLog(this.shaderId);
            var typeName = (this.type === pc.gfx.SHADERTYPE_VERTEX) ? "vertex" : "fragment";
            logERROR("Failed to compile " + typeName + " shader:\n" + src + "\n" + error);
        }
    };

    Shader.prototype = {
        /**
         * @function
         * @name pc.gfx.Shader#destroy
         * @description Frees resources associated with this shader.
         * @author Will Eastcott
         */
        destroy: function () {
            var gl = this.gl;
            gl.deleteShader(this.shaderId);
        },

        /**
         * @function
         * @name pc.gfx.Shader#getType
         * @description Returns the type of the shader. It can be either a vertex shader or a
         * fragment shader.
         * @returns {Number} A constant denoting a vertex shader or a fragment shader (see pc.gfx.SHADERTYPE_*).
         * @example
         * var shader = new pc.gfx.Shader(pc.gfx.SHADERTYPE_VERTEX, source);
         * var type = shader.getType();
         * if (type === pc.gfx.SHADERTYPE_VERTEX) {
         *     console.log("This is indeed a vertex shader!");
         * }
         * @author Will Eastcott
         */
        getType: function () {
            return this.type;
        },

        /**
         * @function
         * @name pc.gfx.Shader#getSource
         * @description Returns the string object that constitutes the source code for the 
         * specified shader object.
         * @returns {String} The source code for the specified shader.
         * @example
         * var shader1 = new pc.gfx.Shader(pc.gfx.SHADERTYPE_VERTEX, source);
         * var shader2 = new pc.gfx.Shader(pc.gfx.SHADERTYPE_VERTEX, shader1.getSource());
         * @author Will Eastcott
         */
        getSource: function () {
            return this.src;
        }
    };

    return {
        Shader: Shader
    }; 
}());