export default /* glsl */`
struct Frontend {
    vec2 uvOffset;

    float alpha;

    vec3 worldNormal;

    vec3 albedo;

    float transmission;
    float thickness;

    vec3 iridescenceFresnel;
    float iridescence;
    float iridescenceThickness;

    vec3 specularity;
    float glossiness;
    float metalness;
    float specularityFactor;

    float ao;

    vec3 emission;

    float clearcoatSpecularity;
    float clearcoatGlossiness;
    vec3 clearcoatWorldNormal;

    float sheenGlossiness;
    vec3 sheenSpecularity;

    vec3 lightmap;
    vec3 lightmapDir;
};
`;
