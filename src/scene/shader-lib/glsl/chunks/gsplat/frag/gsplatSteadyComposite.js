export default /* glsl */`
#include "sceneTexturesPS"
varying vec2 steadyUV;
uniform highp sampler2D steadyImage;
uniform highp usampler2D steadySamples;
uniform mat4 steadyProjection;

void main(void) {
    ivec2 size = textureSize(steadyImage, 0);
    ivec2 p = clamp(ivec2(steadyUV * vec2(size)), ivec2(0), size - 1);
    vec4 color = texelFetch(steadyImage, p, 0);
    uvec4 sampleData = texelFetch(steadySamples, p, 0);
    if (color.a <= 0.0) discard;
    float depth = sampleData.x != 0u ? uintBitsToFloat(sampleData.y) : 1e20;
    vec4 clip = steadyProjection * vec4(0.0, 0.0, -depth, 1.0);
    gl_FragDepth = sampleData.x != 0u ? clip.z / clip.w * 0.5 + 0.5 : 1.0;
    pcFragColor0 = vec4(max(color.rgb, 0.0), color.a);
    #ifdef SCENE_TEXTURE_DEPTH
        writeSceneTextureDepth(depth, color.a);
    #endif
}
`;
