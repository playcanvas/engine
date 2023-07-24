export default /* glsl */`

// Normal direction in world space
vec3 litArgs_worldNormal;

// Transparency
float litArgs_opacity;

// Surface albedo absorbance
vec3 litArgs_albedo;

// Transmission factor (refraction), range [0..1]
float litArgs_transmission;

// The f0 specularity factor
vec3 litArgs_specularity;

// Uniform thickness of medium, used by transmission, range [0..inf]
float litArgs_thickness;

// Emission color
vec3 litArgs_emission;

// Ambient occlusion amount, range [0..1]
float litArgs_ao;

// Light map color
vec3 litArgs_lightmap;

// Specularity intensity factor, range [0..1]
float litArgs_specularityFactor;

// Light map direction
vec3 litArgs_lightmapDir;

// The microfacet glossiness factor, range [0..1]
float litArgs_gloss;

// The normal used for the clearcoat layer
vec3 litArgs_clearcoat_worldNormal;

// Iridescence effect intensity, range [0..1]
float litArgs_iridescence_intensity;

// The color of the f0 specularity factor for the sheen layer
vec3 litArgs_sheen_specularity;

// Thickness of the iridescent microfilm layer, value is in nanometers, range [0..1000]
float litArgs_iridescence_thickness;

// Intensity of the clearcoat layer, range [0..1]
float litArgs_clearcoat_specularity;

// Glossiness of clearcoat layer, range [0..1]
float litArgs_clearcoat_gloss;

// Surface metalness factor, range [0..1]
float litArgs_metalness;

// Glossiness of the sheen layer, range [0..1]
float litArgs_sheen_gloss;

// Index of refraction
float litArgs_ior;

`;
