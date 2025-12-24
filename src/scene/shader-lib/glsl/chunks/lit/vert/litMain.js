// main shader of the lit vertex shader
export default /* glsl */`

#include "varyingsVS"

#include  "litUserDeclarationVS"

#ifdef VERTEX_COLOR
    attribute vec4 vertex_color;
#endif

#ifdef NINESLICED

    varying vec2 vMask;
    varying vec2 vTiledUv;

    uniform mediump vec4 innerOffset;
    uniform mediump vec2 outerScale;
    uniform mediump vec4 atlasRect;

#endif

vec3 dPositionW;
mat4 dModelMatrix;

#include "transformCoreVS"

#ifdef UV0
    attribute vec2 vertex_texCoord0;
    #include "uv0VS"
#endif

#ifdef UV1
    attribute vec2 vertex_texCoord1;
    #include "uv1VS"
#endif


#ifdef LINEAR_DEPTH
    #ifndef VIEWMATRIX
    #define VIEWMATRIX
        uniform mat4 matrix_view;
    #endif
#endif

#include "transformVS"

#ifdef NORMALS
    #include "normalCoreVS"
    #include "normalVS"
#endif

#ifdef TANGENTS
    attribute vec4 vertex_tangent;
#endif

// expand uniforms for uv transforms
#include "uvTransformUniformsPS, UV_TRANSFORMS_COUNT"

#ifdef MSDF
    #include "msdfVS"
#endif

#include  "litUserCodeVS"

#ifdef VERTEX_COLOR
    vec3 decodeGamma(vec3 raw) {
        return pow(raw, vec3(2.2));
    }
    vec4 gammaCorrectInput(vec4 color) {
        return vec4(decodeGamma(color.xyz), color.w);
    }
#endif

void main(void) {

    #include "litUserMainStartVS"

    // default point size to 1 in case the shader is used with points
    gl_PointSize = 1.0;

    gl_Position = getPosition();
    vPositionW = getWorldPosition();

    #ifdef NORMALS
        vNormalW = getNormal();
    #endif

    #ifdef TANGENTS
        vTangentW = normalize(dNormalMatrix * vertex_tangent.xyz);
        vBinormalW = cross(vNormalW, vTangentW) * vertex_tangent.w;
    #elif defined(GGX_SPECULAR)
        vObjectSpaceUpW = normalize(dNormalMatrix * vec3(0, 1, 0));
    #endif

    #ifdef UV0
        vec2 uv0 = getUv0();
        #ifdef UV0_UNMODIFIED
            vUv0 = uv0;
        #endif
    #endif

    #ifdef UV1
        vec2 uv1 = getUv1();
        #ifdef UV1_UNMODIFIED
            vUv1 = uv1;
        #endif
    #endif

    // expand code for uv transforms
    #include "uvTransformVS, UV_TRANSFORMS_COUNT"

    #ifdef VERTEX_COLOR
        #ifdef STD_VERTEX_COLOR_GAMMA
            vVertexColor = gammaCorrectInput(vertex_color);
        #else
            vVertexColor = vertex_color;
        #endif
    #endif

    #ifdef LINEAR_DEPTH
        // linear depth from the worldPosition, see getLinearDepth
        vLinearDepth = -(matrix_view * vec4(vPositionW, 1.0)).z;
    #endif

    #ifdef MSDF
        unpackMsdfParams();
    #endif

    #include "litUserMainEndVS"
}
`;
