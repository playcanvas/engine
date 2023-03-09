export default /* glsl */`

struct IridescenceArgs
{
    vec3 fresnel;
    float intensity;
    float thickness;
};

struct ClearcoatArgs
{
    float specularity;
    float gloss;
    vec3 worldNormal;
};

struct SheenArgs
{
    float gloss;
    vec3 specularity;
};

struct LitShaderArguments {
    float opacity;

    vec3 worldNormal;

    vec3 albedo;

    float transmission;
    float thickness;

    vec3 specularity;
    float gloss;
    float metalness;
    float specularityFactor;

    float ao;

    vec3 emission;

    vec3 lightmap;
    vec3 lightmapDir;

    IridescenceArgs iridescence;
    ClearcoatArgs clearcoat;
    SheenArgs sheen;
};
`;
