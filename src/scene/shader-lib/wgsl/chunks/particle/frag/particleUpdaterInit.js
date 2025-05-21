export default /* wgsl */`
varying vUv0: vec2f;

var particleTexIN: texture_2d<f32>;
var particleTexINSampler: sampler;
var internalTex0: texture_2d<f32>;
var internalTex0Sampler: sampler;
var internalTex1: texture_2d<f32>;
var internalTex1Sampler: sampler;
var internalTex2: texture_2d<f32>;
var internalTex2Sampler: sampler;
var internalTex3: texture_2d<f32>;
var internalTex3Sampler: sampler;

uniform emitterMatrix: mat3x3f;
uniform emitterMatrixInv: mat3x3f;
uniform emitterScale: vec3f;

uniform emitterPos: vec3f;
uniform frameRandom: vec3f;
uniform localVelocityDivMult: vec3f;
uniform velocityDivMult: vec3f;
uniform delta: f32;
uniform rate: f32;
uniform rateDiv: f32;
uniform lifetime: f32;
uniform numParticles: f32;
uniform rotSpeedDivMult: f32;
uniform radialSpeedDivMult: f32;
uniform seed: f32;
uniform startAngle: f32;
uniform startAngle2: f32;
uniform initialVelocity: f32;

uniform graphSampleSize: f32;
uniform graphNumSamples: f32;

var<private> inPos: vec3f;
var<private> inVel: vec3f;
var<private> inAngle: f32;
var<private> inShow: bool;
var<private> inLife: f32;
var<private> visMode: f32;

var<private> outPos: vec3f;
var<private> outVel: vec3f;
var<private> outAngle: f32;
var<private> outShow: bool;
var<private> outLife: f32;
`;
