// The clouds of the dynamic sky effect, see the GLSL version for the details and the credits of the
// volumetric clouds, adapted from the sky shaders demo of the Godot Engine demo projects (MIT).
export default /* wgsl */`
    uniform dynSkyCloudParams: vec4f;
    uniform dynSkyCloudOffset: vec4f;
    uniform dynSkyCloudShading: vec4f;
    uniform dynSkyCloudLight: vec3f;
    uniform dynSkyCloudLightDir: vec3f;

    const DYNSKY_PLANET_RADIUS: f32 = 6371.0;

    fn dynSkyLayerDistance(y: f32, h: f32) -> f32 {
        let b = DYNSKY_PLANET_RADIUS * y;
        return -b + sqrt(b * b + 2.0 * DYNSKY_PLANET_RADIUS * h + h * h);
    }

    fn dynamicSkyCloudFade(dir: vec3f) -> f32 {
        let t = dynSkyLayerDistance(max(dir.y, 0.0), uniform.dynSkyCloudParams.w);
        return uniform.dynSkyCloudShading.x * smoothstep(0.0, 0.08, dir.y) * exp(-t / 120.0);
    }

    // composites the clouds over the sky and over its lights, see the GLSL version
    fn dynamicSkyCompositeClouds(sky: vec3f, lights: vec3f, clouds: vec4f, dir: vec3f) -> vec3f {
        let lightsTransmit = mix(1.0, clamp((clouds.a - 0.01) / 0.99, 0.0, 1.0), uniform.dynSkyCloudShading.x);
        return sky * mix(1.0, clouds.a, dynamicSkyCloudFade(dir)) + lights * lightsTransmit + clouds.rgb;
    }

    #if defined(DYNSKY_CLOUDS_FLAT) || (defined(DYNSKY_CLOUDS_VOLUMETRIC) && !defined(DYNSKY_CLOUDS_BUFFER))
        var dynSkyCloudMap: texture_2d<f32>;
        var dynSkyCloudMapSampler: sampler;
    #endif

    #ifdef DYNSKY_CLOUDS_FLAT

        fn dynSkyFlatDensity(uv: vec2f) -> f32 {
            let shape = textureSample(dynSkyCloudMap, dynSkyCloudMapSampler, uv + uniform.dynSkyCloudOffset.xy);
            let n = shape.r * 0.62 + shape.g * 0.38;
            return clamp((n - (1.0 - uniform.dynSkyCloudParams.x)) / uniform.dynSkyCloudParams.y, 0.0, 1.0);
        }

        fn dynamicSkyCloudsFlat(dir: vec3f, ambient: vec3f) -> vec4f {
            let y = max(dir.y, 0.0);
            let L = normalize(uniform.dynSkyCloudLightDir);
            let mu = dot(dir, L);

            let t = dynSkyLayerDistance(y, uniform.dynSkyCloudParams.w);
            let density = dynSkyFlatDensity(dir.xz * (t * uniform.dynSkyCloudParams.z));
            let rim = pow(max(mu, 0.0), 8.0) * (1.0 - density) * 1.5;
            var color = ambient * mix(1.0, 0.55, density) + uniform.dynSkyCloudLight * (exp(-density * 1.2) * 0.75 + rim);
            color = mix(color, ambient, vec3f(1.0 - exp(-t / 45.0)));

            let cover = 1.0 - exp(-density * 5.0);
            let transmit = (1.0 - cover) * (1.0 - density * density * density);
            return vec4f(color * (cover * dynamicSkyCloudFade(dir)), transmit);
        }

    #endif

    #if defined(DYNSKY_CLOUDS_VOLUMETRIC) && !defined(DYNSKY_CLOUDS_BUFFER)

        var dynSkyCloudShapeMap: texture_2d_array<f32>;
        var dynSkyCloudShapeMapSampler: sampler;
        var dynSkyCloudDetailMap: texture_2d_array<f32>;
        var dynSkyCloudDetailMapSampler: sampler;
        var dynSkyBlueNoise: texture_2d<f32>;
        uniform dynSkyCloudVolume: vec4f;

        const DYNSKY_SHAPE_LAYERS: f32 = 64.0;
        const DYNSKY_DETAIL_LAYERS: f32 = 32.0;
        const DYNSKY_DETAIL_SCALE: f32 = 10.0;
        const DYNSKY_WEATHER_SCALE: f32 = 0.25;
        const DYNSKY_EXTINCTION: f32 = 50.0;
        const DYNSKY_MAX_PATH: f32 = 20.0;
        const DYNSKY_MAX_STEPS: i32 = 128;

        fn dynSkyCloudHg(mu: f32, g: f32) -> f32 {
            let g2 = g * g;
            return (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5);
        }

        fn dynSkyShapeNoise(p: vec3f) -> f32 {
            let z = p.y * DYNSKY_SHAPE_LAYERS - 0.5;
            let z0 = floor(z);
            let l0 = z0 - DYNSKY_SHAPE_LAYERS * floor(z0 / DYNSKY_SHAPE_LAYERS);
            let l1 = select(0.0, l0 + 1.0, l0 + 1.0 < DYNSKY_SHAPE_LAYERS);
            let a = textureSampleLevel(dynSkyCloudShapeMap, dynSkyCloudShapeMapSampler, p.xz, i32(l0), 0.0).r;
            let b = textureSampleLevel(dynSkyCloudShapeMap, dynSkyCloudShapeMapSampler, p.xz, i32(l1), 0.0).r;
            return mix(a, b, z - z0);
        }

        fn dynSkyDetailNoise(p: vec3f) -> f32 {
            let z = p.y * DYNSKY_DETAIL_LAYERS - 0.5;
            let z0 = floor(z);
            let l0 = z0 - DYNSKY_DETAIL_LAYERS * floor(z0 / DYNSKY_DETAIL_LAYERS);
            let l1 = select(0.0, l0 + 1.0, l0 + 1.0 < DYNSKY_DETAIL_LAYERS);
            let a = textureSampleLevel(dynSkyCloudDetailMap, dynSkyCloudDetailMapSampler, p.xz, i32(l0), 0.0).r;
            let b = textureSampleLevel(dynSkyCloudDetailMap, dynSkyCloudDetailMapSampler, p.xz, i32(l1), 0.0).r;
            return mix(a, b, z - z0);
        }

        fn dynSkyHeightFraction(pos: vec3f) -> f32 {
            let altitude = pos.y + dot(pos.xz, pos.xz) / (2.0 * DYNSKY_PLANET_RADIUS);
            return clamp((altitude - uniform.dynSkyCloudVolume.x) / (uniform.dynSkyCloudVolume.y - uniform.dynSkyCloudVolume.x), 0.0, 1.0);
        }

        fn dynSkyHeightGradient(h: f32, kind: f32) -> f32 {
            let g = vec4f(0.02, 0.05, 0.09, 0.11) * clamp(1.0 - kind * 2.0, 0.0, 1.0) +
                vec4f(0.02, 0.2, 0.48, 0.625) * (1.0 - abs(kind - 0.5) * 2.0) +
                vec4f(0.01, 0.0625, 0.78, 1.0) * clamp(kind - 0.5, 0.0, 1.0) * 2.0;
            return smoothstep(g.x, g.y, h) - smoothstep(g.z, g.w, h);
        }

        fn dynSkyFieldCoverage(weather: f32) -> f32 {
            let coverage = uniform.dynSkyCloudParams.x;
            let spread = min(coverage * 2.5, 1.0);
            let field = smoothstep(1.0 - spread, 1.0 - spread * 0.6, weather);
            return field * max(coverage, 0.3) * mix(0.6, 1.0, weather);
        }

        fn dynSkyVolumeDensity(p: vec3f, h: f32, coverage: f32, kind: f32, detail: bool) -> f32 {
            let shape = dynSkyShapeNoise(p + vec3f(uniform.dynSkyCloudOffset.x, 0.0, uniform.dynSkyCloudOffset.y));
            var cloud = shape * dynSkyHeightGradient(h, kind) + coverage - 1.0;
            if (detail && cloud > 0.0) {
                var hfbm = dynSkyDetailNoise(p * DYNSKY_DETAIL_SCALE + vec3f(uniform.dynSkyCloudOffset.z, 0.0, uniform.dynSkyCloudOffset.w));
                hfbm = mix(hfbm, 1.0 - hfbm, clamp(h * 4.0, 0.0, 1.0));
                let erosion = hfbm * mix(0.1, 0.3, h);
                cloud = (cloud - erosion) / (1.0 - erosion);
            }
            return pow(clamp(cloud, 0.0, 1.0), (1.0 - h) * 0.8 + 0.5) * (0.3 / uniform.dynSkyCloudParams.y);
        }

        fn dynSkyJitter() -> f32 {
            let noise = textureLoad(dynSkyBlueNoise, vec2i(pcPosition.xy) & vec2i(31), 0).r;
            return fract(noise + uniform.dynSkyCloudShading.w);
        }

        fn dynamicSkyCloudsVolumetric(dir: vec3f, ambient: vec3f) -> vec4f {

            // below the horizon the clouds are faded out, so the march is skipped
            let fadeIn = uniform.dynSkyCloudShading.x * smoothstep(0.0, 0.08, dir.y);
            if (fadeIn <= 0.0 || uniform.dynSkyCloudParams.x <= 0.0) {
                return vec4f(0.0, 0.0, 0.0, 1.0);
            }

            var cone = array<vec3f, 6>(
                vec3f(0.38051305, 0.92453449, -0.02111345),
                vec3f(-0.50625799, -0.03590792, -0.86163418),
                vec3f(-0.32509218, -0.94557439, 0.01428793),
                vec3f(0.09026238, -0.27376545, 0.95755165),
                vec3f(0.28128598, 0.42443639, -0.86065785),
                vec3f(-0.16852403, 0.14748697, 0.97460106)
            );

            let y = max(dir.y, 0.0);
            let L = normalize(uniform.dynSkyCloudLightDir);
            let mu = dot(dir, L);
            let steps = uniform.dynSkyCloudVolume.z;
            let lightSteps = uniform.dynSkyCloudVolume.w;
            let scale = uniform.dynSkyCloudParams.z;

            let tStart = dynSkyLayerDistance(y, uniform.dynSkyCloudVolume.x);
            let tEnd = min(dynSkyLayerDistance(y, uniform.dynSkyCloudVolume.y), tStart + DYNSKY_MAX_PATH);
            let coarse = (tEnd - tStart) / (steps * 0.5);
            let ds = coarse * uniform.dynSkyCloudShading.z;
            let lightStep = (uniform.dynSkyCloudVolume.y - uniform.dynSkyCloudVolume.x) / (6.0 * lightSteps);
            let cloudAmbient = mix(ambient, vec3f(dot(ambient, vec3f(0.2126, 0.7152, 0.0722))), vec3f(0.5));

            let phase = max(max(dynSkyCloudHg(mu, 0.6), dynSkyCloudHg(mu, 0.4 - 1.4 * L.y)), dynSkyCloudHg(mu, -0.2));

            var transmittance = 1.0;
            var scattered = vec3f(0.0);
            var t = tStart + coarse * dynSkyJitter();
            var inCloud = false;
            var empty = 0.0;
            var coverage = 0.0;
            var kind = 0.0;
            for (var i: i32 = 0; i < DYNSKY_MAX_STEPS; i = i + 1) {
                if (f32(i) >= steps || t > tEnd || transmittance < 0.01) {
                    break;
                }
                let pos = dir * t;
                let h = dynSkyHeightFraction(pos);

                if (!inCloud) {
                    let weather = textureSampleLevel(dynSkyCloudMap, dynSkyCloudMapSampler, (pos.xz * scale + uniform.dynSkyCloudOffset.xy) * DYNSKY_WEATHER_SCALE, 0.0);
                    coverage = dynSkyFieldCoverage(weather.a);
                    kind = mix(0.5, 1.0, weather.r);

                    if (dynSkyVolumeDensity(pos * scale, h, coverage, kind, false) > 0.0) {
                        inCloud = true;
                        empty = 0.0;
                        t = t - (coarse - ds);
                    } else {
                        t = t + coarse;
                    }
                    continue;
                }
                t = t + ds;

                let density = dynSkyVolumeDensity(pos * scale, h, coverage, kind, t < 25.0);
                if (density <= 0.0) {
                    empty = empty + 1.0;
                    inCloud = empty < 6.0;
                } else {
                    empty = 0.0;
                    var lightDensity = 0.0;
                    var lp = pos;
                    for (var j: i32 = 0; j < 6; j = j + 1) {
                        if (f32(j) >= lightSteps) {
                            break;
                        }
                        lp = lp + (L + cone[j] * f32(j)) * lightStep;
                        lightDensity = lightDensity + dynSkyVolumeDensity(lp * scale, dynSkyHeightFraction(lp), coverage, kind, false);
                    }
                    let fp = pos + L * (3.0 * lightSteps * lightStep);
                    lightDensity = lightDensity + dynSkyVolumeDensity(fp * scale, dynSkyHeightFraction(fp), coverage, kind, false);

                    let depth = DYNSKY_EXTINCTION * lightDensity * lightStep;
                    let beers = max(exp(-depth), exp(-depth * 0.25) * 0.4);
                    let inScatter = uniform.dynSkyCloudLight * (beers * phase) + cloudAmbient * mix(0.3, 1.0, h);

                    let stepTransmittance = exp(-DYNSKY_EXTINCTION * density * ds);
                    scattered = scattered + inScatter * (transmittance * (1.0 - stepTransmittance));
                    transmittance = transmittance * stepTransmittance;
                }
            }

            scattered = mix(scattered, ambient * (1.0 - transmittance), vec3f(1.0 - exp(-tStart / 45.0)));
            return vec4f(scattered * (fadeIn * exp(-tStart / 120.0)), transmittance);
        }

    #endif
`;
