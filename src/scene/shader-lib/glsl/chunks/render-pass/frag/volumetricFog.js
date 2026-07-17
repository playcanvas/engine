export default /* glsl */`
    #include "screenDepthPS"

    varying vec2 uv0;

    uniform vec3 uFogCameraPos;
    uniform vec3 uFogCameraFwd;
    uniform mat4 uFogInvView;
    uniform vec2 uFogProjScale;
    uniform vec3 uFogTint;
    uniform vec3 uFogLightColor;
    uniform vec3 uFogLightDir;      // world space direction towards the light
    uniform vec3 uFogAmbient;
    uniform vec4 uFogParams;        // x: density, y: height base, z: height falloff, w: max distance
    uniform vec4 uFogScatterParams; // x: anisotropy, y: step count, z: temporal noise offset, w: shadow intensity

    #ifdef FOG_SHADOWS
        uniform mat4 uFogShadowMatrixPalette[4];
        uniform vec4 uFogShadowCascadeDistances;
        uniform vec4 uFogShadowParams; // x: cascade count, y: bias, z: unused, w: max shadow distance
        #ifdef FOG_SHADOW_PCF
            uniform sampler2DShadow uFogShadowMap;
        #else
            uniform sampler2D uFogShadowMap;
        #endif

        float sampleFogShadow(vec3 worldPos, float viewDepth) {

            // no shadow past the shadow distance
            if (viewDepth >= uFogShadowParams.w) return 1.0;

            // cascade index based on the view depth
            vec4 comparisons = step(uFogShadowCascadeDistances, vec4(viewDepth));
            int cascadeIndex = int(min(dot(comparisons, vec4(1.0)), uFogShadowParams.x - 1.0));

            vec3 shadowCoord = (uFogShadowMatrixPalette[cascadeIndex] * vec4(worldPos, 1.0)).xyz;
            float z = shadowCoord.z - uFogShadowParams.y;

            #ifdef FOG_SHADOW_PCF
                // hardware comparison on the depth format shadow map
                return textureShadow(uFogShadowMap, vec3(shadowCoord.xy, z));
            #else
                // manual comparison on the color format shadow map storing depth (PCSS / VSM)
                return step(z, texture2D(uFogShadowMap, shadowCoord.xy).r);
            #endif
        }
    #endif

    // interleaved gradient noise
    float fogNoise(vec2 fragCoord) {
        const vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
        return fract(magic.z * fract(dot(fragCoord, magic.xy)));
    }

    // normalized Henyey-Greenstein phase function
    float fogPhase(float cosTheta, float g) {
        float g2 = g * g;
        float denom = 1.0 + g2 - 2.0 * g * cosTheta;
        return (1.0 - g2) / (12.56637 * denom * sqrt(denom));
    }

    void main() {

        // world space ray for this pixel (perspective projection). Note that uv0 addresses
        // textures (getImageEffectUV flips it on WebGPU), so undo the flip to get NDC
        vec2 ndcUV = uv0;
        #ifdef WEBGPU
            ndcUV.y = 1.0 - ndcUV.y;
        #endif
        vec2 ndc = ndcUV * 2.0 - 1.0;
        vec3 rayDir = normalize((uFogInvView * vec4(ndc * uFogProjScale, -1.0, 0.0)).xyz);

        // distance along the ray to the scene surface
        float rayDot = dot(rayDir, uFogCameraFwd);
        float rayLength = min(getLinearScreenDepth(uv0) / rayDot, uFogParams.w);

        float stepCount = uFogScatterParams.y;
        float dt = rayLength / stepCount;

        // per-pixel noise offsets the samples along the ray to hide banding, and cycles over
        // frames when TAA is used to temporally accumulate to a smooth result
        float noise = fract(fogNoise(gl_FragCoord.xy) + uFogScatterParams.z);

        // single phase function evaluation, as the light direction is constant along the ray
        vec3 sunLight = uFogLightColor * fogPhase(dot(rayDir, uFogLightDir), uFogScatterParams.x);

        vec3 inscatter = vec3(0.0);
        float transmittance = 1.0;

        for (float i = 0.0; i < stepCount; i += 1.0) {
            float t = (i + noise) * dt;
            vec3 pos = uFogCameraPos + rayDir * t;

            // exponential height fog density, constant below the base height
            float density = uFogParams.x * exp(-uFogParams.z * max(pos.y - uFogParams.y, 0.0));

            float shadow = 1.0;
            #ifdef FOG_SHADOWS
                shadow = mix(1.0, sampleFogShadow(pos, t * rayDot), uFogScatterParams.w);
            #endif

            // accumulate in-scattered light and update transmittance (Beer-Lambert)
            vec3 radiance = sunLight * shadow + uFogAmbient;
            inscatter += transmittance * uFogTint * radiance * (density * dt);
            transmittance *= exp(-density * dt);

            if (transmittance < 0.005) break;
        }

        gl_FragColor = vec4(inscatter, transmittance);
    }
`;
