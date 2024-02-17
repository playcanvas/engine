/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    FILES: {
        "shader.vert": "\n// Attributes per vertex: position\nattribute vec4 aPosition;\n\nuniform mat4   matrix_viewProjection;\nuniform mat4   matrix_model;\n\n// time\nuniform float uTime;\n\n// Color to fragment program\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // Transform the geometry\n    mat4 modelViewProj = matrix_viewProjection * matrix_model;\n    gl_Position = modelViewProj * aPosition;\n\n    // vertex in world space\n    vec4 vertexWorld = matrix_model * aPosition;\n\n    // use sine way to generate intensity value based on time and also y-coordinate of model\n    float intensity = abs(sin(0.6 * vertexWorld.y + uTime * 1.0));\n\n    // intensity smoothly drops to zero for smaller values than 0.9\n    intensity = smoothstep(0.9, 1.0, intensity);\n\n    // point size depends on intensity\n    // WebGPU doesn't support setting gl_PointSize to anything besides a constant 1.0\n    #ifndef WEBGPU\n        gl_PointSize = clamp(12.0 * intensity, 1.0, 64.0);\n    #endif\n\n    // color mixes red and yellow based on intensity\n    outColor = mix(vec4(1.0, 1.0, 0.0, 1.0), vec4(0.9, 0.0, 0.0, 1.0), intensity);\n}",
        "shader.frag": "\nprecision lowp float;\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // just output color supplied by vertex shader\n    gl_FragColor = outColor;\n}"
    }
};
