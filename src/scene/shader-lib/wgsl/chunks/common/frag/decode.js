export default /* wgsl */`

#ifndef _DECODE_INCLUDED_
#define _DECODE_INCLUDED_

fn decodeLinear(raw: vec4f) -> vec3f {
    return raw.rgb;
}

// the exact sRGB transfer, as the GPU decodes an sRGB texture
fn decodeGammaFloat(raw: f32) -> f32 {
    return select(pow((raw + 0.055) / 1.055, 2.4), raw / 12.92, raw <= 0.04045);
}

fn decodeGamma3(raw: vec3f) -> vec3f {
    return select(pow((raw + vec3f(0.055)) / 1.055, vec3f(2.4)), raw / 12.92, raw <= vec3f(0.04045));
}

fn decodeGamma(raw: vec4f) -> vec3f {
    return decodeGamma3(raw.xyz);
}

fn decodeRGBM(raw: vec4f) -> vec3f {
    let color = (8.0 * raw.a) * raw.rgb;
    return color * color;
}

fn decodeRGBP(raw: vec4f) -> vec3f {
    let color = raw.rgb * (-raw.a * 7.0 + 8.0);
    return color * color;
}

fn decodeRGBE(raw: vec4f) -> vec3f {
    return select(vec3f(0.0), raw.xyz * pow(2.0, raw.w * 255.0 - 128.0), raw.a != 0.0);
}

fn passThrough(raw: vec4f) -> vec4f {
    return raw;
}

fn unpackNormalXYZ(nmap: vec4f) -> vec3f {
    return nmap.xyz * 2.0 - 1.0;
}

fn unpackNormalXY(nmap: vec4f) -> vec3f {
    var xy = nmap.wy * 2.0 - 1.0;
    return vec3f(xy, sqrt(1.0 - clamp(dot(xy, xy), 0.0, 1.0)));
}

#endif
`;
