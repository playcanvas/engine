export default /* glsl */`
struct LitShaderArguments {
    vec2 uvOffset;

    float opacity;

    vec3 worldNormal;

    vec3 albedo;

    float transmission;
    float thickness;

    vec3 iridescenceFresnel;
    float iridescence;
    float iridescenceThickness;

    vec3 specularity;
    float gloss;
    float metalness;
    float specularityFactor;

    float ao;

    vec3 emission;

    float clearcoatSpecularity;
    float clearcoatGloss;
    vec3 clearcoatWorldNormal;

    float sheenGloss;
    vec3 sheenSpecularity;

    vec3 lightmap;
    vec3 lightmapDir;
};
`;
