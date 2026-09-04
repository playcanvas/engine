export default /* glsl */`
    #include "screenDepthPS"

    // needed by the omni light shadow and cookie sampling from the atlas
    #include "clusteredLightUtilsPS"

    // helpers used by the falloff chunks, which are normally provided by the lit shader
    float square(float x) {
        return x * x;
    }

    float saturate(float x) {
        return clamp(x, 0.0, 1.0);
    }

    #include "falloffInvSquaredPS"
    #include "falloffLinearPS"
    #include "spotPS"

    #ifdef VOL_COOKIES
        #include "clusteredLightCookiesPS"
    #endif

    varying vec2 uv0;

    uniform vec3 uVolCameraPos;
    uniform vec3 uVolCameraFwd;
    uniform mat4 uVolInvView;
    uniform vec2 uVolProjScale;
    uniform vec3 uVolTint;
    uniform vec4 uVolFogParams;      // x: density, y: height base, z: height falloff, w: max distance
    uniform vec4 uVolMarchParams;    // x: anisotropy, y: step count, z: temporal noise offset, w: extinction

    // properties of the light the volume is rendered for
    uniform vec4 uVolLightPosRange;  // xyz: world space position, w: range
    uniform vec4 uVolLightSphere;    // xyz: bounding sphere center, w: bounding sphere radius
    uniform vec3 uVolLightColor;     // linear color, pre-scaled by the intensity and the exposure
    uniform vec4 uVolLightDir;       // xyz: spot cone axis, w: 1.0 for a spot light, 0.0 for omni
    uniform vec4 uVolLightSpot;      // x: inner cone cos, y: outer cone cos, z: shadow intensity, w: cookie intensity
    uniform vec4 uVolLightAtten;     // x: 1.0 for a linear falloff, 0.0 for inverse squared

    #if defined(VOL_SHADOWS) || defined(VOL_COOKIES)
        // spot light: world space to the atlas slot of the light, omni light: xyz is the atlas
        // viewport of the light (offset and the size of a cube face slot), w is the shadow bias
        uniform mat4 uVolLightProjMatrix;
        uniform vec4 uVolLightAtlas;
        uniform vec2 shadowAtlasParams;  // x: atlas resolution, y: shadow edge pixels
    #endif

    #ifdef VOL_SHADOWS
        uniform sampler2DShadow shadowAtlasTexture;

        // Visibility of the light at a world space position, sampled from the clustered lighting
        // shadow atlas. Note that unlike surface shading, no normal offset bias is applied, as the
        // fog has no surface normal.
        //
        // The tap is offset by up to a texel, on a spiral driven by the step index. Marching along a
        // beam moves mostly along the direction of the light, so without this every step of a ray
        // would land on nearly the same texel of the shadow map and share its single binary result,
        // extruding the texel grid into hard edged streaks along the beam. Spreading the taps makes
        // the steps of the march average the grid instead of aliasing on it, at no extra cost.
        float volSampleShadow(vec3 pos, vec3 lightVec, float spiral) {

            vec2 tapOffset = vec2(cos(spiral), sin(spiral)) / shadowAtlasParams.x;

            if (uVolLightDir.w > 0.0) {

                // spot light - a perspective projection into the atlas slot of the light, with the
                // depth bias already applied when the shadow map was rendered
                vec4 projPos = uVolLightProjMatrix * vec4(pos, 1.0);
                vec3 shadowCoord = projPos.xyz / projPos.w;
                return textureShadow(shadowAtlasTexture, vec3(shadowCoord.xy + tapOffset, shadowCoord.z));
            }

            // omni light - a cube face stored in the atlas, using the normalized distance to the
            // light as the depth
            vec2 uv = getCubemapAtlasCoordinates(uVolLightAtlas.xyz, shadowAtlasParams.y, shadowAtlasParams.x, lightVec);
            float shadowZ = length(lightVec) / uVolLightPosRange.w + uVolLightAtlas.w;
            return textureShadow(shadowAtlasTexture, vec3(uv + tapOffset, shadowZ));
        }
    #endif

    #ifdef VOL_COOKIES
        uniform sampler2D cookieAtlasTexture;
        uniform vec4 uVolLightCookieChannel;

        vec3 volSampleCookie(vec3 pos, vec3 lightVec) {

            if (uVolLightDir.w > 0.0) {
                return getCookie2DClustered(TEXTURE_PASS(cookieAtlasTexture), uVolLightProjMatrix, pos,
                    uVolLightSpot.w, uVolLightCookieChannel);
            }

            return getCookieCubeClustered(TEXTURE_PASS(cookieAtlasTexture), lightVec, uVolLightSpot.w,
                uVolLightCookieChannel, shadowAtlasParams.x, shadowAtlasParams.y, uVolLightAtlas.xyz);
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

    // optical depth of the height fog over a part of the ray which is entirely below or entirely
    // above the base height, where h is the height above the base height at the distance s
    float volFogSegmentDepth(float s0, float s1, float h0, float rayDirY) {

        if (s1 <= s0) return 0.0;

        float density = uVolFogParams.x;
        float falloff = uVolFogParams.z;
        float hMid = h0 + rayDirY * (s0 + s1) * 0.5;

        // below the base height the density is constant
        if (hMid <= 0.0) {
            return density * (s1 - s0);
        }

        // a ray which is nearly horizontal (or fog with no falloff) has a constant density as well
        float scale = falloff * rayDirY;
        if (abs(scale) < 1e-6) {
            return density * exp(-falloff * hMid) * (s1 - s0);
        }

        // analytic integral of the exponential density over the segment
        return density * (exp(-falloff * (h0 + rayDirY * s0)) - exp(-falloff * (h0 + rayDirY * s1))) / scale;
    }

    // Clips a ray interval by one root of the spot cone equation. The root is an entry into the cone
    // or an exit from it depending on whether the equation is increasing or decreasing there, and it
    // is ignored when it lies on the mirror sheet of the cone, behind the apex.
    vec2 volClipCone(vec2 span, float root, float gradient, float axial) {
        if (axial < 0.0) return span;
        return gradient > 0.0 ? vec2(max(span.x, root), span.y) : vec2(span.x, min(span.y, root));
    }

    // optical depth of the exponential height fog along the ray, from the camera to the distance t
    float volFogOpticalDepth(float t, float rayDirY) {

        float h0 = uVolCameraPos.y - uVolFogParams.y;

        // split the ray where it crosses the base height, so that each part is entirely below or
        // entirely above it
        float sCross = abs(rayDirY) > 1e-6 ? clamp(-h0 / rayDirY, 0.0, t) : 0.0;
        float depth = volFogSegmentDepth(0.0, sCross, h0, rayDirY) +
                      volFogSegmentDepth(sCross, t, h0, rayDirY);

        // the extinction scales the absorption of the fog without changing how much it scatters
        return depth * uVolMarchParams.w;
    }

    void main() {

        // world space ray for this pixel (perspective projection). Note that uv0 addresses
        // textures (getImageEffectUV flips it on WebGPU), so undo the flip to get NDC
        vec2 ndcUV = uv0;
        #ifdef WEBGPU
            ndcUV.y = 1.0 - ndcUV.y;
        #endif
        vec2 ndc = ndcUV * 2.0 - 1.0;
        vec3 rayDir = normalize((uVolInvView * vec4(ndc * uVolProjScale, -1.0, 0.0)).xyz);

        // distance along the ray to the scene surface
        float rayDot = max(dot(rayDir, uVolCameraFwd), 0.001);
        float sceneT = min(getLinearScreenDepth(uv0) / rayDot, uVolFogParams.w);

        // the ray is marched only over the part of it inside the bounding sphere of the light,
        // which both concentrates the samples where the light contributes and limits the cost to
        // the volume of the light
        vec3 sphereToCam = uVolCameraPos - uVolLightSphere.xyz;
        float halfB = dot(sphereToCam, rayDir);
        float c = dot(sphereToCam, sphereToCam) - uVolLightSphere.w * uVolLightSphere.w;
        float discriminant = halfB * halfB - c;
        if (discriminant <= 0.0) discard;

        float rootOffset = sqrt(discriminant);
        float t0 = max(-halfB - rootOffset, 0.0);
        float t1 = min(-halfB + rootOffset, sceneT);

        // For a spot light the bounding sphere is a poor fit - its cone only fills a fraction of it,
        // so most of the samples would land outside the beam. The segment is therefore clipped to the
        // cone itself, which concentrates every step inside the lit volume.
        if (uVolLightDir.w > 0.0) {

            vec3 apexToCam = uVolCameraPos - uVolLightPosRange.xyz;
            float axisStart = dot(apexToCam, uVolLightDir.xyz);
            float axisRate = dot(rayDir, uVolLightDir.xyz);

            // the slab of the cone along its axis, from the apex plane to the range plane
            if (abs(axisRate) > 1e-6) {

                float tApex = -axisStart / axisRate;
                float tRange = (uVolLightPosRange.w - axisStart) / axisRate;
                t0 = max(t0, min(tApex, tRange));
                t1 = min(t1, max(tApex, tRange));

            } else if (axisStart < 0.0 || axisStart > uVolLightPosRange.w) {

                // the ray runs parallel to the cone base, outside of the slab
                discard;
            }

            // The surface of the cone, where dot(normalize(pos - apex), axis) equals the cosine of
            // the outer cone angle. Squaring that gives a quadratic in the ray distance, and as the
            // cone clipped by the slab is convex, the ray is inside it over a single interval. When
            // no root is found the interval is left as it is and the per sample cone attenuation
            // still masks the fog, so the clip only ever improves the distribution of the samples.
            float cosSqr = uVolLightSpot.y * uVolLightSpot.y;
            float qa = axisRate * axisRate - cosSqr;
            float qb = axisRate * axisStart - cosSqr * dot(rayDir, apexToCam);
            float qc = axisStart * axisStart - cosSqr * dot(apexToCam, apexToCam);

            vec2 span = vec2(t0, t1);
            if (abs(qa) > 1e-6) {

                float discriminantCone = qb * qb - qa * qc;
                if (discriminantCone > 0.0) {
                    float rootOffsetCone = sqrt(discriminantCone);
                    float rootA = (-qb - rootOffsetCone) / qa;
                    float rootB = (-qb + rootOffsetCone) / qa;
                    span = volClipCone(span, rootA, qa * rootA + qb, axisStart + rootA * axisRate);
                    span = volClipCone(span, rootB, qa * rootB + qb, axisStart + rootB * axisRate);
                }

            } else if (abs(qb) > 1e-6) {

                // the ray runs parallel to the surface of the cone, leaving a single root
                float root = -0.5 * qc / qb;
                span = volClipCone(span, root, qb, axisStart + root * axisRate);
            }

            t0 = span.x;
            t1 = span.y;
        }

        if (t1 <= t0) discard;

        // per-pixel noise offsets the samples along the ray to hide banding, and cycles over
        // frames when TAA is used to temporally accumulate to a smooth result
        float stepCount = uVolMarchParams.y;
        float dt = (t1 - t0) / stepCount;
        float noise = fract(fogNoise(gl_FragCoord.xy) + uVolMarchParams.z);

        vec3 inscatter = vec3(0.0);

        for (float i = 0.0; i < stepCount; i += 1.0) {

            float t = t0 + (i + noise) * dt;
            vec3 pos = uVolCameraPos + rayDir * t;

            // exponential height fog density, constant below the base height
            float density = uVolFogParams.x * exp(-uVolFogParams.z * max(pos.y - uVolFogParams.y, 0.0));

            // attenuation of the light at the sample, matching the surface lighting
            vec3 lightVec = pos - uVolLightPosRange.xyz;
            vec3 lightDirNorm = normalize(lightVec);
            float atten = uVolLightAtten.x > 0.0 ?
                getFalloffLinear(uVolLightPosRange.w, lightVec) :
                getFalloffInvSquared(uVolLightPosRange.w, lightVec);

            if (uVolLightDir.w > 0.0) {
                atten *= getSpotEffect(uVolLightDir.xyz, uVolLightSpot.x, uVolLightSpot.y, lightDirNorm);
            }

            if (atten > 0.00001) {

                #ifdef VOL_SHADOWS
                    if (uVolLightSpot.z > 0.0) {
                        float spiral = (i + noise) * 2.39996;
                        atten *= mix(1.0, volSampleShadow(pos, lightVec, spiral), uVolLightSpot.z);
                    }
                #endif

                vec3 radiance = uVolLightColor;

                #ifdef VOL_COOKIES
                    if (uVolLightSpot.w > 0.0) {
                        radiance *= volSampleCookie(pos, lightVec);
                    }
                #endif

                // the light in-scattered towards the camera, attenuated by the fog between the
                // camera and the sample. As the samples of this pass are not contiguous, the
                // transmittance is evaluated analytically instead of being accumulated.
                float transmittance = exp(-volFogOpticalDepth(t, rayDir.y));
                float phase = fogPhase(dot(rayDir, -lightDirNorm), uVolMarchParams.x);
                inscatter += transmittance * uVolTint * radiance * (atten * phase * density * dt);
            }
        }

        // only the in-scattered light is added, the transmittance of the fog is owned by the
        // directional pass and is preserved by the blending
        gl_FragColor = vec4(inscatter, 1.0);
    }
`;
