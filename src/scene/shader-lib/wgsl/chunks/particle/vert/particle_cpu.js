export default /* wgsl */`
attribute particle_vertexData: vec4f;   // XYZ = world pos, W = life
attribute particle_vertexData2: vec4f;  // X = angle, Y = scale, Z = alpha, W = velocity.x
attribute particle_vertexData3: vec4f;  // XYZ = particle local pos, W = velocity.y
attribute particle_vertexData4: f32;    // particle id

// type depends on useMesh property. Start with X = velocity.z, Y = particle ID and for mesh particles proceeds with Z = mesh UV.x, W = mesh UV.y
#ifndef USE_MESH
    attribute particle_vertexData5: vec2f;
#else
    attribute particle_vertexData5: vec4f;
#endif

uniform matrix_viewProjection: mat4x4f;
uniform matrix_model: mat4x4f;

#ifndef VIEWMATRIX
    #define VIEWMATRIX
    uniform matrix_view: mat4x4f;
#endif

uniform matrix_normal: mat3x3f;
uniform matrix_viewInverse: mat4x4f;

uniform numParticles: f32;
uniform lifetime: f32;
uniform stretch: f32;
uniform seed: f32;
uniform wrapBounds: vec3f;
uniform emitterScale: vec3f;
uniform faceTangent: vec3f;
uniform faceBinorm: vec3f;

#ifdef PARTICLE_GPU
    var internalTex0: texture_2d<f32>;
    var internalTex0Sampler: sampler;
    var internalTex1: texture_2d<f32>;
    var internalTex1Sampler: sampler;
    var internalTex2: texture_2d<f32>;
    var internalTex2Sampler: sampler;
#endif
uniform emitterPos: vec3f;

varying texCoordsAlphaLife: vec4f;

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
    let pos = -uniform.matrix_viewInverse[0].xyz * quadXY.x + -uniform.matrix_viewInverse[1].xyz * quadXY.y;
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

    var particlePos = input.particle_vertexData.xyz;
    let inPos = particlePos;
    let vertPos = input.particle_vertexData3.xyz;
    var inVel = vec3f(input.particle_vertexData2.w, input.particle_vertexData3.w, input.particle_vertexData5.x);

    let id = floor(input.particle_vertexData4);
    let rndFactor = fract(sin(id + 1.0 + uniform.seed));
    let rndFactor3 = vec3f(rndFactor, fract(rndFactor*10.0), fract(rndFactor*100.0));

    #ifdef LOCAL_SPACE
        let modelRotation = mat3x3f(uniform.matrix_model[0].xyz, uniform.matrix_model[1].xyz, uniform.matrix_model[2].xyz);
        inVel = modelRotation * inVel;
    #endif
    let velocityV = safeNormalize((mat3x3f(uniform.matrix_view[0].xyz, uniform.matrix_view[1].xyz, uniform.matrix_view[2].xyz) * inVel).xy);

    let quadXY = vertPos.xy;

    #ifdef USE_MESH
        output.texCoordsAlphaLife = vec4f(input.particle_vertexData5.zw, input.particle_vertexData2.z, input.particle_vertexData.w);
    #else
        output.texCoordsAlphaLife = vec4f(quadXY * -0.5 + 0.5, input.particle_vertexData2.z, input.particle_vertexData.w);
    #endif
    var rotMatrix: mat2x2f;

    var inAngle = input.particle_vertexData2.x;
    var particlePosMoved = vec3f(0.0);
    let meshLocalPos = input.particle_vertexData3.xyz;
`;
