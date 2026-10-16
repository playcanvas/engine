// The clouds of the dynamic sky effect: a layer of clouds at an altitude above a spherical planet,
// so it curves down to the horizon, shaped from small tileable noise textures drifting with the
// wind. Each technique returns the light the clouds scatter toward the viewer in rgb, and the
// fraction of the light behind them they let through in alpha, so the clouds can be evaluated apart
// from the sky behind them - see dynamicSkyCompositeClouds.
//
// DYNSKY_CLOUDS_FLAT - a single layer of noise with simple shading
// DYNSKY_CLOUDS_VOLUMETRIC - the clouds ray marched through a layer of 3D noise
export default /* glsl */`
    uniform vec4 dynSkyCloudParams;     // x: coverage, y: softness, z: pattern repeats per km, w: height in km
    uniform vec4 dynSkyCloudOffset;     // xy: drift of the shapes, in their repeats, zw: drift of the detail
    uniform vec4 dynSkyCloudShading;    // x: opacity, z: fine step per coarse step, w: offset of the jitter
    uniform vec3 dynSkyCloudLight;      // the light above the clouds - color times intensity
    uniform vec3 dynSkyCloudLightDir;   // direction toward the light

    const float DYNSKY_PLANET_RADIUS = 6371.0;   // km

    // distance along a view ray of the given elevation to a layer at the given height, in km
    float dynSkyLayerDistance(float y, float h) {
        float b = DYNSKY_PLANET_RADIUS * y;
        return -b + sqrt(b * b + 2.0 * DYNSKY_PLANET_RADIUS * h + h * h);
    }

    // how visible the clouds in a direction are, 0..1 - they fade into the haze with the distance,
    // and out toward the horizon
    float dynamicSkyCloudFade(vec3 dir) {
        float t = dynSkyLayerDistance(max(dir.y, 0.0), dynSkyCloudParams.w);
        return dynSkyCloudShading.x * smoothstep(0.0, 0.08, dir.y) * exp(-t / 120.0);
    }

    // composites the clouds over the sky behind them, and over the lights of the sky - the sun, the
    // moon and the stars. The faded clouds let the sky behind them through. The lights are far
    // brighter than the clouds, so the little of them a faded cloud would let through would still
    // shine through it - the lights pass the clouds by their transmittance alone, and the dense
    // clouds the march stopped in block them fully
    vec3 dynamicSkyCompositeClouds(vec3 sky, vec3 lights, vec4 clouds, vec3 dir) {
        float lightsTransmit = mix(1.0, clamp((clouds.a - 0.01) / 0.99, 0.0, 1.0), dynSkyCloudShading.x);
        return sky * mix(1.0, clouds.a, dynamicSkyCloudFade(dir)) + lights * lightsTransmit + clouds.rgb;
    }

    #if defined(DYNSKY_CLOUDS_FLAT) || (defined(DYNSKY_CLOUDS_VOLUMETRIC) && !defined(DYNSKY_CLOUDS_BUFFER))
        uniform sampler2D dynSkyCloudMap;
    #endif

    #ifdef DYNSKY_CLOUDS_FLAT

        // the density of the clouds, 0..1
        float dynSkyFlatDensity(vec2 uv) {
            vec4 shape = texture2D(dynSkyCloudMap, uv + dynSkyCloudOffset.xy);
            float n = shape.r * 0.62 + shape.g * 0.38;
            return clamp((n - (1.0 - dynSkyCloudParams.x)) / dynSkyCloudParams.y, 0.0, 1.0);
        }

        // the flat clouds in a direction, lit by the light above them and the sky around them. The
        // dense cores block the light behind them fully
        vec4 dynamicSkyCloudsFlat(vec3 dir, vec3 ambient) {
            float y = max(dir.y, 0.0);
            vec3 L = normalize(dynSkyCloudLightDir);
            float mu = dot(dir, L);

            float t = dynSkyLayerDistance(y, dynSkyCloudParams.w);
            float density = dynSkyFlatDensity(dir.xz * (t * dynSkyCloudParams.z));
            float rim = pow(max(mu, 0.0), 8.0) * (1.0 - density) * 1.5;
            vec3 color = ambient * mix(1.0, 0.55, density) + dynSkyCloudLight * (exp(-density * 1.2) * 0.75 + rim);
            color = mix(color, ambient, 1.0 - exp(-t / 45.0));

            float cover = 1.0 - exp(-density * 5.0);
            float transmit = (1.0 - cover) * (1.0 - density * density * density);
            return vec4(color * (cover * dynamicSkyCloudFade(dir)), transmit);
        }

    #endif

    #if defined(DYNSKY_CLOUDS_VOLUMETRIC) && !defined(DYNSKY_CLOUDS_BUFFER)

        // Volumetric technique - the clouds ray marched through a layer of 3D noise.
        //
        // Adapted from the sky shaders demo of the Godot Engine demo projects,
        // https://github.com/godotengine/godot-demo-projects/tree/master/3d/sky_shaders - MIT License,
        // Copyright (c) 2014-present Godot Engine contributors, Copyright (c) 2007-2014 Juan Linietsky,
        // Ariel Manzur. Based on A. Schneider, "The Real-Time Volumetric Cloudscapes of Horizon: Zero
        // Dawn", SIGGRAPH 2015.

        uniform highp sampler2DArray dynSkyCloudShapeMap;
        uniform highp sampler2DArray dynSkyCloudDetailMap;
        uniform sampler2D dynSkyBlueNoise;      // 32x32 texels
        uniform vec4 dynSkyCloudVolume;     // xy: bottom and top of the layer in km, z: steps, w: steps toward the light

        const float DYNSKY_SHAPE_LAYERS = 64.0;
        const float DYNSKY_DETAIL_LAYERS = 32.0;
        const float DYNSKY_DETAIL_SCALE = 10.0;    // repeats of the detail per repeat of the shapes
        const float DYNSKY_WEATHER_SCALE = 0.25;   // repeats of the weather per repeat of the shapes
        const float DYNSKY_EXTINCTION = 50.0;      // per km, at the full density
        const float DYNSKY_MAX_PATH = 20.0;        // km - the longest march through the layer
        const int DYNSKY_MAX_STEPS = 128;

        // directions spreading the samples toward the light into a cone
        const vec3 DYNSKY_CONE[6] = vec3[6](
            vec3(0.38051305, 0.92453449, -0.02111345),
            vec3(-0.50625799, -0.03590792, -0.86163418),
            vec3(-0.32509218, -0.94557439, 0.01428793),
            vec3(0.09026238, -0.27376545, 0.95755165),
            vec3(0.28128598, 0.42443639, -0.86065785),
            vec3(-0.16852403, 0.14748697, 0.97460106)
        );

        // Henyey-Greenstein phase function, relative to the isotropic one
        float dynSkyCloudHg(float mu, float g) {
            float g2 = g * g;
            return (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5);
        }

        // 3D noise, stored in the layers of texture arrays and interpolated between the layers. The
        // shapes - Perlin-Worley noise, and the detail - fractal cellular noise, both 0..1
        float dynSkyShapeNoise(vec3 p) {
            float z = p.y * DYNSKY_SHAPE_LAYERS - 0.5;
            float z0 = floor(z);
            float l0 = z0 - DYNSKY_SHAPE_LAYERS * floor(z0 / DYNSKY_SHAPE_LAYERS);
            float l1 = l0 + 1.0 < DYNSKY_SHAPE_LAYERS ? l0 + 1.0 : 0.0;
            float a = textureLod(dynSkyCloudShapeMap, vec3(p.xz, l0), 0.0).r;
            float b = textureLod(dynSkyCloudShapeMap, vec3(p.xz, l1), 0.0).r;
            return mix(a, b, z - z0);
        }

        float dynSkyDetailNoise(vec3 p) {
            float z = p.y * DYNSKY_DETAIL_LAYERS - 0.5;
            float z0 = floor(z);
            float l0 = z0 - DYNSKY_DETAIL_LAYERS * floor(z0 / DYNSKY_DETAIL_LAYERS);
            float l1 = l0 + 1.0 < DYNSKY_DETAIL_LAYERS ? l0 + 1.0 : 0.0;
            float a = textureLod(dynSkyCloudDetailMap, vec3(p.xz, l0), 0.0).r;
            float b = textureLod(dynSkyCloudDetailMap, vec3(p.xz, l1), 0.0).r;
            return mix(a, b, z - z0);
        }

        // the fraction of the height through the cloud layer of a point relative to the viewer, in km
        float dynSkyHeightFraction(vec3 pos) {
            float altitude = pos.y + dot(pos.xz, pos.xz) / (2.0 * DYNSKY_PLANET_RADIUS);
            return clamp((altitude - dynSkyCloudVolume.x) / (dynSkyCloudVolume.y - dynSkyCloudVolume.x), 0.0, 1.0);
        }

        // the profile of the clouds over the height of the layer, by the kind of the clouds - from
        // stratus (0) over stratocumulus (0.5) to cumulus (1)
        float dynSkyHeightGradient(float h, float kind) {
            vec4 g = vec4(0.02, 0.05, 0.09, 0.11) * clamp(1.0 - kind * 2.0, 0.0, 1.0) +
                vec4(0.02, 0.2, 0.48, 0.625) * (1.0 - abs(kind - 0.5) * 2.0) +
                vec4(0.01, 0.0625, 0.78, 1.0) * clamp(kind - 0.5, 0.0, 1.0) * 2.0;
            return smoothstep(g.x, g.y, h) - smoothstep(g.z, g.w, h);
        }

        // the coverage of the clouds at a point of the weather pattern, 0..1. The weather gathers the
        // clouds into fields, covering a fraction of the sky growing with the coverage - the clouds of
        // a low coverage are few, rather than small - and varies the coverage within the fields
        float dynSkyFieldCoverage(float weather) {
            float coverage = dynSkyCloudParams.x;
            float spread = min(coverage * 2.5, 1.0);
            float field = smoothstep(1.0 - spread, 1.0 - spread * 0.6, weather);
            return field * max(coverage, 0.3) * mix(0.6, 1.0, weather);
        }

        // the density of the clouds at a point in repeats of the shapes, at the height fraction h. The
        // detail erodes the edges of the shapes. The softness thins the clouds into translucent,
        // wispy ones, or thickens them into dense clouds with crisp edges
        float dynSkyVolumeDensity(vec3 p, float h, float coverage, float kind, bool detail) {
            float shape = dynSkyShapeNoise(p + vec3(dynSkyCloudOffset.x, 0.0, dynSkyCloudOffset.y));
            float cloud = shape * dynSkyHeightGradient(h, kind) + coverage - 1.0;
            if (detail && cloud > 0.0) {
                float hfbm = dynSkyDetailNoise(p * DYNSKY_DETAIL_SCALE + vec3(dynSkyCloudOffset.z, 0.0, dynSkyCloudOffset.w));
                hfbm = mix(hfbm, 1.0 - hfbm, clamp(h * 4.0, 0.0, 1.0));
                float erosion = hfbm * mix(0.1, 0.3, h);
                cloud = (cloud - erosion) / (1.0 - erosion);
            }
            return pow(clamp(cloud, 0.0, 1.0), (1.0 - h) * 0.8 + 0.5) * (0.3 / dynSkyCloudParams.y);
        }

        // blue noise tiled over the pixels, offset every frame when the frames are accumulated -
        // offsets the steps of neighboring pixels, trading the banding of the few steps for a fine
        // grain. Unlike white noise, it has no clumps the 3x3 blur of the clouds when they are
        // composited would leave, and unlike a regular pattern, such as interleaved gradient noise,
        // it leaves no moire with the steps, which would crawl over the clouds as the camera turns
        float dynSkyJitter() {
            float noise = texelFetch(dynSkyBlueNoise, ivec2(gl_FragCoord.xy) & 31, 0).r;
            return fract(noise + dynSkyCloudShading.w);
        }

        // the volumetric clouds in a direction - the light they scatter toward the viewer, and the
        // light behind them they let through. The empty sky is crossed in coarse steps of the cheap
        // density without the detail - when they find a cloud, the march steps back and continues in
        // fine steps, until it leaves the cloud
        vec4 dynamicSkyCloudsVolumetric(vec3 dir, vec3 ambient) {

            // below the horizon the clouds are faded out, so the march is skipped
            float fadeIn = dynSkyCloudShading.x * smoothstep(0.0, 0.08, dir.y);
            if (fadeIn <= 0.0 || dynSkyCloudParams.x <= 0.0) {
                return vec4(0.0, 0.0, 0.0, 1.0);
            }

            float y = max(dir.y, 0.0);
            vec3 L = normalize(dynSkyCloudLightDir);
            float mu = dot(dir, L);
            float steps = dynSkyCloudVolume.z;
            float lightSteps = dynSkyCloudVolume.w;
            float scale = dynSkyCloudParams.z;

            float tStart = dynSkyLayerDistance(y, dynSkyCloudVolume.x);
            float tEnd = min(dynSkyLayerDistance(y, dynSkyCloudVolume.y), tStart + DYNSKY_MAX_PATH);
            float coarse = (tEnd - tStart) / (steps * 0.5);
            float ds = coarse * dynSkyCloudShading.z;

            // the samples toward the light reach about a sixth of the layer, whatever their count
            float lightStep = (dynSkyCloudVolume.y - dynSkyCloudVolume.x) / (6.0 * lightSteps);
            vec3 cloudAmbient = mix(ambient, vec3(dot(ambient, vec3(0.2126, 0.7152, 0.0722))), 0.5);

            // stacked phase lobes - the forward lobe gives the silver lining toward the light, the
            // others some back scattering
            float phase = max(max(dynSkyCloudHg(mu, 0.6), dynSkyCloudHg(mu, 0.4 - 1.4 * L.y)), dynSkyCloudHg(mu, -0.2));

            float transmittance = 1.0;
            vec3 scattered = vec3(0.0);
            float t = tStart + coarse * dynSkyJitter();
            bool inCloud = false;
            float empty = 0.0;
            float coverage = 0.0;
            float kind = 0.0;
            for (int i = 0; i < DYNSKY_MAX_STEPS; i++) {
                if (float(i) >= steps || t > tEnd || transmittance < 0.01) {
                    break;
                }
                vec3 pos = dir * t;
                float h = dynSkyHeightFraction(pos);

                if (!inCloud) {
                    // the weather gathers the clouds into fields, and sets their kind. It barely
                    // changes over the fine steps through a cloud, which reuse it
                    vec4 weather = textureLod(dynSkyCloudMap, (pos.xz * scale + dynSkyCloudOffset.xy) * DYNSKY_WEATHER_SCALE, 0.0);
                    coverage = dynSkyFieldCoverage(weather.a);
                    kind = mix(0.5, 1.0, weather.r);

                    if (dynSkyVolumeDensity(pos * scale, h, coverage, kind, false) > 0.0) {
                        inCloud = true;
                        empty = 0.0;
                        t -= coarse - ds;
                    } else {
                        t += coarse;
                    }
                    continue;
                }
                t += ds;

                // the detail is lost in the distance
                float density = dynSkyVolumeDensity(pos * scale, h, coverage, kind, t < 25.0);
                if (density <= 0.0) {
                    empty += 1.0;
                    inCloud = empty < 6.0;
                } else {
                    empty = 0.0;

                    // the cloud toward the light - samples spreading in a cone, and a distant one
                    float lightDensity = 0.0;
                    vec3 lp = pos;
                    for (int j = 0; j < 6; j++) {
                        if (float(j) >= lightSteps) {
                            break;
                        }
                        lp += (L + DYNSKY_CONE[j] * float(j)) * lightStep;
                        lightDensity += dynSkyVolumeDensity(lp * scale, dynSkyHeightFraction(lp), coverage, kind, false);
                    }
                    vec3 fp = pos + L * (3.0 * lightSteps * lightStep);
                    lightDensity += dynSkyVolumeDensity(fp * scale, dynSkyHeightFraction(fp), coverage, kind, false);

                    // the light passing through the cloud. The weaker second absorption keeps the
                    // insides of the clouds bright, as the light scatters through them many times
                    float depth = DYNSKY_EXTINCTION * lightDensity * lightStep;
                    float beers = max(exp(-depth), exp(-depth * 0.25) * 0.4);

                    // the sky lights the tops of the clouds more than their bases
                    vec3 inScatter = dynSkyCloudLight * (beers * phase) + cloudAmbient * mix(0.3, 1.0, h);

                    float stepTransmittance = exp(-DYNSKY_EXTINCTION * density * ds);
                    scattered += inScatter * (transmittance * (1.0 - stepTransmittance));
                    transmittance *= stepTransmittance;
                }
            }

            // the haze between the viewer and the distant clouds
            scattered = mix(scattered, ambient * (1.0 - transmittance), 1.0 - exp(-tStart / 45.0));
            return vec4(scattered * (fadeIn * exp(-tStart / 120.0)), transmittance);
        }

    #endif
`;
