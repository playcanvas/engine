// Soft directional shadows PCSS - with and without blocker search.
export default /* wgsl */`

fn fractSinRand(uv: vec2f) -> f32 {
    let PI: f32 = 3.141592653589793;
    let a: f32 = 12.9898; let b: f32 = 78.233; let c: f32 = 43758.5453;
    let dt: f32 = dot(uv.xy, vec2f(a, b));
    let sn: f32 = dt % PI;
    return fract(sin(sn) * c);
}

// struct to hold precomputed constants and current state
struct VogelDiskData {
    invNumSamples: f32,
    initialAngle: f32,
    currentPointId: f32,
}

// prepare the Vogel disk constants and initialize the current state in the struct
fn prepareDiskConstants(data: ptr<function, VogelDiskData>, sampleCount: i32, randomSeed: f32) {
    let pi2: f32 = 6.28318530718;
    data.invNumSamples = 1.0 / f32(sampleCount);
    data.initialAngle = randomSeed * pi2;
    data.currentPointId = 0.0;
}


fn generateDiskSample(data: ptr<function, VogelDiskData>) -> vec2f {
    let GOLDEN_ANGLE: f32 = 2.399963;
    let r: f32 = sqrt((data.currentPointId + 0.5) * data.invNumSamples);
    let theta: f32 = data.currentPointId * GOLDEN_ANGLE + data.initialAngle;

    let offset: vec2f = vec2f(cos(theta), sin(theta)) * pow(r, 1.33);

    data.currentPointId = data.currentPointId + 1.0;
    return offset;
}

fn PCSSFindBlocker(shadowMap: texture_2d<f32>, shadowMapSampler: sampler, avgBlockerDepth: ptr<function, f32>, numBlockers: ptr<function, i32>,
    shadowCoords: vec2f, z: f32, shadowBlockerSamples: i32, penumbraSize: f32, invShadowMapSize: f32, randomSeed: f32) {

    var diskData: VogelDiskData;
    prepareDiskConstants(&diskData, shadowBlockerSamples, randomSeed);

    let searchWidth: f32 = penumbraSize * invShadowMapSize;
    var blockerSum: f32 = 0.0;
    var numBlockers_local: i32 = 0;

    for( var i: i32 = 0; i < shadowBlockerSamples; i = i + 1 ) {
        let diskUV: vec2f = generateDiskSample(&diskData);
        let sampleUV: vec2f = shadowCoords + diskUV * searchWidth;
        let shadowMapDepth: f32 = textureSampleLevel(shadowMap, shadowMapSampler, sampleUV, 0.0).r;
        if ( shadowMapDepth < z ) {
            blockerSum = blockerSum + shadowMapDepth;
            numBlockers_local = numBlockers_local + 1;
        }
    }
    *avgBlockerDepth = blockerSum / f32(numBlockers_local);
    *numBlockers = numBlockers_local;
}

fn PCSSFilter(shadowMap: texture_2d<f32>, shadowMapSampler: sampler, uv: vec2f, receiverDepth: f32, shadowSamples: i32, filterRadius: f32, randomSeed: f32) -> f32 {

    var diskData: VogelDiskData;
    prepareDiskConstants(&diskData, shadowSamples, randomSeed);

    var sum: f32 = 0.0;
    for (var i: i32 = 0; i < shadowSamples; i = i + 1) {
        let offsetUV: vec2f = generateDiskSample(&diskData) * filterRadius;
        let depth: f32 = textureSampleLevel(shadowMap, shadowMapSampler, uv + offsetUV, 0.0).r;
        sum = sum + step(receiverDepth, depth);
    }
    return sum / f32(shadowSamples);
}

fn getPenumbra(dblocker: f32, dreceiver: f32, penumbraSize: f32, penumbraFalloff: f32) -> f32 {
    let dist: f32 = dreceiver - dblocker;
    let penumbra: f32 = 1.0 - pow(1.0 - dist, penumbraFalloff);
    return penumbra * penumbraSize;
}

fn PCSSDirectional(shadowMap: texture_2d<f32>, shadowMapSampler: sampler, shadowCoords: vec3f, cameraParams: vec4f, softShadowParams: vec4f) -> f32 {

    let receiverDepth: f32 = shadowCoords.z;
    let randomSeed: f32 = fractSinRand(pcPosition.xy);
    let shadowSamples: i32 = i32(softShadowParams.x);
    let shadowBlockerSamples: i32 = i32(softShadowParams.y);
    let penumbraSize: f32 = softShadowParams.z;
    let penumbraFalloff: f32 = softShadowParams.w;

    let shadowMapSize: i32 = i32(textureDimensions(shadowMap, 0).x);
    var invShadowMapSize: f32 = 1.0 / f32(shadowMapSize);
    invShadowMapSize = invShadowMapSize * (f32(shadowMapSize) / 2048.0);

    var penumbra: f32;

    // contact hardening path
    if (shadowBlockerSamples > 0) {

        // find average blocker depth
        var avgBlockerDepth: f32 = 0.0;
        var numBlockers: i32 = 0;
        PCSSFindBlocker(shadowMap, shadowMapSampler, &avgBlockerDepth, &numBlockers, shadowCoords.xy, receiverDepth, shadowBlockerSamples, penumbraSize, invShadowMapSize, randomSeed);

        // early out when no blockers are present
        if (numBlockers < 1) {
            return 1.0;
        }

        // penumbra size is based on the blocker depth
        penumbra = getPenumbra(avgBlockerDepth, shadowCoords.z, penumbraSize, penumbraFalloff);

    } else {

        // constant filter size, no contact hardening
        penumbra = penumbraSize;
    }

    let filterRadius: f32 = penumbra * invShadowMapSize;

    // filtering
    return PCSSFilter(shadowMap, shadowMapSampler, shadowCoords.xy, receiverDepth, shadowSamples, filterRadius, randomSeed);
}

fn getShadowPCSS(shadowMap: texture_2d<f32>, shadowMapSampler: sampler, shadowCoord: vec3f, shadowParams: vec4f, cameraParams: vec4f, softShadowParams: vec4f, lightDir: vec3f) -> f32 { // lightDir unused? Kept param.
    return PCSSDirectional(shadowMap, shadowMapSampler, shadowCoord, cameraParams, softShadowParams);
}
`;
