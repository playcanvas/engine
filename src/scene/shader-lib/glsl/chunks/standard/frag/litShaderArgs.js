export default /* glsl */`

// Surface albedo absorbance
vec3 litArgs_albedo;

// Transparency
float litArgs_opacity;

// Emission color
vec3 litArgs_emission;

// Normal direction in world space
vec3 litArgs_worldNormal;

// Ambient occlusion amount, range [0..1]
float litArgs_ao;

// Light map color
vec3 litArgs_lightmap;

// Light map direction
vec3 litArgs_lightmapDir;

// Surface metalness factor, range [0..1]
float litArgs_metalness;

// The f0 specularity factor
vec3 litArgs_specularity;

// Specularity intensity factor, range [0..1]
float litArgs_specularityFactor;

// The microfacet glossiness factor, range [0..1]
float litArgs_gloss;

// Glossiness of the sheen layer, range [0..1]
float litArgs_sheen_gloss;

// The color of the f0 specularity factor for the sheen layer
vec3 litArgs_sheen_specularity;

// Transmission factor (refraction), range [0..1]
float litArgs_transmission;

// Uniform thickness of medium, used by transmission, range [0..inf]
float litArgs_thickness;

// Index of refraction
float litArgs_ior;

// Dispersion, range [0..1] typically, but can be higher
float litArgs_dispersion;

// Iridescence effect intensity, range [0..1]
float litArgs_iridescence_intensity;

// Thickness of the iridescent microfilm layer, value is in nanometers, range [0..1000]
float litArgs_iridescence_thickness;

// The normal used for the clearcoat layer
vec3 litArgs_clearcoat_worldNormal;

// Intensity of the clearcoat layer, range [0..1]
float litArgs_clearcoat_specularity;

// Glossiness of clearcoat layer, range [0..1]
float litArgs_clearcoat_gloss;

`;
