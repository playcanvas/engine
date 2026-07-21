export default /* glsl */`
    #include "screenDepthPS"

    varying vec2 uv0;

    uniform sampler2D uFogTexture;
    uniform vec4 uFogTextureSize; // xy: fog texture resolution, zw: inverse resolution

    void main() {
        float depth = getLinearScreenDepth(uv0);

        // 4 nearest texel centers of the low resolution fog texture
        vec2 texel = uv0 * uFogTextureSize.xy - 0.5;
        vec2 base = (floor(texel) + 0.5) * uFogTextureSize.zw;
        vec2 f = fract(texel);

        vec2 uvs[4];
        uvs[0] = base;
        uvs[1] = base + vec2(uFogTextureSize.z, 0.0);
        uvs[2] = base + vec2(0.0, uFogTextureSize.w);
        uvs[3] = base + uFogTextureSize.zw;

        vec4 bilinear = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);

        // depth-aware upsample - weight the low resolution fog samples by depth similarity to
        // avoid fog leaking across geometry edges
        vec4 sum = vec4(0.0);
        float sumWeight = 0.0;
        for (int i = 0; i < 4; i++) {
            float sampleDepth = getLinearScreenDepth(uvs[i]);
            float w = bilinear[i] / (1.0 + 16.0 * abs(sampleDepth - depth) / max(depth, 0.001));
            sum += texture2D(uFogTexture, uvs[i]) * w;
            sumWeight += w;
        }

        // rgb: in-scattered light, a: transmittance. Blended over the scene using
        // scene * transmittance + inscatter.
        gl_FragColor = sum / max(sumWeight, 0.0001);
    }
`;
