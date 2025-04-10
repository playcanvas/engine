export default /* wgsl */`

// Surface albedo absorbance
var litArgs_albedo: vec3f;

// Transparency
var litArgs_opacity: f32;

// Emission color
var litArgs_emission: vec3f;

// Normal direction in world space
var litArgs_worldNormal: vec3f;

// Ambient occlusion amount, range [0..1]
var litArgs_ao: f32;

// Light map color
var litArgs_lightmap: vec3f;

// Light map direction
var litArgs_lightmapDir: vec3f;

// Surface metalness factor, range [0..1]
var litArgs_metalness: f32;

// The f0 specularity factor
var litArgs_specularity: vec3f;

// Specularity intensity factor, range [0..1]
var litArgs_specularityFactor: f32;

// The microfacet glossiness factor, range [0..1]
var litArgs_gloss: f32;

// Glossiness of the sheen layer, range [0..1]
var litArgs_sheen_gloss: f32;

// The color of the f0 specularity factor for the sheen layer
var litArgs_sheen_specularity: vec3f;

// Transmission factor (refraction), range [0..1]
var litArgs_transmission: f32;

// Uniform thickness of medium, used by transmission, range [0..inf]
var litArgs_thickness: f32;

// Index of refraction
var litArgs_ior: f32;

// Dispersion, range [0..1] typically, but can be higher
var litArgs_dispersion: f32;

// Iridescence effect intensity, range [0..1]
var litArgs_iridescence_intensity: f32;

// Thickness of the iridescent microfilm layer, value is in nanometers, range [0..1000]
var litArgs_iridescence_thickness: f32;

// The normal used for the clearcoat layer
var litArgs_clearcoat_worldNormal: vec3f;

// Intensity of the clearcoat layer, range [0..1]
var litArgs_clearcoat_specularity: f32;

// Glossiness of clearcoat layer, range [0..1]
var litArgs_clearcoat_gloss: f32;

`;
