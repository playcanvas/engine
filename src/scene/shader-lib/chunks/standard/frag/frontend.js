export default /* glsl */`
struct Frontend {
    vec2 dUvOffset;
    float dAlpha;
    vec3 dNormalW;
    vec3 dAlbedo;
    float dTransmission;
    float dThickness;
    vec3 dIridescenceFresnel;
    float dIridescence;
    float dIridescenceThickness;
    vec3 dSpecularity;
    float dGlossiness;
    float dMetalness;
    float dSpecularityFactor;
    float dAo;

    vec3 dEmission;

    float ccSpecularity;
    float ccGlossiness;
    vec3 ccNormalW;

    float sGlossiness;
    vec3 sSpecularity;

    vec3 dLightmap;
    vec3 dLightmapDir;
};
`;
