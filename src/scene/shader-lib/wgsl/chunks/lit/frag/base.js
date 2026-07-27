export default /* wgsl */`
uniform view_position: vec3f;

// magnopus patched
#ifdef LOD_PASS
uniform lod_level: i32;
#endif
// end magnopus patched

// magnopus patched
#ifdef MAG_STEREO_TEXTURE
// Set by the engine but not declared anywhere else
uniform view_index: f32;

// stereoVideoType - 0: None, 1: SideBySide, 2: TopBottom
fn getStereoVideoUV(uv: vec2f, stereoVideoType: i32, isStereoFlipped: i32) -> vec2f {
    var stereoUV = uv;

    if (stereoVideoType > 0) {
        let isLeftEye = select(0.0, 1.0, uniform.view_index == f32(isStereoFlipped));

        var offset = vec2f(0.0, 0.0);
        var scale = vec2f(1.0, 1.0);

        // SideBySide
        if (stereoVideoType == 1) {
            scale.x = 0.5;
            offset.x = (1.0 - isLeftEye) * 0.5;
        }
        // TopBottom
        else if (stereoVideoType == 2) {
            scale.y = 0.5;
            offset.y = (1.0 - isLeftEye) * 0.5;
        }

        stereoUV = stereoUV * scale + offset;
    }

    return stereoUV;
}
#endif
// end magnopus patched

uniform light_globalAmbient: vec3f;

fn square(x: f32) -> f32 {
    return x*x;
}

fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

fn saturate3(x: vec3f) -> vec3f {
    return clamp(x, vec3f(0.0), vec3f(1.0));
}
`;
