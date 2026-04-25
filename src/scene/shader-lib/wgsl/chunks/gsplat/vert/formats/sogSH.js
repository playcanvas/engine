// Spherical Harmonics for SOG GSplat format - reads directly from source textures
export default /* wgsl */`
#if SH_BANDS > 0
    #ifndef SOG_V2
        uniform shN_mins: f32;
        uniform shN_maxs: f32;
    #endif

    fn readSHTexel(u: i32, v: i32) -> half3 {
        let t = textureLoad(sh_centroids, vec2i(u, v), 0);
        #ifdef SOG_V2
            let idx = vec3i(t.xyz * 255.0 + 0.5);
            return half3(vec3f(lutShN(idx.x), lutShN(idx.y), lutShN(idx.z)));
        #else
            return mix(half3(half(uniform.shN_mins)), half3(half(uniform.shN_maxs)), half3(t.xyz));
        #endif
    }

    fn readSHData(sh: ptr<function, array<half3, SH_COEFFS>>, scale: ptr<function, f32>) {
        // extract the 16-bit centroid palette index from sh_labels bytes 0 and 1
        let labels = textureLoad(sh_labels, splat.uv, 0);
        let n = i32(labels.x * 255.0 + 0.5) + i32(labels.y * 255.0 + 0.5) * 256;

        // calculate offset into the centroids texture (64 centroids per row, SH_COEFFS texels each)
        let u = (n % 64) * SH_COEFFS;
        let v = n / 64;

        // read consecutive texels (unrolled to avoid Dawn's forward progress volatile wrapper)
        sh[0] = readSHTexel(u, v);
        sh[1] = readSHTexel(u + 1, v);
        sh[2] = readSHTexel(u + 2, v);
        #if SH_BANDS > 1
            sh[3] = readSHTexel(u + 3, v);
            sh[4] = readSHTexel(u + 4, v);
            sh[5] = readSHTexel(u + 5, v);
            sh[6] = readSHTexel(u + 6, v);
            sh[7] = readSHTexel(u + 7, v);
        #endif
        #if SH_BANDS > 2
            sh[8]  = readSHTexel(u + 8, v);
            sh[9]  = readSHTexel(u + 9, v);
            sh[10] = readSHTexel(u + 10, v);
            sh[11] = readSHTexel(u + 11, v);
            sh[12] = readSHTexel(u + 12, v);
            sh[13] = readSHTexel(u + 13, v);
            sh[14] = readSHTexel(u + 14, v);
        #endif

        *scale = 1.0;
    }
#endif
`;
