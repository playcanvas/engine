// Spherical Beta lobes for uncompressed GSplat format
export default /* wgsl */`

#ifdef SB_LOBES

// evaluate a lobe, packed as half floats: (axis.xy), (axis.z, sharpness), (color.rg), (color.b, -)
fn evalSBLobe(lobe: vec4<u32>, dir: vec3f) -> vec3f {
    let axisXY = unpack2x16float(lobe.x);
    let axisZSharpness = unpack2x16float(lobe.y);

    // renormalize, as half precision can leave the axis slightly longer than one, which a high
    // sharpness would turn into a bright overshoot at the peak of the lobe
    let axis = normalize(vec3f(axisXY, axisZSharpness.x));

    // a lobe only covers the hemisphere around its axis
    let d = dot(dir, axis);
    if (d <= 0.0) {
        return vec3f(0.0);
    }

    return pow(d, axisZSharpness.y) * vec3f(unpack2x16float(lobe.z), unpack2x16float(lobe.w).x);
}

// sum of the lobes for the model-space view direction
fn evalSB(dir: vec3f) -> vec3f {
    var result = evalSBLobe(loadSplatSB_0(), dir);
    #if SB_LOBES > 1
        result += evalSBLobe(loadSplatSB_1(), dir);
    #endif
    #if SB_LOBES > 2
        result += evalSBLobe(loadSplatSB_2(), dir);
    #endif
    #if SB_LOBES > 3
        result += evalSBLobe(loadSplatSB_3(), dir);
    #endif
    return result;
}

#endif
`;
