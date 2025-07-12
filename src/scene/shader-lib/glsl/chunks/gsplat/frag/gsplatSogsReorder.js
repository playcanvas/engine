export default /* glsl */`
    uniform usampler2D orderTexture;
    uniform sampler2D sourceTexture;
    uniform highp uint numSplats;

    void main(void) {
        uint w = uint(textureSize(sourceTexture, 0).x);
        uint idx = uint(gl_FragCoord.x) + uint(gl_FragCoord.y) * w;
        if (idx >= numSplats) discard;

        // fetch the source index and calculate source uv
        uint sidx = texelFetch(orderTexture, ivec2(gl_FragCoord.xy), 0).x;
        uvec2 suv = uvec2(sidx % w, sidx / w);

        // sample the source texture
        gl_FragColor = texelFetch(sourceTexture, ivec2(suv), 0);
    }
`;
