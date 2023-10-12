export default /* glsl */`

vec3 getShadowSampleCoord$LIGHT(mat4 shadowTransform, vec4 shadowParams, vec3 worldPosition, vec3 lightPos, inout vec3 lightDir, vec3 lightDirNorm, vec3 normal) {

    vec3 surfacePosition = worldPosition;

#ifdef SHADOW_SAMPLE_POINT
    #ifdef SHADOW_SAMPLE_NORMAL_OFFSET
        float distScale = length(lightDir);
        surfacePosition = worldPosition + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0) * distScale;
        lightDir = surfacePosition - lightPos;
        return lightDir;
    #endif
#else
    #ifdef SHADOW_SAMPLE_SOURCE_ZBUFFER
        #ifdef SHADOW_SAMPLE_NORMAL_OFFSET
            surfacePosition = worldPosition + normal * shadowParams.y;
        #endif
    #else
        #ifdef SHADOW_SAMPLE_NORMAL_OFFSET
            #ifdef SHADOW_SAMPLE_ORTHO
                float distScale = 1.0;
            #else
                float distScale = abs(dot(vPositionW - lightPos, lightDirNorm));
            #endif
            surfacePosition = worldPosition + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0) * distScale;
        #endif
    #endif

    vec4 positionInShadowSpace = shadowTransform * vec4(surfacePosition, 1.0);
    #ifdef SHADOW_SAMPLE_ORTHO
        positionInShadowSpace.z = saturate(positionInShadowSpace.z) - 0.0001;
    #else
        #ifdef SHADOW_SAMPLE_SOURCE_ZBUFFER
            positionInShadowSpace.xyz /= positionInShadowSpace.w;
        #else
            positionInShadowSpace.xy /= positionInShadowSpace.w;
            positionInShadowSpace.z = length(lightDir) * shadowParams.w;
        #endif
    #endif

    #ifdef SHADOW_SAMPLE_Z_BIAS
        positionInShadowSpace.z += getShadowBias(shadowParams.x, shadowParams.z);
    #endif
    surfacePosition = positionInShadowSpace.xyz;
#endif

    return surfacePosition;
}
`;
