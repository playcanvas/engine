vec3 unpackNormal(vec4 nmap) {
    return nmap.xyz * 2.0 - 1.0;
}

