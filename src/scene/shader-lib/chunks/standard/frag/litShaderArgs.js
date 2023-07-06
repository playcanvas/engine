export default /* glsl */`

// Normal direction in world space
vec3 litShaderArgs_worldNormal;

// Transparency
float litShaderArgs_opacity;

// Surface albedo absorbance
vec3 litShaderArgs_albedo;

// Transmission factor (refraction), range [0..1]
float litShaderArgs_transmission;

// The f0 specularity factor
vec3 litShaderArgs_specularity;

// Uniform thickness of medium, used by transmission, range [0..inf]
float litShaderArgs_thickness;

// Emission color
vec3 litShaderArgs_emission;

// Ambient occlusion amount, range [0..1]
float litShaderArgs_ao;

// Light map color
vec3 litShaderArgs_lightmap;

// Specularity intensity factor, range [0..1]
float litShaderArgs_specularityFactor;

// Light map direction
vec3 litShaderArgs_lightmapDir;

// The microfacet glossiness factor, range [0..1]
float litShaderArgs_gloss;

// Iridescence effect intensity, range [0..1]
float litShaderArgs_iridescence_intensity;

// Thickness of the iridescent microfilm layer, value is in nanometers, range [0..1000]
float litShaderArgs_iridescence_thickness;

// The normal used for the clearcoat layer
vec3 litShaderArgs_clearcoat_worldNormal;

// Intensity of the clearcoat layer, range [0..1]
float litShaderArgs_clearcoat_specularity;

// Glossiness of clearcoat layer, range [0..1]
float litShaderArgs_clearcoat_gloss;

// Surface metalness factor, range [0..1]
float litShaderArgs_metalness;

// The color of the f0 specularity factor for the sheen layer
vec3 litShaderArgs_sheen_specularity;

// Glossiness of the sheen layer, range [0..1]
float litShaderArgs_sheen_gloss;

`;
