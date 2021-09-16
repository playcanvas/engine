// float unpacking functionality, complimentary to float-packing.js
float bytes2float2(vec2 data) {
    return dot(data, vec2(1.0, 1.0 / 255.0));
}

float bytes2float3(vec3 data) {
    return dot(data, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0));
}

float bytes2float4(vec4 data) {
    return dot(data, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0));
}

float bytes2floatRange2(vec2 data, float min, float max) {
    return mix(min, max, bytes2float2(data));
}

float bytes2floatRange3(vec3 data, float min, float max) {
    return mix(min, max, bytes2float3(data));
}

float bytes2floatRange4(vec4 data, float min, float max) {
    return mix(min, max, bytes2float4(data));
}

float mantisaExponent2Float(vec4 pack)
{
    float value = bytes2floatRange3(pack.xyz, -1.0, 1.0);
    float exponent = floor(pack.w * 255.0 - 127.0);
    return value * exp2(exponent);
}
