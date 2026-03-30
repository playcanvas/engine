export default /* wgsl */`

#ifdef PICK_MODE
    #include "pickPS"
    #include "floatAsUintPS"
    var pickIdTexture: texture_2d<u32>;
    var pickDepthTexture: texture_2d<f32>;
#else
    #include "tonemappingPS"
    #include "gammaPS"
    var source: texture_2d<f32>;
#endif

varying vUv0: vec2f;

@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    #ifdef PICK_MODE
        let texSize = vec2f(textureDimensions(pickIdTexture));
        let coord = vec2u(input.vUv0 * texSize);
        let pickId = textureLoad(pickIdTexture, coord, 0).r;
        if (pickId == 0xFFFFFFFFu) {
            discard;
            return output;
        }
        output.color = encodePickOutput(pickId);

        let depthData = textureLoad(pickDepthTexture, coord, 0);
        let normalizedDepth = select(depthData.r / depthData.g, 1.0, depthData.g < 1e-6);
        output.color1 = float2uint(normalizedDepth);
    #else
        let texSize = vec2f(textureDimensions(source));
        let coord = vec2u(input.vUv0 * texSize);
        let linear = textureLoad(source, coord, 0);
        output.color = vec4f(gammaCorrectOutput(toneMap(linear.rgb)), linear.a);
    #endif

    return output;
}
`;
