export default /* wgsl */`
    let dirLm = textureSample(texture_dirLightMap, texture_dirLightMapSampler, vUv1);

    if (uniform.bakeDir > 0.5) {
        if (dAtten > 0.00001) {
            let unpacked_dir = dirLm.xyz * 2.0 - vec3f(1.0);
            dAtten = clamp(dAtten, 0.0, 1.0);
            let combined_dir = dLightDirNormW.xyz * dAtten + unpacked_dir * dirLm.w;
            let finalRgb = normalize(combined_dir) * 0.5 + vec3f(0.5);
            let finalA = max(dirLm.w + dAtten, 1.0 / 255.0);
            output.color = vec4f(finalRgb, finalA);
        } else {
            output.color = dirLm;
        }
    } else {
        let alpha_min = select(0.0, 1.0 / 255.0, dAtten > 0.00001);
        let finalA = max(dirLm.w, alpha_min);
        output.color = vec4f(dirLm.rgb, finalA);
    }
`;
