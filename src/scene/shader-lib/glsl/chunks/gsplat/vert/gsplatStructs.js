export default /* glsl */`

// stores the source UV and order of the splat
struct SplatSource {
    uint order;         // render order
    uint id;            // splat id
    ivec2 uv;           // splat uv
    vec2 cornerUV;      // corner coordinates for this vertex of the gaussian (-1, -1)..(1, 1)
};

// stores the camera and clip space position of the gaussian center
struct SplatCenter {
    vec3 view;          // center in view space
    vec4 proj;          // center in clip space
    mat4 modelView;     // model-view matrix
    float projMat00;    // element [0][0] of the projection matrix
};

// stores the offset from center for the current gaussian
struct SplatCorner {
    vec2 offset;        // corner offset from center in clip space
    vec2 uv;            // corner uv
    #if GSPLAT_AA
        float aaFactor; // for scenes generated with antialiasing
    #endif

    vec2 v;
    float dlen;
};

`;
