/**
 * WGSL shader chunks for the trees example.
 * These chunks override StandardMaterial default behavior to create animated trees with fog.
 */

// Fragment chunk to add custom uniforms
export const litUserDeclarationPS = /* wgsl */ `
    uniform myTime: f32;
    uniform myFogParams: vec2f;
`;

// Override existing diffuse fragment chunk to blend between two colors based on time
export const diffusePS = /* wgsl */ `
fn getAlbedo() {
    let blend: f32 = 0.5 + 0.5 * sin(uniform.myTime * 0.5);
    let green: vec3f = vec3f(0.2, 1.0, 0.0);
    let orange: vec3f = vec3f(1.0, 0.2, 0.0);
    dAlbedo = mix(green, orange, blend);
}
`;

// Fragment chunk that runs at the end of the main function to apply ground fog
export const litUserMainEndPS = /* wgsl */ `
    let fogColor: vec3f = vec3f(1.0, 1.0, 1.0);
    let fogStart: f32 = uniform.myFogParams.x;
    let fogEnd: f32 = uniform.myFogParams.y;

    // Compute fog amount based on height
    let fogFactor: f32 = clamp((vPositionW.y - fogStart) / (fogEnd - fogStart), 0.0, 1.0);
    output.color = vec4f(mix(fogColor, output.color.rgb, fogFactor), output.color.a);
`;

// Vertex shader chunk to customize vertex position with wind sway animation
export const transformCoreVS = /* wgsl */ `

    uniform myTime: f32;   // add time uniform to vertex shader

    // these are existing attributes and uniforms
    attribute vertex_position: vec4f;
    uniform matrix_viewProjection: mat4x4f;
    uniform matrix_model: mat4x4f;

    #if defined(INSTANCING)
        #include "transformInstancingVS"
    #endif

    // provide a replacement function here to do the actual work, instead of simply returning the vertexPosition
    fn getLocalPosition(vertexPosition: vec3f) -> vec3f {
        // Extract the position (translation) from the model matrix - this is the position of the instance of the tree
        let treePosition: vec3f = getModelMatrix()[3].xyz;

        // and use it to generate a random seed for the sway, so all trees are not synchronized
        let randomSeed: f32 = treePosition.x * 0.1 + treePosition.z * 0.5;

        // Height-based sway factor (0 at base, 1 at top). Note that the pivot point of the tree is not at the base,
        // so compensate for that.
        let heightFromBase: f32 = vertexPosition.y + 4.5;
        let maxSwayHeight: f32 = 9.0;
        let swayFactor: f32 = clamp(heightFromBase / maxSwayHeight, 0.0, 1.0);

        // Parameters - could be exposed as uniforms
        let swayStrength: f32 = 0.3;
        let swaySpeed: f32 = 2.0;

        // sway the tree
        var localPos: vec3f = vertexPosition;
        let bendOffset: f32 = sin(uniform.myTime * swaySpeed + randomSeed);
        localPos.x = localPos.x + bendOffset * swayFactor * heightFromBase * swayStrength;

        return localPos;
    }
`;
