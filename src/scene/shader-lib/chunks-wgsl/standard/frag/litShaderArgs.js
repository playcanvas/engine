export default /* wgsl */`

// Surface albedo absorbance
var<private> litArgs_albedo: vec3f;

// Transparency
var<private> litArgs_opacity: f32;

// Emission color
var<private> litArgs_emission: vec3f;

// Normal direction in world space
var<private> litArgs_worldNormal: vec3f;

// Ambient occlusion amount, range [0..1]
var<private> litArgs_ao: f32;

// Light map color
var<private> litArgs_lightmap: vec3f;

// Light map direction
var<private> litArgs_lightmapDir: vec3f;

// Surface metalness factor, range [0..1]
var<private> litArgs_metalness: f32;

// The f0 specularity factor
var<private> litArgs_specularity: vec3f;

// Specularity intensity factor, range [0..1]
var<private> litArgs_specularityFactor: f32;

// The microfacet glossiness factor, range [0..1]
var<private> litArgs_gloss: f32;

// Glossiness of the sheen layer, range [0..1]
var<private> litArgs_sheen_gloss: f32;

// The color of the f0 specularity factor for the sheen layer
var<private> litArgs_sheen_specularity: vec3f;

// Transmission factor (refraction), range [0..1]
var<private> litArgs_transmission: f32;

// Uniform thickness of medium, used by transmission, range [0..inf]
var<private> litArgs_thickness: f32;

// Index of refraction
var<private> litArgs_ior: f32;

// Dispersion, range [0..1] typically, but can be higher
var<private> litArgs_dispersion: f32;

// Iridescence effect intensity, range [0..1]
var<private> litArgs_iridescence_intensity: f32;

// Thickness of the iridescent microfilm layer, value is in nanometers, range [0..1000]
var<private> litArgs_iridescence_thickness: f32;

// The normal used for the clearcoat layer
var<private> litArgs_clearcoat_worldNormal: vec3f;

// Intensity of the clearcoat layer, range [0..1]
var<private> litArgs_clearcoat_specularity: f32;

// Glossiness of clearcoat layer, range [0..1]
var<private> litArgs_clearcoat_gloss: f32;

`;
