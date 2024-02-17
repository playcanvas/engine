/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    WEBGPU_ENABLED: true,
    FILES: {
        "output.frag": "\n            #ifdef MYMRT_PASS\n                // output world normal to target 1\n                pcFragColor1 = vec4(litArgs_worldNormal * 0.5 + 0.5, 1.0);\n\n                // output gloss to target 2\n                pcFragColor2 = vec4(vec3(litArgs_gloss) , 1.0);\n            #endif\n        "
    }
};
