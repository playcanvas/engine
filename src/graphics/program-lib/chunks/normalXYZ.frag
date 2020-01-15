vec3 unpackNormal(vec4 nmap) {
    return normalize(nmap.xyz * 2.0 - 1.0);
}