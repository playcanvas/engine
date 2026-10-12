// Spherical Beta lobes for uncompressed GSplat format
export default /* glsl */`

#ifdef SB_LOBES

// evaluate a lobe, packed as half floats: (axis.xy), (axis.z, sharpness), (color.rg), (color.b, -)
vec3 evalSBLobe(uvec4 lobe, vec3 dir) {
    vec2 axisXY = unpackHalf2x16(lobe.x);
    vec2 axisZSharpness = unpackHalf2x16(lobe.y);

    // renormalize, as half precision can leave the axis slightly longer than one, which a high
    // sharpness would turn into a bright overshoot at the peak of the lobe
    vec3 axis = normalize(vec3(axisXY, axisZSharpness.x));

    // a lobe only covers the hemisphere around its axis
    float d = dot(dir, axis);
    if (d <= 0.0) {
        return vec3(0.0);
    }

    return pow(d, axisZSharpness.y) * vec3(unpackHalf2x16(lobe.z), unpackHalf2x16(lobe.w).x);
}

// sum of the lobes for the model-space view direction
vec3 evalSB(vec3 dir) {
    vec3 result = evalSBLobe(loadSplatSB_0(), dir);
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
