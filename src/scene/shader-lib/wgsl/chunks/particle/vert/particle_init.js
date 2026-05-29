export default /* wgsl */`
attribute particle_vertexData: vec4f; // XYZ = particle position, W = particle ID + random factor
#if defined(USE_MESH)
    #if defined(USE_MESH_UV)
        attribute particle_uv: vec2f;         // mesh UV
    #else
        var<private> particle_uv: vec2f = vec2f(0.0, 0.0);
    #endif
#endif

uniform matrix_viewProjection: mat4x4f;
uniform matrix_model: mat4x4f;
uniform matrix_normal: mat3x3f;
uniform matrix_viewInverse: mat4x4f;

#ifndef VIEWMATRIX
    #define VIEWMATRIX
    uniform matrix_view: mat4x4f;
#endif

uniform numParticles: f32;
uniform numParticlesPot: f32;
uniform graphSampleSize: f32;
uniform graphNumSamples: f32;
uniform stretch: f32;
uniform emitterScale: vec3f;
uniform emitterPos: vec3f;
uniform faceTangent: vec3f;
uniform faceBinorm: vec3f;
uniform rate: f32;
uniform rateDiv: f32;
uniform lifetime: f32;
uniform scaleDivMult: f32;
uniform alphaDivMult: f32;
uniform seed: f32;
uniform delta: f32;

#ifdef PARTICLE_GPU
    #ifdef WRAP
        uniform wrapBounds: vec3f;
    #endif
#endif

var particleTexOUT: texture_2d<uff>;
var particleTexIN: texture_2d<uff>;

#ifdef PARTICLE_GPU
    var internalTex0: texture_2d<uff>;
    var internalTex1: texture_2d<uff>;
    var internalTex2: texture_2d<uff>;
#endif

#ifndef CAMERAPLANES
    #define CAMERAPLANES
    uniform camera_params: vec4f;
#endif

varying texCoordsAlphaLife: vec4f;

var<private> inPos: vec3f;
var<private> inVel: vec3f;
var<private> inAngle: f32;
var<private> inShow: bool;
var<private> inLife: f32;
`;
