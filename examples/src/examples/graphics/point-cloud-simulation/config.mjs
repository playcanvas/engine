/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    FILES: {
        "shader.vert": "\n// Attributes per vertex: position\nattribute vec4 aPosition;\n\nuniform mat4   matrix_viewProjection;\nuniform mat4   matrix_model;\n\n// position of the camera\nuniform vec3 view_position;\n\n// Color to fragment program\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // Transform the geometry\n    mat4 modelViewProj = matrix_viewProjection * matrix_model;\n    gl_Position = modelViewProj * aPosition;\n\n    // vertex in world space\n    vec4 vertexWorld = matrix_model * aPosition;\n\n    // point sprite size depends on its distance to camera\n    // WebGPU doesn't support setting gl_PointSize to anything besides a constant 1.0\n    #ifndef WEBGPU\n        float dist = 25.0 - length(vertexWorld.xyz - view_position);\n        gl_PointSize = clamp(dist * 2.0 - 1.0, 1.0, 15.0);\n    #endif\n\n    // color depends on position of particle\n    outColor = vec4(vertexWorld.y * 0.1, 0.1, vertexWorld.z * 0.1, 1.0);\n}",
        "shader.frag": "\nprecision mediump float;\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // color supplied by vertex shader\n    gl_FragColor = outColor;\n\n    // Using gl_PointCoord in WebGPU fails to compile with: \"unknown SPIR-V builtin: 16\"\n    #ifndef WEBGPU\n        // make point round instead of square - make pixels outside of the circle black, using provided gl_PointCoord\n        vec2 dist = gl_PointCoord.xy - vec2(0.5, 0.5);\n        gl_FragColor.a = 1.0 - smoothstep(0.4, 0.5, sqrt(dot(dist, dist)));\n    #endif\n}"
    }
};
