export default /* wgsl */`
fn unpack3NFloats(src: f32) -> vec3f {
    let r = fract(src);
    let g = fract(src * 256.0);
    let b = fract(src * 65536.0);
    return vec3f(r, g, b);
}

fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

struct TexLerpUnpackResult {
    result: vec4f,
    unpacked: vec3f
}

fn tex1Dlod_lerp_simple(tex: texture_2d<f32>, texSampler: sampler, tc: vec2f) -> vec4f {
    let tc_next = tc + vec2f(uniform.graphSampleSize);
    return mix( textureSample(tex, texSampler, tc), textureSample(tex, texSampler, tc_next), fract(tc.x * uniform.graphNumSamples) );
}

fn tex1Dlod_lerp_unpack(tex: texture_2d<f32>, texSampler: sampler, tc: vec2f) -> TexLerpUnpackResult {
    let tc_next = tc + vec2f(uniform.graphSampleSize);
    let a = textureSampleLevel(tex, texSampler, tc, 0.0);
    let b = textureSampleLevel(tex, texSampler, tc_next, 0.0);
    let c = fract(tc.x * uniform.graphNumSamples);
    let unpackedA = unpack3NFloats(a.w);
    let unpackedB = unpack3NFloats(b.w);
    let w_out = mix(unpackedA, unpackedB, c);
    return TexLerpUnpackResult(mix(a, b, c), w_out);
}

struct RotateResult {
    rotatedVec: vec2f,
    matrix: mat2x2f
}

fn rotateWithMatrix(quadXY: vec2f, pRotation: f32) -> RotateResult {
    let c = cos(pRotation);
    let s = sin(pRotation);
    let m = mat2x2f(vec2f(c, s), vec2f(-s, c));
    return RotateResult(m * quadXY, m);
}

fn billboard(InstanceCoords: vec3f, quadXY: vec2f) -> vec3f {
    var pos: vec3f;
    #ifdef SCREEN_SPACE
        pos = vec3f(-1.0, 0.0, 0.0) * quadXY.x + vec3f(0.0, -1.0, 0.0) * quadXY.y;
    #else
        pos = -uniform.matrix_viewInverse[0].xyz * quadXY.x + -uniform.matrix_viewInverse[1].xyz * quadXY.y;
    #endif
    return pos;
}

fn customFace(InstanceCoords: vec3f, quadXY: vec2f) -> vec3f {
    let pos = uniform.faceTangent * quadXY.x + uniform.faceBinorm * quadXY.y;
    return pos;
}

fn safeNormalize(v: vec2f) -> vec2f {
    let l = length(v);
    return select(v, v / l, l > 1e-06);
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let meshLocalPos_in = input.particle_vertexData.xyz;
    let id = floor(input.particle_vertexData.w);

    let rndFactor = fract(sin(id + 1.0 + uniform.seed));
    let rndFactor3 = vec3f(rndFactor, fract(rndFactor*10.0), fract(rndFactor*100.0));

    let uv = id / uniform.numParticlesPot;
    readInput(uv);

    #ifdef LOCAL_SPACE
        let modelRotation = mat3x3f(uniform.matrix_model[0].xyz, uniform.matrix_model[1].xyz, uniform.matrix_model[2].xyz);
        inVel = modelRotation * inVel;
    #endif
    let viewRotation = mat3x3f(uniform.matrix_view[0].xyz, uniform.matrix_view[1].xyz, uniform.matrix_view[2].xyz);
    let velocityV = safeNormalize((viewRotation * inVel).xy);

    let particleLifetime = uniform.lifetime;

    var meshLocalPos = meshLocalPos_in;
    if (inLife <= 0.0 || inLife > particleLifetime || !inShow) {
         meshLocalPos = vec3f(0.0);
    }
    let quadXY = meshLocalPos.xy;
    let nlife = clamp(inLife / particleLifetime, 0.0, 1.0);

    let lerp_result = tex1Dlod_lerp_unpack(internalTex2, internalTex2Sampler, vec2f(nlife, 0.0));
    let params = lerp_result.result;
    let paramDiv = lerp_result.unpacked;

    var scale = params.y;
    let scaleDiv = paramDiv.x;
    let alphaDiv = paramDiv.z;

    scale = scale + (scaleDiv * 2.0 - 1.0) * uniform.scaleDivMult * fract(rndFactor*10000.0);

    #ifndef USE_MESH
        output.texCoordsAlphaLife = vec4f(quadXY * -0.5 + 0.5, (alphaDiv * 2.0 - 1.0) * uniform.alphaDivMult * fract(rndFactor*1000.0), nlife);
    #else
        output.texCoordsAlphaLife = vec4f(particle_uv, (alphaDiv * 2.0 - 1.0) * uniform.alphaDivMult * fract(rndFactor*1000.0), nlife);
    #endif

    var particlePos = inPos;
    var particlePosMoved = vec3f(0.0);

    var rotMatrix: mat2x2f;
`;
