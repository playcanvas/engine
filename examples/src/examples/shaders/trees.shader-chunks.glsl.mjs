/**
 * GLSL shader chunks for the trees example.
 * These chunks override StandardMaterial default behavior to create animated trees with fog.
 */

// Fragment chunk to add custom uniforms
export const litUserDeclarationPS = /* glsl */ `
    uniform float myTime;
    uniform vec2 myFogParams;
`;

// Override existing diffuse fragment chunk to blend between two colors based on time
export const diffusePS = /* glsl */ `
void getAlbedo() {
    float blend = 0.5 + 0.5 * sin(myTime * 0.5);
    vec3 green = vec3(0.2, 1.0, 0.0);
    vec3 orange = vec3(1.0, 0.2, 0.0);
    dAlbedo = mix(green, orange, blend);
}
`;

// Fragment chunk that runs at the end of the main function to apply ground fog
export const litUserMainEndPS = /* glsl */ `
    vec3 fogColor = vec3(1.0, 1.0, 1.0);
    float fogStart = myFogParams.x;
    float fogEnd = myFogParams.y;

    // Compute fog amount based on height
    float fogFactor = clamp((vPositionW.y - fogStart) / (fogEnd - fogStart), 0.0, 1.0);
    gl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, fogFactor);
`;

// Vertex shader chunk to customize vertex position with wind sway animation
export const transformCoreVS = /* glsl */ `

    uniform float myTime;   // add time uniform to vertex shader

    // these are existing attributes and uniforms
    attribute vec4 vertex_position;
    uniform mat4 matrix_viewProjection;
    uniform mat4 matrix_model;

    #if defined(INSTANCING)
        #include "transformInstancingVS"
    #endif

    // provide a replacement function here to do the actual work, instead of simply returning the vertexPosition
    vec3 getLocalPosition(vec3 vertexPosition) {
        // Extract the position (translation) from the model matrix - this is the position of the instance of the tree
        vec3 treePosition = getModelMatrix()[3].xyz;

        // and use it to generate a random seed for the sway, so all trees are not synchronized
        float randomSeed = treePosition.x * 0.1 + treePosition.z * 0.5;

        // Height-based sway factor (0 at base, 1 at top). Note that the pivot point of the tree is not at the base,
        // so compensate for that.
        float heightFromBase = vertexPosition.y + 4.5;
        float maxSwayHeight = 9.0;
        float swayFactor = clamp(heightFromBase / maxSwayHeight, 0.0, 1.0);

        // Parameters - could be exposed as uniforms
        float swayStrength = 0.3;
        float swaySpeed = 2.0;

        // sway the tree
        vec3 localPos = vertexPosition;
        float bendOffset = sin(myTime * swaySpeed + randomSeed);
        localPos.x += bendOffset * swayFactor * heightFromBase * swayStrength;

        return localPos;
    }
`;
