pc.gfx.programlib.basic = {};

pc.gfx.programlib.basic.generateKey = function (options) {
    var key = "basic";
    if (options.fog)          key += "_fog";
    if (options.alphaTest)    key += "_atst";
    if (options.vertexColors) key += "_vcol";
    if (options.diffuseMap)   key += "_diff";
    return key;
}

pc.gfx.programlib.basic.generateVertexShader = function (options) {
    var code = "";

    // VERTEX SHADER INPUTS: ATTRIBUTES
    code += "attribute vec3 vertex_position;\n";
    if (options.vertexColors) {
        code += "attribute vec4 vertex_color;\n";
    }
    if (options.diffuseMap) {
        code += "attribute vec2 vertex_texCoord0;\n";
    }

    // VERTEX SHADER INPUTS: UNIFORMS
    code += "uniform mat4 matrix_viewProjection;\n";
    code += "uniform mat4 matrix_model;\n";

    // VERTEX SHADER OUTPUTS
    if (options.vertexColors) {
        code += "varying vec4 vColor;\n";
    }
    if (options.diffuseMap) {
        code += "varying vec2 vUv0;\n";
    }
    code += "\n";

    // VERTEX SHADER BODY
    code += "void main(void)\n";
    code += "{\n";
    // Transform to vertex position to screen
    code += "    gl_Position = matrix_viewProjection * matrix_model * vec4(vertex_position, 1.0);\n";
    if (options.vertexColors) {
        code += "    vColor = vertex_color;\n";
    }
    if (options.diffuseMap) {
        code += "    vUv0 = vertex_texCoord0;\n";
    }
    code += "}";
    
    return code;
}

pc.gfx.programlib.basic.generateFragmentShader = function (options) {
    var code = "";

    code += "precision mediump float;\n\n";

    // FRAGMENT SHADER INPUTS: VARYINGS
    if (options.vertexColors) {
        code += "varying vec4 vColor;\n";
    }
    if (options.diffuseMap) {
        code += "varying vec2 vUv0;\n";
    }

    // FRAGMENT SHADER INPUTS: UNIFORMS
    if (!options.vertexColors) {
        code += "uniform vec4 constant_color;\n";
    }
    if (options.diffuseMap) {
        code += "uniform sampler2D texture_diffuseMap;\n";
    }
    if (options.fog) {
        code += "uniform vec4 fog_color;\n";
        code += "uniform float fog_density;\n\n";
    }
    if (options.alphatest) {
        code += "uniform float alpha_ref;\n";
    }
    code += "\n";

    code += "void main(void)\n";
    code += "{\n";
    // Read the map texels that the shader needs
    if (options.vertexColors) {
        code += "    vec4 color = vColor;\n";
    } else {
        code += "    vec4 color = constant_color;\n";
    }
    if (options.diffuseMap) {
        code += "    color *= texture2D(texture_diffuseMap, vUv0);\n";
    }

    if (options.alphatest) {
        code += "    if (color.a <= alpha_ref)\n"; 
        code += "    {\n";
        code += "        discard;\n";
        code += "    }\n";
    }

    code += "    gl_FragColor = clamp(color, 0.0, 1.0);\n\n";

    if (options.fog) {
        // Calculate fog (equivalent to glFogi(GL_FOG_MODE, GL_EXP2);
        code += "    const float LOG2 = 1.442695;\n";
        code += "    float z = gl_FragCoord.z / gl_FragCoord.w;\n";
        code += "    float fogFactor = exp2(-fog_density * fog_density * z * z * LOG2);\n";
        code += "    fogFactor = clamp(fogFactor, 0.0, 1.0);\n";
        code += "    gl_FragColor = mix(fog_color, gl_FragColor, fogFactor );\n";
    }
    code += "}";

    return code;
}