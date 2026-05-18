// Spherical Harmonics for SOG GSplat format - reads directly from source textures
export default /* glsl */`
#if SH_BANDS > 0
    #ifndef SOG_V2
        uniform float shN_mins;
        uniform float shN_maxs;
    #endif

    void readSHData(out vec3 sh[SH_COEFFS], out float scale) {
        // extract the 16-bit centroid palette index from sh_labels bytes 0 and 1
        vec4 labels = texelFetch(sh_labels, splat.uv, 0);
        int n = int(labels.x * 255.0 + 0.5) + int(labels.y * 255.0 + 0.5) * 256;

        // calculate offset into the centroids texture (64 centroids per row, SH_COEFFS texels each)
        int u = (n % 64) * SH_COEFFS;
        int v = n / 64;

        // read consecutive texels for this centroid
        for (int i = 0; i < SH_COEFFS; i++) {
            vec4 t = texelFetch(sh_centroids, ivec2(u + i, v), 0);
            #ifdef SOG_V2
                ivec3 idx = ivec3(t.xyz * 255.0 + 0.5);
                sh[i] = vec3(lutShN(idx.x), lutShN(idx.y), lutShN(idx.z));
            #else
                sh[i] = mix(vec3(shN_mins), vec3(shN_maxs), t.xyz);
            #endif
        }

        scale = 1.0;
    }
#endif
`;
