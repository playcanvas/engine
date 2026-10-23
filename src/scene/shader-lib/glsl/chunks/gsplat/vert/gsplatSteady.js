export default /* glsl */`
#include "gsplatCommonVS"

varying highp vec2 gaussianUV;
flat varying highp vec4 gaussianColor;
flat varying highp vec2 steadyCenter;
flat varying highp float steadyDepth;
flat varying highp uint steadyId;
flat varying highp uint steadyNoisePhase;

void main(void) {
    SplatSource source;
    if (!initSource(source)) {
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        return;
    }
    vec3 modelCenter = getCenter();
    SplatCenter center;
    center.modelCenterOriginal = modelCenter;
    modifySplatCenter(modelCenter);
    center.modelCenterModified = modelCenter;
    if (!initCenter(modelCenter, center)) {
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        return;
    }
    SplatCorner corner;
    if (!initCorner(source, center, corner)) {
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        return;
    }
    float opacity = getOpacity();
    vec4 color = vec4(getColor(), opacity);
    #if GSPLAT_AA
        color.a *= corner.aaFactor;
    #endif
    modifySplatColor(modelCenter, color);
    if (color.a <= alphaClipForward) {
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        return;
    }
    clipCorner(corner, color.a);
    gl_Position = center.proj + vec4(corner.offset, 0.0);
    gaussianUV = corner.uv;
    gaussianColor = vec4(prepareOutputFromGamma(max(color.rgb, 0.0), -center.view.z), color.a);
    steadyCenter = (center.proj.xy / center.proj.w * 0.5 + 0.5) * viewport_size.xy;
    steadyDepth = -center.view.z;
    steadyId = splat.index + 1u;
    steadyNoisePhase = steadyPrimitivePhase(steadyId);
}
`;
