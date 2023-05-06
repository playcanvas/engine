export default /* glsl */`

struct IridescenceArgs
{
    // Iridescence effect intensity, range [0..1]
    float intensity;

    // Thickness of the iridescent microfilm layer, value is in nanometers, range [0..1000]
    float thickness;
};

struct ClearcoatArgs
{
    // Intensity of the clearcoat layer, range [0..1]
    float specularity;

    // Glossiness of clearcoat layer, range [0..1]
    float gloss;

    // The normal used for the clearcoat layer
    vec3 worldNormal;
};

struct SheenArgs
{
    // Glossiness of the sheen layer, range [0..1]
    float gloss;

    // The color of the f0 specularity factor for the sheen layer
    vec3 specularity;
};

struct LitShaderArguments {
    // Transparency
    float opacity;

    // Normal direction in world space
    vec3 worldNormal;

    // Surface albedo absorbance
    vec3 albedo;

    // Transmission factor (refraction), range [0..1]
    float transmission;

    // Uniform thickness of medium, used by transmission, range [0..inf]
    float thickness;

    // The f0 specularity factor
    vec3 specularity;

    // The microfacet glossiness factor, range [0..1]
    float gloss;

    // Surface metalness factor, range [0..1]
    float metalness;

    // Specularity intensity factor, range [0..1]
    float specularityFactor;

    // Ambient occlusion amount, range [0..1]
    float ao;

    // Emission color
    vec3 emission;

    // Light map color
    vec3 lightmap;

    // Light map direction
    vec3 lightmapDir;

    // Iridescence extension arguments
    IridescenceArgs iridescence;

    // Clearcoat extension arguments
    ClearcoatArgs clearcoat;

    // Sheen extension arguments
    SheenArgs sheen;
};
`;
