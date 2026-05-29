// main shader of the lit vertex shader
export default /* wgsl */`

#include "varyingsVS"

#include  "litUserDeclarationVS"

#ifdef VERTEX_COLOR
    attribute vertex_color: vec4f;
#endif

#ifdef NINESLICED

    varying vMask: vec2f;
    varying vTiledUv: vec2f;

    var<private> dMaskGlobal: vec2f;
    var<private> dTiledUvGlobal: vec2f;

    uniform innerOffset: vec4f;
    uniform outerScale: vec2f;
    uniform atlasRect: vec4f;

#endif

var<private> dPositionW: vec3f;
var<private> dModelMatrix: mat4x4f;

#include "transformCoreVS"

#ifdef UV0
    attribute vertex_texCoord0: vec2f;
    #include "uv0VS"
#endif

#ifdef UV1
    attribute vertex_texCoord1: vec2f;
    #include "uv1VS"
#endif


#ifdef LINEAR_DEPTH
    #ifndef VIEWMATRIX
    #define VIEWMATRIX
        uniform matrix_view: mat4x4f;
    #endif
#endif

#include "transformVS"

#ifdef NORMALS
    #include "normalCoreVS"
    #include "normalVS"
#endif

#ifdef TANGENTS
    attribute vertex_tangent: vec4f;
#endif

// expand uniforms for uv transforms
#include "uvTransformUniformsPS, UV_TRANSFORMS_COUNT"

#ifdef MSDF
    #include "msdfVS"
#endif

#include  "litUserCodeVS"

#ifdef VERTEX_COLOR
    fn decodeGamma3(raw: vec3f) -> vec3f {
        return pow(raw, vec3f(2.2));
    }
    fn gammaCorrectInputVec4(color: vec4f) -> vec4f {
        return vec4f(decodeGamma3(color.xyz), color.w);
    }
#endif

@vertex
fn vertexMain(input : VertexInput) -> VertexOutput {

    #include "litUserMainStartVS"

    var output : VertexOutput;
    output.position = getPosition();
    output.vPositionW = getWorldPosition();

    #ifdef NORMALS
        output.vNormalW = getNormal();
    #endif

    #ifdef TANGENTS
        output.vTangentW = normalize(dNormalMatrix * vertex_tangent.xyz);
        output.vBinormalW = cross(output.vNormalW, output.vTangentW) * vertex_tangent.w;
    #elif defined(GGX_SPECULAR)
        output.vObjectSpaceUpW = normalize(dNormalMatrix * vec3f(0.0, 1.0, 0.0));
    #endif

    #ifdef UV0
        var uv0: vec2f = getUv0();
        #ifdef UV0_UNMODIFIED
            output.vUv0 = uv0;
        #endif
    #endif

    #ifdef UV1
        var uv1: vec2f = getUv1();
        #ifdef UV1_UNMODIFIED
            output.vUv1 = uv1;
        #endif
    #endif

    // expand code for uv transforms
    #include "uvTransformVS, UV_TRANSFORMS_COUNT"

    #ifdef VERTEX_COLOR
        #ifdef STD_VERTEX_COLOR_GAMMA
            output.vVertexColor = gammaCorrectInputVec4(vertex_color);
        #else
            output.vVertexColor = vertex_color;
        #endif
    #endif

    #ifdef LINEAR_DEPTH
        // linear depth from the worldPosition, see getLinearDepth
        output.vLinearDepth = -(uniform.matrix_view * vec4f(output.vPositionW, 1.0)).z;
    #endif

    #ifdef MSDF
        unpackMsdfParams();

        output.outline_color = dOutlineColor;
        output.outline_thickness = dOutlineThickness;
        output.shadow_color = dShadowColor;
        output.shadow_offset = dShadowOffset;
    #endif

    #ifdef NINESLICED
        output.vMask = dMaskGlobal;
        output.vTiledUv = dTiledUvGlobal;
    #endif

    #include "litUserMainEndVS"

    return output;
}
`;
