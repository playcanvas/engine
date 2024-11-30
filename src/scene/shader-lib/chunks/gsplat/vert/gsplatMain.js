export default /* glsl */`
#include "gsplatCoreVS"
#include "gsplatOverridesVS"
#include "gsplatOutputPS"

uniform vec3 view_position;
uniform sampler2D splatColor;
varying mediump vec2 texCoord;
varying mediump vec4 color;

mediump vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);

void main(void) {
    // calculate splat uv
    if (!calcSplatUV()) {
        gl_Position = discardVec;
        return;
    }

    // get gaussian's center
    vec3 center = getCenter();
    centerOverride(center);

    // handle transforms and cull behind
    mat4 model_view = matrix_view * matrix_model;
    vec4 splat_cam = model_view * vec4(center, 1.0);
    vec4 splat_proj = matrix_projection * splat_cam;
    if (splat_proj.z < -splat_proj.w) {
        gl_Position = discardVec;
        return;
    }

    // get covariance
    vec3 covA, covB;
    getCovariance(covA, covB);
    scaleOverride(center, covA, covB);

    // get color
    color = texelFetch(splatColor, splatUV, 0);
    alphaOverride(center, color.a);

    // calculate scale based on alpha
    float scale = min(1.0, sqrt(-log(1.0 / 255.0 / color.a)) / 2.0);

    // calculate 2d covariance, early out small gaussians
    vec4 v1v2 = calcV1V2(splat_cam.xyz, covA, covB, transpose(mat3(model_view))) * scale;
    if (dot(v1v2.xy, v1v2.xy) < 4.0 && dot(v1v2.zw, v1v2.zw) < 4.0) {
        gl_Position = discardVec;
        return;
    }

    // calculate final vertex position
    gl_Position = splat_proj + vec4((vertex_position.x * v1v2.xy + vertex_position.y * v1v2.zw) / viewport * splat_proj.w, 0, 0);

    texCoord = vertex_position.xy * scale / 2.0;

    #ifdef USE_SH1
        vec4 worldCenter = matrix_model * vec4(center, 1.0);
        vec3 viewDir = normalize((worldCenter.xyz / worldCenter.w - view_position) * mat3(matrix_model));
        color.xyz = max(color.xyz + evalSH(viewDir), 0.0);
    #endif

    #ifndef DITHER_NONE
        id = float(splatId);
    #endif

    // perform tonemapping and gamma here instead of in the pixel shader
    colorOverride(center, color.xyz);

    color = vec4(prepareOutputFromGamma(color.xyz), color.w);
}
`;
