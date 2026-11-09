// Blends the lighting of the dynamic sky effect from its previous update to its latest one, see
// DynamicSkyEffect#lightingInterpolation. The environment atlases blended and the one written share
// their layout, so each texel is read where it is written. They store the light RGBP encoded, which
// is decoded to blend it linearly.
export default /* glsl */`
    uniform sampler2D dynSkyBlendPrevious;
    uniform sampler2D dynSkyBlendLatest;
    uniform float dynSkyBlendWeight;

    float saturate(float x) {
        return clamp(x, 0.0, 1.0);
    }

    #include "decodePS"
    #include "encodePS"

    void main(void) {
        ivec2 texel = ivec2(gl_FragCoord.xy);
        vec3 previous = decodeRGBP(texelFetch(dynSkyBlendPrevious, texel, 0));
        vec3 latest = decodeRGBP(texelFetch(dynSkyBlendLatest, texel, 0));
        gl_FragColor = encodeRGBP(mix(previous, latest, dynSkyBlendWeight));
    }
`;
